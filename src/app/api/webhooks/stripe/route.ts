// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications/push';
import {
  sendPurchaseConfirmationToBuyer,
  sendSaleNotificationToSeller,
  sendPayoutEmail,
} from '@/lib/email';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = createAdminClient();

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { receipt_id, order_id, buyer_id, seller_id } = pi.metadata;
        if (!order_id) break;

        await Promise.all([
          db.from('orders').update({ status: 'paid', delivered_at: new Date().toISOString() }).eq('id', order_id),
          db.from('receipts').update({ status: 'sold' }).eq('id', receipt_id),
        ]);

        // Increment seller stats via DB function (defined in migration 002)
        await db.rpc('increment_seller_stats', {
          p_seller_id: seller_id,
          p_payout:    (pi.amount / 100) * 0.90,
        });

        const [{ data: buyer }, { data: seller }, { data: receipt }] = await Promise.all([
          db.from('users').select('email, full_name').eq('id', buyer_id).single(),
          db.from('users').select('email, full_name').eq('id', seller_id).single(),
          db.from('receipts').select('store_name, total, listing_price').eq('id', receipt_id).single(),
        ]);

        const { count: itemCount } = await db
          .from('receipt_items').select('*', { count: 'exact', head: true }).eq('receipt_id', receipt_id);

        const payout = (pi.amount / 100) * 0.90;

        await Promise.allSettled([
          notify.receiptPurchased({ buyerId: buyer_id, storeName: receipt?.store_name ?? 'Receipt', orderId: order_id }),
          notify.receiptSold({ sellerId: seller_id, storeName: receipt?.store_name ?? 'Receipt', payout, orderId: order_id }),
          buyer && sendPurchaseConfirmationToBuyer({
            to: buyer.email, buyerName: buyer.full_name ?? 'Buyer', orderId: order_id,
            storeName: receipt?.store_name ?? 'Receipt', receiptTotal: receipt?.total ?? 0,
            listingPrice: pi.amount / 100, itemCount: itemCount ?? 0, sellerName: seller?.full_name ?? 'Seller',
          }),
          seller && sendSaleNotificationToSeller({
            to: seller.email, sellerName: seller.full_name ?? 'Seller', orderId: order_id,
            storeName: receipt?.store_name ?? 'Receipt', listingPrice: pi.amount / 100,
            sellerPayout: payout, buyerName: buyer?.full_name ?? 'Buyer',
          }),
        ]);
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        const orderId  = transfer.metadata?.order_id;
        if (!orderId) break;

        const { data: order } = await db.from('orders').select('seller_id, seller_payout').eq('id', orderId).single();
        if (!order) break;

        await db.from('seller_payouts').insert({
          seller_id: order.seller_id, order_id: orderId,
          amount: order.seller_payout, stripe_transfer_id: transfer.id,
          status: 'paid', paid_at: new Date().toISOString(),
        });

        // Read current total_earned then write incremented value
        const { data: u } = await db.from('users').select('total_earned').eq('id', order.seller_id).single();
        await db.from('users').update({ total_earned: (u?.total_earned ?? 0) + order.seller_payout }).eq('id', order.seller_id);

        const { data: seller } = await db.from('users').select('email, full_name').eq('id', order.seller_id).single();
        if (seller) {
          await Promise.allSettled([
            notify.payoutSent({ sellerId: order.seller_id, amount: order.seller_payout, orderId }),
            sendPayoutEmail({ to: seller.email, sellerName: seller.full_name ?? 'Seller', amount: order.seller_payout, orderId }),
          ]);
        }
        break;
      }

      case 'charge.refunded': {
        const charge          = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        const { data: order } = await db.from('orders').select('id, receipt_id').eq('stripe_payment_intent_id', paymentIntentId).single();
        if (order) {
          await Promise.all([
            db.from('orders').update({ status: 'refunded' }).eq('id', order.id),
            db.from('receipts').update({ status: 'active' }).eq('id', order.receipt_id),
          ]);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.order_id) {
          await db.from('orders').update({ status: 'pending' }).eq('id', pi.metadata.order_id);
        }
        break;
      }

      default:
        console.log(`[WEBHOOK] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Handler error:', error);
    return NextResponse.json({ received: true });
  }
}
