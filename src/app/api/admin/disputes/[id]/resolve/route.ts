// src/app/api/admin/disputes/[id]/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { issueRefund } from '@/lib/stripe';
import { notify } from '@/lib/notifications/push';
import { sendDisputeResolvedEmail } from '@/lib/email';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { in_favor_of, resolution } = await req.json() as { in_favor_of: 'buyer' | 'seller'; resolution: string };

  const { data: dispute } = await adminClient.from('disputes')
    .select('*, orders(*, receipts(store_name), buyer:users!orders_buyer_id_fkey(email, full_name), seller:users!orders_seller_id_fkey(email, full_name))')
    .eq('id', params.id).single();

  if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const order = (dispute as any).orders;
  let refundAmount: number | undefined;

  // Issue refund if buyer wins
  if (in_favor_of === 'buyer' && order.stripe_payment_intent_id) {
    try {
      await issueRefund({ paymentIntentId: order.stripe_payment_intent_id, reason: 'requested_by_customer' });
      refundAmount = order.amount;
      await adminClient.from('orders').update({ status: 'refunded' }).eq('id', order.id);
    } catch (err) {
      console.error('[REFUND] Failed:', err);
    }
  } else if (in_favor_of === 'seller') {
    await adminClient.from('orders').update({ status: 'completed' }).eq('id', order.id);
  }

  // Update dispute
  const newStatus = in_favor_of === 'buyer' ? 'resolved_buyer' : 'resolved_seller';
  await adminClient.from('disputes').update({
    status: newStatus,
    resolution,
    resolved_by: user.id,
    resolved_at: new Date().toISOString(),
    refund_amount: refundAmount ?? null,
  }).eq('id', params.id);

  // Notify both parties
  const buyer  = order.buyer;
  const seller = order.seller;
  const storeName = order.receipts?.store_name ?? 'Receipt';

  await Promise.allSettled([
    notify.disputeResolved({ userId: order.buyer_id,  inFavorOf: in_favor_of, disputeId: dispute.id, refundAmount }),
    notify.disputeResolved({ userId: order.seller_id, inFavorOf: in_favor_of, disputeId: dispute.id }),
    buyer  && sendDisputeResolvedEmail({ to: buyer.email,  name: buyer.full_name,  orderId: order.id, disputeId: dispute.id, resolution, inFavorOf: in_favor_of, refundAmount }),
    seller && sendDisputeResolvedEmail({ to: seller.email, name: seller.full_name, orderId: order.id, disputeId: dispute.id, resolution, inFavorOf: in_favor_of }),
  ]);

  return NextResponse.json({ data: { status: newStatus, refund_amount: refundAmount } });
}
