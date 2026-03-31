// src/app/api/receipts/scan/route.ts
// POST /api/receipts/scan
// Accepts image upload, runs OCR, runs fraud scoring, saves draft receipt.
// Returns OCR result with per-field confidence + list of fields needing manual review.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { scanReceipt } from '@/lib/ocr/engine';
import { scoreReceipt, hashImage } from '@/lib/fraud/scorer';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60; // 60s timeout for OCR
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────────────────────────
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Rate limiting ───────────────────────────────────────────────────────
    const rateCheck = checkRateLimit(`scan:${user.id}`, RATE_LIMITS.scan);
    if (!rateCheck.allowed) {
      const retryMins = Math.ceil((rateCheck.retryAfter ?? 0) / 60000);
      return NextResponse.json(
        { error: `Scan limit reached (10/hour). Try again in ${retryMins} minutes.`, code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    // ── Parse multipart form data ───────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload JPEG, PNG, WEBP, HEIC, or PDF.' }, { status: 400 });
    }

    // Validate file size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 20MB.' }, { status: 400 });
    }

    // ── Convert to base64 ───────────────────────────────────────────────────
    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const base64 = Buffer.from(uint8).toString('base64');
    const imageHash = hashImage(base64);

    let mimeType = file.type;

    // For HEIC, we'd convert to JPEG here in production
    // npm install heic-convert
    // if (file.type === 'image/heic') { ... convert ... }

    // For PDF, extract first page
    // if (file.type === 'application/pdf') { base64 = await extractFirstPageFromPdf(...) }

    // ── Run OCR ─────────────────────────────────────────────────────────────
    console.log(`[OCR] Starting scan for user ${user.id}, file: ${file.name}`);
    const ocrResult = await scanReceipt(base64, mimeType);
    console.log(`[OCR] Complete. Confidence: ${ocrResult.overall_confidence}%, Fields needing review: ${ocrResult.fields_needing_review.length}`);

    // ── Run fraud scoring ───────────────────────────────────────────────────
    const fraudScore = await scoreReceipt({
      imageBase64: base64,
      ocrResult,
      sellerId: user.id,
    });
    console.log(`[FRAUD] Score: ${fraudScore.score}, Risk: ${fraudScore.risk}, Recommendation: ${fraudScore.recommendation}`);

    // Reject if critical fraud detected
    if (fraudScore.recommendation === 'reject') {
      return NextResponse.json({
        error: 'This receipt could not be accepted.',
        fraud_flags: fraudScore.flags.map(f => f.description),
        code: 'FRAUD_REJECTED',
      }, { status: 422 });
    }

    // ── Upload image to Supabase Storage ────────────────────────────────────
    const adminClient = createAdminClient();
    const fileName = `${user.id}/${uuidv4()}.${file.type.split('/')[1] || 'jpg'}`;

    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('receipts')
      .upload(fileName, uint8, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[STORAGE] Upload failed:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image.' }, { status: 500 });
    }

    // Get signed URL for the receipt (private bucket)
    const { data: signedUrl } = await adminClient.storage
      .from('receipts')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

    const imageUrl = signedUrl?.signedUrl ?? '';

    // ── Save draft receipt ──────────────────────────────────────────────────
    const receiptStatus = fraudScore.recommendation === 'review' ? 'pending_review' : 'draft';

    const { data: receipt, error: receiptError } = await adminClient
      .from('receipts')
      .insert({
        seller_id: user.id,
        // OCR fields (null if not extracted)
        store_name: ocrResult.store_name.value ?? 'Unknown Store',
        store_chain: ocrResult.store_chain.value,
        store_number: ocrResult.store_number.value,
        store_address: ocrResult.store_address.value,
        store_city: ocrResult.store_city.value,
        store_state: ocrResult.store_state.value,
        store_zip: ocrResult.store_zip.value,
        purchase_date: ocrResult.purchase_date.value ?? new Date().toISOString().split('T')[0],
        return_by_date: ocrResult.return_by_date.value,
        return_policy_days: ocrResult.return_policy_days.value,
        subtotal: ocrResult.subtotal.value ?? 0,
        tax: ocrResult.tax.value ?? 0,
        total: ocrResult.total.value ?? 0,
        payment_method: ocrResult.payment_method.value,
        last4: ocrResult.last4.value,
        listing_price: 0,  // to be set by seller
        status: receiptStatus,
        category: 'General',
        ocr_confidence: ocrResult.overall_confidence,
        ocr_raw: ocrResult as unknown as Record<string, unknown>,
        image_url: imageUrl,
        image_hash: imageHash,
        fraud_score: fraudScore.score,
        fraud_flags: fraudScore.flags.map(f => f.code),
        fraud_risk: fraudScore.risk,
        ...(fraudScore.recommendation === 'review' && {
          flagged_reason: fraudScore.flags.map(f => f.description).join('; '),
        }),
      })
      .select()
      .single();

    if (receiptError || !receipt) {
      console.error('[DB] Receipt insert failed:', receiptError);
      return NextResponse.json({ error: 'Failed to save receipt.' }, { status: 500 });
    }

    // ── Save receipt items ──────────────────────────────────────────────────
    if (ocrResult.items.length > 0) {
      const itemsToInsert = ocrResult.items.map(item => ({
        receipt_id: receipt.id,
        name: item.name.value ?? 'Unknown Item',
        upc: item.upc.value,
        barcode: item.barcode.value,
        barcode_type: item.barcode_type.value,
        quantity: item.quantity.value ?? 1,
        unit_price: item.unit_price.value ?? 0,
        total_price: item.total_price.value ?? 0,
        sku: item.sku.value,
        department: item.department.value,
        ocr_confidence: item.name.confidence,
        needs_manual_review: item.name.needs_review,
      }));

      await adminClient.from('receipt_items').insert(itemsToInsert);
    }

    // ── Return result ───────────────────────────────────────────────────────
    return NextResponse.json({
      data: {
        receipt_id: receipt.id,
        ocr: ocrResult,
        fraud: {
          score: fraudScore.score,
          risk: fraudScore.risk,
          flags: fraudScore.flags,
          needs_review: fraudScore.recommendation === 'review',
        },
        fields_needing_review: ocrResult.fields_needing_review,
        needs_manual_input: ocrResult.fields_needing_review.length > 0,
        overall_confidence: ocrResult.overall_confidence,
        status: receiptStatus,
      },
    });
  } catch (error) {
    console.error('[SCAN] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Scan failed. Please try again or use a clearer image.' },
      { status: 500 }
    );
  }
}
