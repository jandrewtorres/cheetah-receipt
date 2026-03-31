// src/app/api/receipts/[id]/list/route.ts
// POST /api/receipts/:id/list
// Publishes a draft receipt to the marketplace with a listing price.
// Validates all required fields are filled, runs final fraud check.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications/push';
import {
  sendListingApprovedEmail,
  sendListingFlaggedEmail,
} from '@/lib/email';
import { z } from 'zod';

const ListSchema = z.object({
  listing_price: z.number().min(0.99).max(999.99),
  category: z.string().min(1).max(50),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch receipt with items
    const { data: receipt } = await adminClient
      .from('receipts')
      .select('*, receipt_items(*)')
      .eq('id', params.id)
      .eq('seller_id', user.id)
      .single();

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    if (!['draft', 'pending_review'].includes(receipt.status)) {
      return NextResponse.json({ error: 'Receipt is not in a listable state' }, { status: 422 });
    }

    // ── Validate required fields ─────────────────────────────────────────────
    const missingFields: string[] = [];
    if (!receipt.store_name) missingFields.push('store_name');
    if (!receipt.purchase_date) missingFields.push('purchase_date');
    if (!receipt.total || receipt.total === 0) missingFields.push('total');

    // Check items needing review
    const pendingItems = (receipt.receipt_items ?? []).filter(
      (i: { needs_manual_review: boolean }) => i.needs_manual_review
    );

    if (missingFields.length > 0 || pendingItems.length > 0) {
      return NextResponse.json({
        error: 'Receipt is missing required information.',
        missing_fields: missingFields,
        items_needing_review: pendingItems.map((i: { id: string; name: string }) => ({ id: i.id, name: i.name })),
        code: 'INCOMPLETE_RECEIPT',
      }, { status: 422 });
    }

    // ── Determine if needs admin review or can go live ───────────────────────
    const needsAdminReview = receipt.fraud_risk === 'medium' || receipt.fraud_risk === 'high';

    const newStatus = needsAdminReview ? 'pending_review' : 'active';

    // ── Update receipt ───────────────────────────────────────────────────────
    const { data: updatedReceipt } = await adminClient
      .from('receipts')
      .update({
        listing_price: parsed.data.listing_price,
        category: parsed.data.category,
        status: newStatus,
      })
      .eq('id', params.id)
      .select()
      .single();

    // ── Get seller email for notifications ───────────────────────────────────
    const { data: seller } = await adminClient
      .from('users')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    // ── Send notifications ───────────────────────────────────────────────────
    if (newStatus === 'active') {
      // Goes live immediately
      await Promise.allSettled([
        notify.listingApproved({
          sellerId: user.id,
          storeName: receipt.store_name,
          receiptId: receipt.id,
        }),
        seller && sendListingApprovedEmail({
          to: seller.email,
          sellerName: seller.full_name ?? 'Seller',
          receiptId: receipt.id,
          storeName: receipt.store_name,
          listingPrice: parsed.data.listing_price,
        }),
      ]);
    } else {
      // Needs review
      await Promise.allSettled([
        notify.listingFlagged({
          sellerId: user.id,
          storeName: receipt.store_name,
          receiptId: receipt.id,
          reason: 'Under review before going live',
        }),
        seller && sendListingFlaggedEmail({
          to: seller.email,
          sellerName: seller.full_name ?? 'Seller',
          receiptId: receipt.id,
          storeName: receipt.store_name,
          reason: 'Requires admin review before going live',
        }),
      ]);
    }

    return NextResponse.json({
      data: {
        receipt: updatedReceipt,
        status: newStatus,
        live: newStatus === 'active',
        message: newStatus === 'active'
          ? 'Your receipt is now live on the marketplace!'
          : 'Your receipt is under review and will go live within 24 hours.',
      },
    });
  } catch (error) {
    console.error('[LIST RECEIPT] Error:', error);
    return NextResponse.json({ error: 'Failed to list receipt' }, { status: 500 });
  }
}
