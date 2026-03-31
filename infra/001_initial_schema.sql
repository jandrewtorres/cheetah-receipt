-- ============================================================
-- CHEETAH RECEIPTS — COMPLETE DATABASE SCHEMA
-- Run: supabase db push
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fuzzy search

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
CREATE TYPE receipt_status AS ENUM ('draft', 'pending_review', 'active', 'sold', 'removed', 'flagged');
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'delivered', 'disputed', 'refunded', 'completed');
CREATE TYPE dispute_status AS ENUM ('open', 'seller_responded', 'under_review', 'resolved_buyer', 'resolved_seller', 'closed');
CREATE TYPE notification_type AS ENUM ('sale', 'purchase', 'dispute_opened', 'dispute_update', 'dispute_resolved', 'payout', 'listing_flagged', 'listing_approved', 'system');
CREATE TYPE fraud_risk AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE payout_status AS ENUM ('pending', 'paid', 'failed');

-- ─── USERS ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT UNIQUE NOT NULL,
  full_name           TEXT,
  avatar_url          TEXT,
  role                user_role DEFAULT 'buyer',
  stripe_account_id   TEXT UNIQUE,   -- Stripe Connect Express account
  stripe_customer_id  TEXT UNIQUE,   -- Stripe customer for buying
  expo_push_token     TEXT,
  seller_rating       DECIMAL(3,2) DEFAULT 0 CHECK (seller_rating >= 0 AND seller_rating <= 5),
  buyer_rating        DECIMAL(3,2) DEFAULT 0 CHECK (buyer_rating >= 0 AND buyer_rating <= 5),
  seller_rating_count INT DEFAULT 0,
  buyer_rating_count  INT DEFAULT 0,
  total_sales         INT DEFAULT 0,
  total_purchases     INT DEFAULT 0,
  total_earned        DECIMAL(10,2) DEFAULT 0,
  total_spent         DECIMAL(10,2) DEFAULT 0,
  is_verified         BOOLEAN DEFAULT false,
  is_suspended        BOOLEAN DEFAULT false,
  suspension_reason   TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RECEIPTS ─────────────────────────────────────────────────────────────────

CREATE TABLE receipts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Store info
  store_name           TEXT NOT NULL,
  store_chain          TEXT,
  store_number         TEXT,
  store_address        TEXT,
  store_city           TEXT,
  store_state          TEXT,
  store_zip            TEXT,

  -- Dates
  purchase_date        DATE NOT NULL,
  return_by_date       DATE,
  return_policy_days   INT,

  -- Financials
  subtotal             DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax                  DECIMAL(10,2) NOT NULL DEFAULT 0,
  total                DECIMAL(10,2) NOT NULL,
  payment_method       TEXT,
  last4                TEXT,

  -- Listing
  listing_price        DECIMAL(10,2) NOT NULL,
  status               receipt_status DEFAULT 'draft',
  category             TEXT NOT NULL DEFAULT 'General',
  views                INT DEFAULT 0,
  watchers             INT DEFAULT 0,

  -- OCR metadata
  ocr_confidence       INT DEFAULT 0 CHECK (ocr_confidence >= 0 AND ocr_confidence <= 100),
  ocr_raw              JSONB,
  image_url            TEXT NOT NULL,
  image_hash           TEXT NOT NULL,  -- SHA256 for duplicate detection

  -- Fraud
  fraud_score          INT DEFAULT 0 CHECK (fraud_score >= 0 AND fraud_score <= 100),
  fraud_flags          TEXT[] DEFAULT '{}',
  fraud_risk           fraud_risk DEFAULT 'low',

  -- Moderation
  flagged_reason       TEXT,
  reviewed_by          UUID REFERENCES users(id),
  reviewed_at          TIMESTAMPTZ,

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RECEIPT ITEMS ────────────────────────────────────────────────────────────

CREATE TABLE receipt_items (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id           UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  upc                  TEXT,
  barcode              TEXT,
  barcode_type         TEXT,          -- UPC-A, UPC-E, EAN-13, QR, etc.
  quantity             INT DEFAULT 1,
  unit_price           DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price          DECIMAL(10,2) NOT NULL DEFAULT 0,
  category             TEXT,
  sku                  TEXT,
  department           TEXT,
  is_on_sale           BOOLEAN DEFAULT false,
  sale_price           DECIMAL(10,2),
  ocr_confidence       INT DEFAULT 100 CHECK (ocr_confidence >= 0 AND ocr_confidence <= 100),
  needs_manual_review  BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ORDERS ───────────────────────────────────────────────────────────────────

CREATE TABLE orders (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id                  UUID NOT NULL REFERENCES receipts(id),
  buyer_id                    UUID NOT NULL REFERENCES users(id),
  seller_id                   UUID NOT NULL REFERENCES users(id),

  -- Financials
  amount                      DECIMAL(10,2) NOT NULL,   -- listing price paid
  platform_fee                DECIMAL(10,2) NOT NULL,   -- 10%
  seller_payout               DECIMAL(10,2) NOT NULL,   -- 90%
  stripe_payment_intent_id    TEXT UNIQUE,
  stripe_transfer_id          TEXT,

  status                      order_status DEFAULT 'pending',
  delivered_at                TIMESTAMPTZ,
  completed_at                TIMESTAMPTZ,

  -- Ratings (filled after completion)
  buyer_rated                 BOOLEAN DEFAULT false,
  seller_rated                BOOLEAN DEFAULT false,
  buyer_rating                INT CHECK (buyer_rating >= 1 AND buyer_rating <= 5),
  seller_rating               INT CHECK (seller_rating >= 1 AND seller_rating <= 5),
  buyer_review                TEXT,
  seller_review               TEXT,

  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DISPUTES ─────────────────────────────────────────────────────────────────

CREATE TABLE disputes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL UNIQUE REFERENCES orders(id),
  opened_by       UUID NOT NULL REFERENCES users(id),
  reason          TEXT NOT NULL,
  description     TEXT NOT NULL,
  evidence_urls   TEXT[] DEFAULT '{}',
  status          dispute_status DEFAULT 'open',
  resolution      TEXT,
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  refund_amount   DECIMAL(10,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dispute_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id  UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id),
  message     TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  is_admin    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  read        BOOLEAN DEFAULT false,
  sent_push   BOOLEAN DEFAULT false,
  sent_email  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SELLER PAYOUTS ───────────────────────────────────────────────────────────

CREATE TABLE seller_payouts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id           UUID NOT NULL REFERENCES users(id),
  order_id            UUID NOT NULL REFERENCES orders(id),
  amount              DECIMAL(10,2) NOT NULL,
  stripe_transfer_id  TEXT UNIQUE,
  status              payout_status DEFAULT 'pending',
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RECEIPT WATCHERS ─────────────────────────────────────────────────────────

CREATE TABLE receipt_watchers (
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  receipt_id  UUID REFERENCES receipts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, receipt_id)
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

-- Receipts
CREATE INDEX idx_receipts_seller_id ON receipts(seller_id);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_category ON receipts(category);
CREATE INDEX idx_receipts_store_chain ON receipts(store_chain);
CREATE INDEX idx_receipts_purchase_date ON receipts(purchase_date);
CREATE INDEX idx_receipts_listing_price ON receipts(listing_price);
CREATE INDEX idx_receipts_fraud_risk ON receipts(fraud_risk);
CREATE INDEX idx_receipts_image_hash ON receipts(image_hash); -- duplicate detection
CREATE INDEX idx_receipts_search ON receipts USING GIN(to_tsvector('english', store_name || ' ' || COALESCE(store_chain, '')));

-- Receipt items
CREATE INDEX idx_receipt_items_receipt_id ON receipt_items(receipt_id);
CREATE INDEX idx_receipt_items_upc ON receipt_items(upc);
CREATE INDEX idx_receipt_items_search ON receipt_items USING GIN(to_tsvector('english', name));

-- Orders
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_receipt_id ON orders(receipt_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_stripe_pi ON orders(stripe_payment_intent_id);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

-- Disputes
CREATE INDEX idx_disputes_order_id ON disputes(order_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_receipts_updated_at BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_disputes_updated_at BEFORE UPDATE ON disputes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── AUTO-CREATE USER PROFILE ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── UPDATE WATCHER COUNT ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_receipt_watchers()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE receipts SET watchers = watchers + 1 WHERE id = NEW.receipt_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE receipts SET watchers = watchers - 1 WHERE id = OLD.receipt_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_receipt_watchers
  AFTER INSERT OR DELETE ON receipt_watchers
  FOR EACH ROW EXECUTE FUNCTION update_receipt_watchers();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_watchers ENABLE ROW LEVEL SECURITY;

-- USERS policies
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view public profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins have full access to users" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- RECEIPTS policies
CREATE POLICY "Anyone can view active receipts" ON receipts FOR SELECT USING (status = 'active');
CREATE POLICY "Sellers can view their own receipts" ON receipts FOR SELECT USING (seller_id = auth.uid());
CREATE POLICY "Sellers can insert receipts" ON receipts FOR INSERT WITH CHECK (seller_id = auth.uid());
CREATE POLICY "Sellers can update their own drafts" ON receipts FOR UPDATE USING (seller_id = auth.uid() AND status IN ('draft', 'pending_review'));
CREATE POLICY "Admins have full receipt access" ON receipts FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- RECEIPT ITEMS policies
CREATE POLICY "Anyone can view items of active receipts" ON receipt_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM receipts WHERE id = receipt_items.receipt_id AND status = 'active')
);
CREATE POLICY "Sellers can manage their receipt items" ON receipt_items FOR ALL USING (
  EXISTS (SELECT 1 FROM receipts WHERE id = receipt_items.receipt_id AND seller_id = auth.uid())
);
CREATE POLICY "Buyers can view items of purchased receipts" ON receipt_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM receipts r
    JOIN orders o ON o.receipt_id = r.id
    WHERE r.id = receipt_items.receipt_id AND o.buyer_id = auth.uid() AND o.status IN ('paid', 'delivered', 'completed')
  )
);

-- ORDERS policies
CREATE POLICY "Buyers can view their orders" ON orders FOR SELECT USING (buyer_id = auth.uid());
CREATE POLICY "Sellers can view their orders" ON orders FOR SELECT USING (seller_id = auth.uid());
CREATE POLICY "Admins have full order access" ON orders FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- DISPUTES policies
CREATE POLICY "Order parties can view disputes" ON disputes FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE id = disputes.order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
);
CREATE POLICY "Buyers can open disputes" ON disputes FOR INSERT WITH CHECK (opened_by = auth.uid());
CREATE POLICY "Admins have full dispute access" ON disputes FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- DISPUTE MESSAGES policies
CREATE POLICY "Dispute parties can view messages" ON dispute_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM disputes d
    JOIN orders o ON o.id = d.order_id
    WHERE d.id = dispute_messages.dispute_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);
CREATE POLICY "Dispute parties can send messages" ON dispute_messages FOR INSERT WITH CHECK (sender_id = auth.uid());

-- NOTIFICATIONS policies
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- SELLER PAYOUTS policies
CREATE POLICY "Sellers can view their payouts" ON seller_payouts FOR SELECT USING (seller_id = auth.uid());
CREATE POLICY "Admins have full payout access" ON seller_payouts FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- RECEIPT WATCHERS policies
CREATE POLICY "Users manage their watches" ON receipt_watchers FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Anyone can count watchers" ON receipt_watchers FOR SELECT USING (true);

-- ─── STORAGE BUCKETS ──────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('receipts', 'receipts', false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('dispute-evidence', 'dispute-evidence', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

-- Storage policies
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Receipt owners can view their uploads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload dispute evidence" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'dispute-evidence');
