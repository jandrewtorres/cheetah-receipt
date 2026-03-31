// src/lib/ocr/engine.ts
// GPT-4o Vision receipt scanning with per-field confidence scores
// and automatic manual review flagging for low-confidence fields.

import OpenAI from 'openai';
import { OcrResult, OcrField, OcrItemResult } from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Fields with confidence below this threshold are flagged for manual review
const MANUAL_REVIEW_THRESHOLD = 75;
const ITEM_REVIEW_THRESHOLD = 70;

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert receipt data extraction AI. Your job is to analyze receipt images and extract structured data with confidence scores.

CRITICAL RULES:
1. Return ONLY valid JSON — no markdown, no explanations, no code blocks.
2. For every field, provide a "value" and a "confidence" (0-100).
3. confidence = 100: perfectly clear, unambiguous text
4. confidence 75-99: clear but minor uncertainty (e.g. smudge near a digit)
5. confidence 50-74: partially legible, reasonable guess
6. confidence 25-49: mostly illegible, uncertain guess
7. confidence 0-24: unreadable, value is null
8. If a field is genuinely not present on the receipt, set value to null and confidence to 100.
9. For dates, always output in YYYY-MM-DD format.
10. For prices, output as numbers only (no $ signs).
11. For UPC/barcodes: extract exactly as printed, no spaces.
12. For store numbers, extract only the numeric/alphanumeric identifier.
13. Extract EVERY line item visible on the receipt, including discounts and fees.
14. If you can see a barcode image but cannot read the number, set confidence to 30.
15. Detect return policy: look for "Return within X days", "Returns accepted until DATE", etc.

BARCODE TYPES: UPC-A (12 digits), UPC-E (6-8 digits), EAN-13 (13 digits), EAN-8 (8 digits), Code 128, QR Code.`;

// ─── JSON SCHEMA FOR GPT RESPONSE ────────────────────────────────────────────
const RESPONSE_SCHEMA = `{
  "store_name": {"value": "string|null", "confidence": 0-100},
  "store_chain": {"value": "string|null", "confidence": 0-100},
  "store_number": {"value": "string|null", "confidence": 0-100},
  "store_address": {"value": "string|null", "confidence": 0-100},
  "store_city": {"value": "string|null", "confidence": 0-100},
  "store_state": {"value": "string|null", "confidence": 0-100},
  "store_zip": {"value": "string|null", "confidence": 0-100},
  "purchase_date": {"value": "YYYY-MM-DD|null", "confidence": 0-100},
  "return_by_date": {"value": "YYYY-MM-DD|null", "confidence": 0-100},
  "return_policy_days": {"value": number|null, "confidence": 0-100},
  "subtotal": {"value": number|null, "confidence": 0-100},
  "tax": {"value": number|null, "confidence": 0-100},
  "total": {"value": number|null, "confidence": 0-100},
  "payment_method": {"value": "CASH|VISA|MASTERCARD|AMEX|DISCOVER|DEBIT|EBT|null", "confidence": 0-100},
  "last4": {"value": "string|null", "confidence": 0-100},
  "items": [
    {
      "name": {"value": "string", "confidence": 0-100},
      "upc": {"value": "string|null", "confidence": 0-100},
      "barcode": {"value": "string|null", "confidence": 0-100},
      "barcode_type": {"value": "UPC-A|UPC-E|EAN-13|EAN-8|Code128|QR|null", "confidence": 0-100},
      "quantity": {"value": number, "confidence": 0-100},
      "unit_price": {"value": number, "confidence": 0-100},
      "total_price": {"value": number, "confidence": 0-100},
      "sku": {"value": "string|null", "confidence": 0-100},
      "department": {"value": "string|null", "confidence": 0-100}
    }
  ],
  "raw_text": "full transcription of all visible text on receipt"
}`;

// ─── MAIN SCAN FUNCTION ───────────────────────────────────────────────────────

export async function scanReceipt(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<OcrResult> {
  const startTime = Date.now();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: `Extract all receipt data and return JSON matching this exact schema:\n${RESPONSE_SCHEMA}\n\nRemember: only valid JSON, no other text.`,
          },
        ],
      },
    ],
  });

  const rawContent = response.choices[0]?.message?.content ?? '';
  const processingMs = Date.now() - startTime;

  // Parse JSON — strip any accidental markdown fences
  let parsed: Record<string, unknown>;
  try {
    const cleaned = rawContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // If GPT returned malformed JSON, return a fully manual-review result
    return buildFailedOcrResult(rawContent, processingMs);
  }

  return buildOcrResult(parsed, processingMs);
}

// ─── BUILD STRUCTURED OCR RESULT ─────────────────────────────────────────────

function buildOcrResult(parsed: Record<string, unknown>, processingMs: number): OcrResult {
  const f = (key: string): OcrField => extractField(parsed, key);
  const fNum = (key: string): OcrField<number> => extractNumericField(parsed, key);

  const items: OcrItemResult[] = ((parsed.items as unknown[]) ?? []).map(
    (item: unknown) => buildItemResult(item as Record<string, unknown>)
  );

  // Compute overall confidence (weighted average of key fields)
  const keyFields = [
    f('store_name'), f('purchase_date'), fNum('total'), f('store_number')
  ];
  const validConfs = keyFields.filter(f => f.value !== null).map(f => f.confidence);
  const overallConfidence = validConfs.length > 0
    ? Math.round(validConfs.reduce((a, b) => a + b, 0) / validConfs.length)
    : 0;

  // Collect all fields needing manual review
  const fieldsNeedingReview: string[] = [];
  const allScalarFields: [string, OcrField][] = [
    ['store_name', f('store_name')],
    ['store_number', f('store_number')],
    ['store_address', f('store_address')],
    ['store_city', f('store_city')],
    ['store_state', f('store_state')],
    ['purchase_date', f('purchase_date')],
    ['return_by_date', f('return_by_date')],
    ['total', fNum('total')],
    ['subtotal', fNum('subtotal')],
    ['tax', fNum('tax')],
  ];
  for (const [name, field] of allScalarFields) {
    if (field.value !== null && field.confidence < MANUAL_REVIEW_THRESHOLD) {
      fieldsNeedingReview.push(name);
    }
    // Required fields with null value also need review
    if (['store_name', 'purchase_date', 'total'].includes(name) && field.value === null) {
      fieldsNeedingReview.push(name);
    }
  }

  return {
    store_name: f('store_name'),
    store_chain: f('store_chain'),
    store_number: f('store_number'),
    store_address: f('store_address'),
    store_city: f('store_city'),
    store_state: f('store_state'),
    store_zip: f('store_zip'),
    purchase_date: f('purchase_date'),
    return_by_date: f('return_by_date'),
    return_policy_days: fNum('return_policy_days'),
    subtotal: fNum('subtotal'),
    tax: fNum('tax'),
    total: fNum('total'),
    payment_method: f('payment_method'),
    last4: f('last4'),
    items,
    overall_confidence: overallConfidence,
    fields_needing_review: [...new Set(fieldsNeedingReview)],
    raw_text: (parsed.raw_text as string) ?? '',
    processing_ms: processingMs,
  };
}

function extractField(parsed: Record<string, unknown>, key: string): OcrField {
  const fieldData = parsed[key] as { value?: unknown; confidence?: number } | undefined;
  if (!fieldData) return { value: null, confidence: 0, needs_review: true, raw: null };
  const confidence = Number(fieldData.confidence ?? 0);
  const value = fieldData.value !== undefined && fieldData.value !== null
    ? String(fieldData.value)
    : null;
  return {
    value,
    confidence,
    needs_review: value !== null && confidence < MANUAL_REVIEW_THRESHOLD,
    raw: value,
  };
}

function extractNumericField(parsed: Record<string, unknown>, key: string): OcrField<number> {
  const fieldData = parsed[key] as { value?: unknown; confidence?: number } | undefined;
  if (!fieldData) return { value: null, confidence: 0, needs_review: true, raw: null };
  const confidence = Number(fieldData.confidence ?? 0);
  const raw = fieldData.value !== null && fieldData.value !== undefined
    ? String(fieldData.value)
    : null;
  const value = raw !== null && raw !== '' ? parseFloat(raw) : null;
  return {
    value: isNaN(value as number) ? null : value,
    confidence,
    needs_review: value !== null && confidence < MANUAL_REVIEW_THRESHOLD,
    raw,
  };
}

function buildItemResult(item: Record<string, unknown>): OcrItemResult {
  const f = (key: string): OcrField => extractField(item, key);
  const fNum = (key: string): OcrField<number> => extractNumericField(item, key);
  const nameField = f('name');
  const upcField = f('upc');
  const priceField = fNum('unit_price');

  // Flag item for manual review if name or price is uncertain
  const needsManualReview =
    (nameField.confidence < ITEM_REVIEW_THRESHOLD && nameField.value !== null) ||
    (priceField.confidence < ITEM_REVIEW_THRESHOLD && priceField.value !== null) ||
    nameField.value === null;

  const result: OcrItemResult = {
    name: nameField,
    upc: f('upc'),
    barcode: f('barcode'),
    barcode_type: f('barcode_type'),
    quantity: fNum('quantity'),
    unit_price: priceField,
    total_price: fNum('total_price'),
    sku: f('sku'),
    department: f('department'),
  };
  // Attach manual review flag to name field for downstream use
  result.name.needs_review = needsManualReview;
  return result;
}

function buildFailedOcrResult(rawContent: string, processingMs: number): OcrResult {
  const nullField: OcrField = { value: null, confidence: 0, needs_review: true, raw: null };
  const nullNumField: OcrField<number> = { value: null, confidence: 0, needs_review: true, raw: null };
  return {
    store_name: nullField,
    store_chain: nullField,
    store_number: nullField,
    store_address: nullField,
    store_city: nullField,
    store_state: nullField,
    store_zip: nullField,
    purchase_date: nullField,
    return_by_date: nullField,
    return_policy_days: nullNumField,
    subtotal: nullNumField,
    tax: nullNumField,
    total: nullNumField,
    payment_method: nullField,
    last4: nullField,
    items: [],
    overall_confidence: 0,
    fields_needing_review: ['store_name', 'purchase_date', 'total'],
    raw_text: rawContent,
    processing_ms: processingMs,
  };
}

// ─── PDF TO IMAGE CONVERSION ──────────────────────────────────────────────────
// For PDF receipts, extract first page as image before scanning

export async function extractFirstPageFromPdf(pdfBuffer: Buffer): Promise<string> {
  // Uses sharp + pdf-to-img in production
  // Placeholder — implement with: npm install pdf-to-img
  // const { pdf } = await import('pdf-to-img');
  // const pages = await pdf(pdfBuffer, { scale: 2 });
  // const firstPage = await pages.next();
  // return firstPage.value.toString('base64');
  throw new Error('PDF extraction: install pdf-to-img package');
}
