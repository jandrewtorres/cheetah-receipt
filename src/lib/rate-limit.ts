// src/lib/rate-limit.ts
// Simple in-memory rate limiter for API routes.
// Uses a sliding window per user ID.
// For production at scale, swap the Map for Redis (e.g. Upstash).

interface RateLimitEntry {
  count:     number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  /** Max requests allowed per window */
  limit:  number;
  /** Window size in milliseconds */
  window: number;
}

/**
 * Check whether a key (user ID, IP, etc.) has exceeded its rate limit.
 * Returns { allowed: true } or { allowed: false, retryAfter: ms }.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now    = Date.now();
  const entry  = store.get(key);

  if (!entry || now - entry.windowStart >= config.window) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.limit - 1 };
  }

  if (entry.count >= config.limit) {
    const retryAfter = config.window - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfter };
  }

  entry.count += 1;
  return { allowed: true, remaining: config.limit - entry.count };
}

// Preconfigured limiters
export const RATE_LIMITS = {
  /** OCR scan: max 10 per user per hour */
  scan:     { limit: 10, window: 60 * 60 * 1000 },
  /** Order creation: max 20 per user per hour */
  orders:   { limit: 20, window: 60 * 60 * 1000 },
  /** Dispute creation: max 5 per user per day */
  disputes: { limit: 5,  window: 24 * 60 * 60 * 1000 },
  /** Auth endpoints: max 10 attempts per 15 minutes */
  auth:     { limit: 10, window: 15 * 60 * 1000 },
};
