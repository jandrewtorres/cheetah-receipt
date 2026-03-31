// src/app/api/disputes/route.ts
// POST /api/disputes — open a dispute
// GET  /api/disputes — list disputes (admin: all, user: own)

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications/push';
import { sendDisputeOpenedEmail } from '@/lib/email';
import { z } from 'zod';

const OpenDisputeSchema = z.object({
  order_id: z.string().uuid(),
  reason: z.enum([
    'receipt_not_as_described',
    'receipt_already_used',
    'duplicate_receipt',
    'missing_items',
    'wrong_store',
    'fraudulent_receipt',
    'other',
  ]),
  description: z.string().min(20).max(2000),
  evidence_urls: z.array(z.string().url()).max(5).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = OpenDisputeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify order belongs to buyer and is in disputable state
    const { data: order } = await adminClient
      .from('orders')
      .select('id, buyer_id, seller_id, status, receipt_id, receipts(store_name), amount')
      .eq('id', parsed.data.order_id)
      .single();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Only the buyer can open a dispute' }, { status: 403 });
    }

    if (!['paid', 'delivered', 'completed'].includes(order.status)) {
      return NextResponse.json({ error: 'Order cannot be disputed in its current state' }, { status: 422 });
    }

    // Check dispute window (7 days from purchase)
    const { data: existingOrder } = await adminClient
      .from('orders')
      .select('created_at')
      .eq('id', parsed.data.order_id)
      .single();

    const orderAge = Date.now() - new Date(existingOrder!.created_at).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (orderAge > sevenDays) {
      return NextResponse.json({
        error: 'Dispute window has closed. Disputes must be opened within 7 days of purchase.',
        code: 'DISPUTE_WINDOW_CLOSED',
      }, { status: 422 });
    }

    // Check no existing dispute
    const { data: existingDispute } = await adminClient
      .from('disputes')
      .select('id')
      .eq('order_id', parsed.data.order_id)
      .single();

    if (existingDispute) {
      return NextResponse.json({ error: 'A dispute already exists for this order' }, { status: 409 });
    }

    // Create dispute
    const { data: dispute } = await adminClient
      .from('disputes')
      .insert({
        order_id: parsed.data.order_id,
        opened_by: user.id,
        reason: parsed.data.reason,
        description: parsed.data.description,
        evidence_urls: parsed.data.evidence_urls ?? [],
        status: 'open',
      })
      .select()
      .single();

    // Update order status
    await adminClient
      .from('orders')
      .update({ status: 'disputed' })
      .eq('id', parsed.data.order_id);

    // Get user details for notifications
    const [{ data: buyer }, { data: seller }] = await Promise.all([
      adminClient.from('users').select('email, full_name').eq('id', user.id).single(),
      adminClient.from('users').select('email, full_name').eq('id', order.seller_id).single(),
    ]);

    const storeName = (order.receipts as any)?.store_name ?? 'Receipt';

    // Notify seller
    await Promise.allSettled([
      notify.disputeOpened({
        sellerId: order.seller_id,
        storeName,
        disputeId: dispute!.id,
      }),
      seller && sendDisputeOpenedEmail({
        to: seller.email,
        name: seller.full_name ?? 'Seller',
        role: 'seller',
        orderId: order.id,
        disputeId: dispute!.id,
        storeName,
        reason: parsed.data.reason.replace(/_/g, ' '),
      }),
      buyer && sendDisputeOpenedEmail({
        to: buyer.email,
        name: buyer.full_name ?? 'Buyer',
        role: 'buyer',
        orderId: order.id,
        disputeId: dispute!.id,
        storeName,
        reason: parsed.data.reason.replace(/_/g, ' '),
      }),
    ]);

    return NextResponse.json({ data: dispute }, { status: 201 });
  } catch (error) {
    console.error('[OPEN DISPUTE] Error:', error);
    return NextResponse.json({ error: 'Failed to open dispute' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: userRecord } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userRecord?.role === 'admin';
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const perPage = 20;

    let query = adminClient
      .from('disputes')
      .select(`
        *,
        orders(id, amount, receipts(store_name, store_chain)),
        opened_by_user:users!disputes_opened_by_fkey(id, full_name, email)
      `, { count: 'exact' });

    if (!isAdmin) {
      // Users can only see disputes on their orders
      query = query.or(
        `order_id.in.(${adminClient
          .from('orders')
          .select('id')
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        })`
      );
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (error) throw error;

    return NextResponse.json({
      data,
      total: count ?? 0,
      page,
      per_page: perPage,
      has_more: (count ?? 0) > page * perPage,
    });
  } catch (error) {
    console.error('[GET DISPUTES] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
  }
}
