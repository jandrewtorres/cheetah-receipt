-- ============================================================
-- CHEETAH RECEIPTS — MIGRATION 002
-- Helper functions, views, and admin seed
-- ============================================================

-- ─── INCREMENT RECEIPT VIEWS ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_receipt_views(p_receipt_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE receipts SET views = views + 1 WHERE id = p_receipt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── INCREMENT SELLER STATS ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_seller_stats(p_seller_id UUID, p_payout DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET
    total_sales  = total_sales + 1,
    total_earned = total_earned + p_payout
  WHERE id = p_seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── MARKETPLACE SEARCH VIEW ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW marketplace_receipts AS
SELECT
  r.id,
  r.store_name,
  r.store_chain,
  r.store_number,
  r.store_city,
  r.store_state,
  r.purchase_date,
  r.return_by_date,
  r.total,
  r.listing_price,
  r.category,
  r.views,
  r.watchers,
  r.fraud_risk,
  r.created_at,
  u.full_name      AS seller_name,
  u.seller_rating,
  u.total_sales    AS seller_sales,
  u.is_verified    AS seller_verified,
  COUNT(ri.id)     AS item_count
FROM receipts r
JOIN users u ON u.id = r.seller_id
LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
WHERE r.status = 'active'
GROUP BY r.id, u.full_name, u.seller_rating, u.total_sales, u.is_verified;

-- ─── ADMIN STATS VIEW ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW admin_stats AS
SELECT
  (SELECT COUNT(*) FROM receipts)                              AS total_receipts,
  (SELECT COUNT(*) FROM receipts WHERE status = 'active')      AS active_receipts,
  (SELECT COUNT(*) FROM receipts WHERE status = 'pending_review') AS pending_review,
  (SELECT COUNT(*) FROM receipts WHERE status = 'flagged')     AS flagged_receipts,
  (SELECT COUNT(*) FROM users)                                 AS total_users,
  (SELECT COUNT(*) FROM orders WHERE status IN ('paid','completed')) AS total_orders,
  (SELECT COALESCE(SUM(platform_fee),0) FROM orders WHERE status IN ('paid','completed')) AS total_revenue,
  (SELECT COUNT(*) FROM disputes WHERE status = 'open')        AS open_disputes;

-- ─── SELLER DASHBOARD VIEW ───────────────────────────────────────────────────
CREATE OR REPLACE VIEW seller_dashboard AS
SELECT
  u.id                                                          AS seller_id,
  u.full_name,
  u.seller_rating,
  u.total_sales,
  u.total_earned,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'active')      AS active_listings,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'draft')       AS draft_listings,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'paid')        AS pending_payouts,
  COALESCE(SUM(o.seller_payout) FILTER (WHERE o.status = 'paid'), 0) AS pending_payout_amount
FROM users u
LEFT JOIN receipts r ON r.seller_id = u.id
LEFT JOIN orders   o ON o.seller_id = u.id
WHERE u.role IN ('seller', 'admin')
GROUP BY u.id;

-- ─── FULL TEXT SEARCH INDEX ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_receipts_fts ON receipts
USING GIN(to_tsvector('english',
  COALESCE(store_name,'') || ' ' ||
  COALESCE(store_chain,'') || ' ' ||
  COALESCE(store_city,'') || ' ' ||
  COALESCE(category,'')
));

CREATE INDEX IF NOT EXISTS idx_receipt_items_fts ON receipt_items
USING GIN(to_tsvector('english', COALESCE(name,'')));

-- ─── FULL TEXT SEARCH FUNCTION ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_receipts(
  p_query     TEXT,
  p_category  TEXT DEFAULT NULL,
  p_min_price DECIMAL DEFAULT NULL,
  p_max_price DECIMAL DEFAULT NULL,
  p_limit     INT DEFAULT 24,
  p_offset    INT DEFAULT 0
)
RETURNS SETOF receipts AS $$
BEGIN
  RETURN QUERY
  SELECT r.* FROM receipts r
  WHERE
    r.status = 'active'
    AND (p_query IS NULL OR to_tsvector('english', COALESCE(r.store_name,'') || ' ' || COALESCE(r.store_chain,'')) @@ plainto_tsquery('english', p_query))
    AND (p_category IS NULL OR r.category = p_category)
    AND (p_min_price IS NULL OR r.listing_price >= p_min_price)
    AND (p_max_price IS NULL OR r.listing_price <= p_max_price)
  ORDER BY
    CASE WHEN p_query IS NOT NULL THEN
      ts_rank(to_tsvector('english', COALESCE(r.store_name,'') || ' ' || COALESCE(r.store_chain,'')), plainto_tsquery('english', p_query))
    ELSE 0 END DESC,
    r.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ─── SEED: CREATE ADMIN USER ──────────────────────────────────────────────────
-- Run this AFTER creating your account via the app.
-- Replace 'your-user-id' with your actual Supabase auth user ID.
--
-- UPDATE users SET role = 'admin' WHERE email = 'admin@cheetahreceipts.com';
