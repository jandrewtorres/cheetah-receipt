// src/app/api/orders/create/route.ts
// POST /api/orders/create
// Creates an order and Stripe PaymentIntent for a receipt purchase.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  createPaymentIntent,
  getOrCreateCustomer,
} from '@/lib/stripe';
import { z } from 'zod';

const CreateOrderSchema = z.object({
  receipt_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch receipt
    const { data: receipt } = await adminClient
      .from('receipts')
      .select('id, seller_id, listing_price, status, store_name')
      .eq('id', parsed.data.receipt_id)
      .single();

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    if (receipt.status !== 'active') {
      return NextResponse.json({ error: 'This receipt is no longer available.' }, { status: 409 });
    }

    if (receipt.seller_id === user.id) {
      return NextResponse.json({ error: 'You cannot buy your own receipt.' }, { status: 422 });
    }

    // Check no existing pending order for this receipt
    const { data: existingOrder } = await adminClient
      .from('orders')
      .select('id, status')
      .eq('receipt_id', parsed.data.receipt_id)
      .in('status', ['pending', 'paid', 'delivered', 'completed'])
      .single();

    if (existingOrder) {
      return NextResponse.json({ error: 'This receipt has already been sold.' }, { status: 409 });
    }

    // Get buyer and seller info
    const [{ data: buyer }, { data: seller }] = await Promise.all([
      adminClient.from('users').select('email, stripe_customer_id').eq('id', user.id).single(),
      adminClient.from('users').select('stripe_account_id').eq('id', receipt.seller_id).single(),
    ]);

    if (!seller?.stripe_account_id) {
      return NextResponse.json({
        error: 'Seller has not set up their payment account yet.',
        code: 'SELLER_NOT_SETUP',
      }, { status: 422 });
    }

    // Get/create Stripe customer for buyer
    const customerId = await getOrCreateCustomer({
      email: buyer!.email,
      userId: user.id,
      existingCustomerId: buyer!.stripe_customer_id,
    });

    // Save customer ID if newly created
    if (!buyer!.stripe_customer_id) {
      await adminClient
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    const platformFee = receipt.listing_price * 0.10;
    const sellerPayout = receipt.listing_price * 0.90;

    // Create order record (pending)
    const { data: order } = await adminClient
      .from('orders')
      .insert({
        receipt_id: receipt.id,
        buyer_id: user.id,
        seller_id: receipt.seller_id,
        amount: receipt.listing_price,
        platform_fee: platformFee,
        seller_payout: sellerPayout,
        status: 'pending',
      })
      .select()
      .single();

    if (!order) {
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Create Stripe PaymentIntent
    const { clientSecret, paymentIntentId } = await createPaymentIntent({
      listingPriceUsd: receipt.listing_price,
      sellerAccountId: seller.stripe_account_id,
      buyerCustomerId: customerId,
      receiptId: receipt.id,
      orderId: order.id,
      buyerId: user.id,
      sellerId: receipt.seller_id,
    });

    // Store payment intent on order
    await adminClient
      .from('orders')
      .update({ stripe_payment_intent_id: paymentIntentId })
      .eq('id', order.id);

    return NextResponse.json({
      data: {
        order_id: order.id,
        client_secret: clientSecret,
        amount: receipt.listing_price,
        platform_fee: platformFee,
        seller_payout: sellerPayout,
        store_name: receipt.store_name,
      },
    });
  } catch (error) {
    console.error('[CREATE ORDER] Error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
