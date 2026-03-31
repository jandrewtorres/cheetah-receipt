// src/lib/stripe/index.ts
// Stripe Connect marketplace payment logic.
// Flow: Buyer pays → Cheetah holds → Transfer 90% to seller on completion.

import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

const PLATFORM_FEE_PERCENT = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? 0.10);

// ─── SELLER CONNECT ACCOUNT ───────────────────────────────────────────────────

/**
 * Create a Stripe Connect Express account for a seller.
 * Returns the account ID to store on the user record.
 */
export async function createSellerAccount(params: {
  email: string;
  userId: string;
}): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'express',
    email: params.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { supabase_user_id: params.userId },
  });
  return account.id;
}

/**
 * Generate an onboarding link for a seller to set up their Stripe account.
 */
export async function createOnboardingLink(params: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: params.accountId,
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
    type: 'account_onboarding',
  });
  return link.url;
}

/**
 * Get seller's Stripe account status.
 */
export async function getSellerAccountStatus(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    requirements: account.requirements,
  };
}

// ─── BUYER — STRIPE CUSTOMER ──────────────────────────────────────────────────

/**
 * Create or retrieve a Stripe customer for a buyer.
 */
export async function getOrCreateCustomer(params: {
  email: string;
  userId: string;
  existingCustomerId?: string | null;
}): Promise<string> {
  if (params.existingCustomerId) {
    return params.existingCustomerId;
  }
  const customer = await stripe.customers.create({
    email: params.email,
    metadata: { supabase_user_id: params.userId },
  });
  return customer.id;
}

// ─── PAYMENT INTENT ───────────────────────────────────────────────────────────

/**
 * Create a PaymentIntent for a receipt purchase.
 * Uses Stripe Connect destination charges.
 * Buyer pays full amount → Cheetah takes 10% → 90% goes to seller.
 */
export async function createPaymentIntent(params: {
  listingPriceUsd: number;   // e.g. 9.99
  sellerAccountId: string;
  buyerCustomerId: string;
  receiptId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
}): Promise<{
  clientSecret: string;
  paymentIntentId: string;
  platformFee: number;
  sellerPayout: number;
}> {
  const amountCents = Math.round(params.listingPriceUsd * 100);
  const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_PERCENT);
  const sellerPayoutCents = amountCents - platformFeeCents;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: params.buyerCustomerId,
    // Destination charge: funds go to connected account after platform fee
    transfer_data: {
      destination: params.sellerAccountId,
      amount: sellerPayoutCents,
    },
    application_fee_amount: platformFeeCents,
    automatic_payment_methods: { enabled: true },
    metadata: {
      receipt_id: params.receiptId,
      order_id: params.orderId,
      buyer_id: params.buyerId,
      seller_id: params.sellerId,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
    platformFee: platformFeeCents / 100,
    sellerPayout: sellerPayoutCents / 100,
  };
}

// ─── REFUND ───────────────────────────────────────────────────────────────────

/**
 * Issue a full or partial refund on a payment intent.
 * Also reverses the transfer to the seller.
 */
export async function issueRefund(params: {
  paymentIntentId: string;
  amountCents?: number;  // undefined = full refund
  reason: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: params.amountCents,
    reason: params.reason,
    reverse_transfer: true,
    refund_application_fee: true,
  });
}

// ─── WEBHOOK VERIFICATION ─────────────────────────────────────────────────────

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

// ─── DASHBOARD LINK ───────────────────────────────────────────────────────────

/**
 * Generate a Stripe Express dashboard login link for a seller.
 */
export async function getSellerDashboardLink(accountId: string): Promise<string> {
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}
