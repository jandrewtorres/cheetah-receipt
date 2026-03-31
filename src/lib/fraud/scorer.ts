// src/lib/fraud/scorer.ts
// Receipt fraud detection engine.
// Produces a 0-100 risk score + specific fraud flags.

import CryptoJS from 'crypto-js';
import { createAdminClient } from '@/lib/supabase/server';
import { FraudScore, FraudFlag, OcrResult } from '@/types';

// ─── THRESHOLDS ───────────────────────────────────────────────────────────────
const SCORE_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
};

// ─── MAIN SCORER ──────────────────────────────────────────────────────────────

export async function scoreReceipt(params: {
  imageBase64: string;
  ocrResult: OcrResult;
  sellerId: string;
}): Promise<FraudScore> {
  const { imageBase64, ocrResult, sellerId } = params;
  const flags: FraudFlag[] = [];
  let score = 0;

  const supabase = createAdminClient();

  // ── Check 1: Duplicate image hash ─────────────────────────────────────────
  const imageHash = CryptoJS.SHA256(imageBase64).toString();
  const { data: dupeImage } = await supabase
    .from('receipts')
    .select('id, seller_id')
    .eq('image_hash', imageHash)
    .not('status', 'eq', 'removed')
    .single();

  if (dupeImage) {
    flags.push({
      code: 'DUPLICATE_IMAGE',
      severity: 'high',
      description: 'This exact receipt image has already been uploaded.',
    });
    score += 40;
  }

  // ── Check 2: Duplicate UPCs across receipts ────────────────────────────────
  const upcList = ocrResult.items
    .map(i => i.upc.value)
    .filter(Boolean) as string[];

  if (upcList.length > 0) {
    // Check if same UPC combo + store + date already exists on another seller's receipt
    const { data: dupeItems } = await supabase
      .from('receipt_items')
      .select('receipt_id')
      .in('upc', upcList)
      .limit(20);

    const dupeReceiptIds = [...new Set((dupeItems ?? []).map((r: any) => r.receipt_id))];

    let suspiciousDupes: any[] = [];
    if (dupeReceiptIds.length > 0) {
      const { data: dupeReceipts } = await supabase
        .from('receipts')
        .select('id, store_name, purchase_date, seller_id')
        .in('id', dupeReceiptIds)
        .neq('seller_id', sellerId)
        .limit(10);

      suspiciousDupes = (dupeReceipts ?? []).filter((r: any) =>
        r.purchase_date === ocrResult.purchase_date.value &&
        r.store_name === ocrResult.store_name.value
      );
    }

    if (suspiciousDupes.length >= 3) {
      flags.push({
        code: 'DUPLICATE_UPCS',
        severity: 'high',
        description: `${suspiciousDupes.length} items with same UPCs found on another receipt from the same store & date.`,
      });
      score += 30;
    }
  }

  // ── Check 3: Invalid UPC format ────────────────────────────────────────────
  const invalidUpcs = ocrResult.items.filter(item => {
    const upc = item.upc.value;
    if (!upc) return false;
    const digits = upc.replace(/\D/g, '');
    // Valid lengths: UPC-A=12, UPC-E=6/8, EAN-13=13, EAN-8=8
    const validLengths = [6, 8, 12, 13];
    return !validLengths.includes(digits.length);
  });

  if (invalidUpcs.length > 0) {
    flags.push({
      code: 'INVALID_UPC_FORMAT',
      severity: 'medium',
      description: `${invalidUpcs.length} item(s) have UPC codes with invalid format.`,
    });
    score += 10 * Math.min(invalidUpcs.length, 3);
  }

  // ── Check 4: Seller listing too many receipts too fast ─────────────────────
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const { count: recentListings } = await supabase
    .from('receipts')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .gte('created_at', oneDayAgo);

  if ((recentListings ?? 0) > 20) {
    flags.push({
      code: 'HIGH_VELOCITY',
      severity: 'medium',
      description: `Seller has listed ${recentListings} receipts in the last 24 hours.`,
    });
    score += 15;
  }

  // ── Check 5: Future purchase date ─────────────────────────────────────────
  if (ocrResult.purchase_date.value) {
    const purchaseDate = new Date(ocrResult.purchase_date.value);
    const now = new Date();
    if (purchaseDate > now) {
      flags.push({
        code: 'FUTURE_DATE',
        severity: 'high',
        description: 'Receipt purchase date is in the future.',
      });
      score += 35;
    }
    // Very old receipt (>2 years)
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    if (purchaseDate < twoYearsAgo) {
      flags.push({
        code: 'OLD_RECEIPT',
        severity: 'low',
        description: 'Receipt is more than 2 years old.',
      });
      score += 5;
    }
  }

  // ── Check 6: Math verification ────────────────────────────────────────────
  if (
    ocrResult.subtotal.value !== null &&
    ocrResult.tax.value !== null &&
    ocrResult.total.value !== null
  ) {
    const computedTotal = ocrResult.subtotal.value + ocrResult.tax.value;
    const diff = Math.abs(computedTotal - ocrResult.total.value);
    if (diff > 0.10) {
      flags.push({
        code: 'MATH_MISMATCH',
        severity: 'medium',
        description: `Subtotal + tax ($${computedTotal.toFixed(2)}) does not match total ($${ocrResult.total.value.toFixed(2)}).`,
      });
      score += 20;
    }
  }

  // ── Check 7: Item total verification ──────────────────────────────────────
  const itemsWithPrices = ocrResult.items.filter(i => i.total_price.value !== null);
  if (itemsWithPrices.length > 0 && ocrResult.subtotal.value !== null) {
    const itemSum = itemsWithPrices.reduce((sum, i) => sum + (i.total_price.value ?? 0), 0);
    const diff = Math.abs(itemSum - ocrResult.subtotal.value);
    if (diff > 1.00 && itemsWithPrices.length === ocrResult.items.length) {
      flags.push({
        code: 'ITEM_SUM_MISMATCH',
        severity: 'low',
        description: `Sum of line items ($${itemSum.toFixed(2)}) differs from subtotal ($${ocrResult.subtotal.value.toFixed(2)}).`,
      });
      score += 10;
    }
  }

  // ── Check 8: Very low OCR confidence ──────────────────────────────────────
  if (ocrResult.overall_confidence < 50) {
    flags.push({
      code: 'LOW_OCR_CONFIDENCE',
      severity: 'medium',
      description: `Overall OCR confidence is only ${ocrResult.overall_confidence}% — receipt may be unclear or manipulated.`,
    });
    score += 15;
  }

  // ── Check 9: Seller account age ────────────────────────────────────────────
  const { data: seller } = await supabase
    .from('users')
    .select('created_at, total_sales, is_verified')
    .eq('id', sellerId)
    .single();

  if (seller) {
    const accountAgeDays = (Date.now() - new Date(seller.created_at).getTime()) / 86400000;
    if (accountAgeDays < 1 && seller.total_sales === 0) {
      flags.push({
        code: 'NEW_ACCOUNT',
        severity: 'low',
        description: 'Seller account created less than 24 hours ago with no sales history.',
      });
      score += 5;
    }
  }

  // ── Cap score at 100 ──────────────────────────────────────────────────────
  score = Math.min(100, score);

  const risk =
    score >= SCORE_THRESHOLDS.high ? 'high' :
    score >= SCORE_THRESHOLDS.medium ? 'medium' :
    score >= SCORE_THRESHOLDS.low ? 'low' : 'low';

  // Critical override for certain combinations
  const isCritical =
    flags.some(f => f.code === 'DUPLICATE_IMAGE') &&
    flags.some(f => f.code === 'FUTURE_DATE');

  return {
    score,
    risk: isCritical ? 'critical' : risk,
    flags,
    recommendation:
      isCritical || score >= 75 ? 'reject' :
      score >= 40 ? 'review' :
      'approve',
  };
}

export function hashImage(base64: string): string {
  return CryptoJS.SHA256(base64).toString();
}
