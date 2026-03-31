// ─── DATABASE TYPES ───────────────────────────────────────────────────────────

export type UserRole = 'buyer' | 'seller' | 'admin';
export type ReceiptStatus = 'draft' | 'pending_review' | 'active' | 'sold' | 'removed' | 'flagged';
export type OrderStatus = 'pending' | 'paid' | 'delivered' | 'disputed' | 'refunded' | 'completed';
export type DisputeStatus = 'open' | 'seller_responded' | 'under_review' | 'resolved_buyer' | 'resolved_seller' | 'closed';
export type NotificationType = 'sale' | 'purchase' | 'dispute_opened' | 'dispute_update' | 'dispute_resolved' | 'payout' | 'listing_flagged' | 'listing_approved' | 'system';
export type FraudRisk = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  stripe_account_id: string | null;    // Stripe Connect account
  stripe_customer_id: string | null;   // Stripe customer
  expo_push_token: string | null;
  seller_rating: number;
  buyer_rating: number;
  total_sales: number;
  total_purchases: number;
  is_verified: boolean;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  seller_id: string;
  seller?: User;

  // Store info (OCR extracted)
  store_name: string;
  store_chain: string | null;
  store_number: string | null;
  store_address: string | null;
  store_city: string | null;
  store_state: string | null;
  store_zip: string | null;

  // Dates
  purchase_date: string;
  return_by_date: string | null;
  return_policy_days: number | null;

  // Financials
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string | null;
  last4: string | null;               // last 4 of card used

  // Listing
  listing_price: number;
  status: ReceiptStatus;
  category: string;
  views: number;
  watchers: number;

  // OCR metadata
  ocr_confidence: number;             // 0-100
  ocr_raw: Record<string, unknown> | null;
  image_url: string;
  image_hash: string;                 // for duplicate detection

  // Fraud
  fraud_score: number;                // 0-100, higher = more risky
  fraud_flags: string[];
  fraud_risk: FraudRisk;

  // Moderation
  flagged_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;

  created_at: string;
  updated_at: string;

  // Relations
  items?: ReceiptItem[];
  order?: Order;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  name: string;
  upc: string | null;
  barcode: string | null;
  barcode_type: string | null;  // UPC-A, UPC-E, EAN-13, QR, etc.
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string | null;
  sku: string | null;
  department: string | null;
  is_on_sale: boolean;
  sale_price: number | null;
  ocr_confidence: number;       // per-item confidence
  needs_manual_review: boolean; // flagged for manual input
  created_at: string;
}

export interface Order {
  id: string;
  receipt_id: string;
  buyer_id: string;
  seller_id: string;
  receipt?: Receipt;
  buyer?: User;
  seller?: User;

  // Financials
  amount: number;               // listing price
  platform_fee: number;         // 10%
  seller_payout: number;        // 90%
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;

  status: OrderStatus;

  // Delivery (receipt data unlocked on payment)
  delivered_at: string | null;
  completed_at: string | null;

  // Rating
  buyer_rated: boolean;
  seller_rated: boolean;
  buyer_rating: number | null;
  seller_rating: number | null;
  buyer_review: string | null;
  seller_review: string | null;

  created_at: string;
  updated_at: string;

  // Relations
  dispute?: Dispute;
}

export interface Dispute {
  id: string;
  order_id: string;
  order?: Order;
  opened_by: string;            // user id
  opened_by_user?: User;

  reason: string;
  description: string;
  evidence_urls: string[];

  status: DisputeStatus;
  resolution: string | null;
  resolved_by: string | null;   // admin user id
  resolved_at: string | null;
  refund_amount: number | null;

  messages?: DisputeMessage[];
  created_at: string;
  updated_at: string;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  sender?: User;
  message: string;
  attachments: string[];
  is_admin: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  sent_push: boolean;
  sent_email: boolean;
  created_at: string;
}

export interface SellerPayout {
  id: string;
  seller_id: string;
  seller?: User;
  order_id: string;
  amount: number;
  stripe_transfer_id: string;
  status: 'pending' | 'paid' | 'failed';
  paid_at: string | null;
  created_at: string;
}

// ─── OCR TYPES ────────────────────────────────────────────────────────────────

export interface OcrField<T = string> {
  value: T | null;
  confidence: number;           // 0-100
  needs_review: boolean;        // true if confidence < threshold
  raw: string | null;           // raw extracted text
}

export interface OcrResult {
  // Store
  store_name: OcrField;
  store_chain: OcrField;
  store_number: OcrField;
  store_address: OcrField;
  store_city: OcrField;
  store_state: OcrField;
  store_zip: OcrField;

  // Dates
  purchase_date: OcrField;
  return_by_date: OcrField;
  return_policy_days: OcrField<number>;

  // Financials
  subtotal: OcrField<number>;
  tax: OcrField<number>;
  total: OcrField<number>;
  payment_method: OcrField;
  last4: OcrField;

  // Items
  items: OcrItemResult[];

  // Meta
  overall_confidence: number;
  fields_needing_review: string[];
  raw_text: string;
  processing_ms: number;
}

export interface OcrItemResult {
  name: OcrField;
  upc: OcrField;
  barcode: OcrField;
  barcode_type: OcrField;
  quantity: OcrField<number>;
  unit_price: OcrField<number>;
  total_price: OcrField<number>;
  sku: OcrField;
  department: OcrField;
}

// ─── FRAUD TYPES ──────────────────────────────────────────────────────────────

export interface FraudScore {
  score: number;                // 0-100
  risk: FraudRisk;
  flags: FraudFlag[];
  recommendation: 'approve' | 'review' | 'reject';
}

export interface FraudFlag {
  code: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// ─── API RESPONSE TYPES ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface MarketplaceFilters {
  search?: string;
  category?: string;
  store?: string;
  min_price?: number;
  max_price?: number;
  min_total?: number;
  max_total?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'ending_soon' | 'highest_value' | 'most_watched';
  page?: number;
  per_page?: number;
}

// ─── FORM TYPES ───────────────────────────────────────────────────────────────

export interface ManualReviewField {
  field: string;
  label: string;
  currentValue: string | null;
  confidence: number;
  required: boolean;
}

export interface ListingFormData {
  listing_price: number;
  category: string;
}
