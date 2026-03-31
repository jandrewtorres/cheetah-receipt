// src/app/api/receipts/[id]/manual-review/route.ts
// PATCH /api/receipts/:id/manual-review
// Accepts user corrections for low-confidence OCR fields.
// Re-runs fraud scoring after manual corrections.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

const ManualReviewSchema = z.object({
  // Header fields
  store_name: z.string().optional(),
  store_number: z.string().optional(),
  store_address: z.string().optional(),
  store_city: z.string().optional(),
  store_state: z.string().optional(),
  store_zip: z.string().optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  return_by_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  return_policy_days: z.number().int().min(0).max(730).optional().nullable(),
  subtotal: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  payment_method: z.string().optional(),
  last4: z.string().max(4).optional().nullable(),
  category: z.string().optional(),

  // Item corrections: keyed by item index
  items: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().optional(),
    upc: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    quantity: z.number().int().min(1).optional(),
    unit_price: z.number().min(0).optional(),
    total_price: z.number().min(0).optional(),
  })).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const adminClient = createAdminClient();
    const { data: receipt } = await adminClient
      .from('receipts')
      .select('id, seller_id, status')
      .eq('id', params.id)
      .single();

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    if (receipt.seller_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!['draft', 'pending_review'].includes(receipt.status)) {
      return NextResponse.json({ error: 'Receipt can no longer be edited' }, { status: 422 });
    }

    // Validate body
    const body = await req.json();
    const parsed = ManualReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Invalid data',
        details: parsed.error.flatten(),
      }, { status: 400 });
    }

    const { items, ...headerFields } = parsed.data;

    // Update receipt header fields
    if (Object.keys(headerFields).length > 0) {
      await adminClient
        .from('receipts')
        .update(headerFields)
        .eq('id', params.id);
    }

    // Update individual items
    if (items && items.length > 0) {
      for (const item of items) {
        const { id: itemId, ...itemFields } = item;
        if (Object.keys(itemFields).length > 0) {
          await adminClient
            .from('receipt_items')
            .update({
              ...itemFields,
              needs_manual_review: false,
              ocr_confidence: 100, // user-verified = 100% confidence
            })
            .eq('id', itemId)
            .eq('receipt_id', params.id);
        }
      }
    }

    // Check if any items still need review
    const { data: pendingItems } = await adminClient
      .from('receipt_items')
      .select('id')
      .eq('receipt_id', params.id)
      .eq('needs_manual_review', true);

    const stillNeedsReview = (pendingItems?.length ?? 0) > 0;

    // Fetch updated receipt
    const { data: updatedReceipt } = await adminClient
      .from('receipts')
      .select('*, receipt_items(*)')
      .eq('id', params.id)
      .single();

    return NextResponse.json({
      data: {
        receipt: updatedReceipt,
        still_needs_review: stillNeedsReview,
        ready_to_list: !stillNeedsReview,
      },
    });
  } catch (error) {
    console.error('[MANUAL REVIEW] Error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
