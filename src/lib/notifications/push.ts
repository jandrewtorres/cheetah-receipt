// src/lib/notifications/push.ts
// Expo Push Notifications + Supabase Realtime notifications table.
// Handles both mobile push and in-app notification creation in one call.

import { createAdminClient } from '@/lib/supabase/server';
import { NotificationType } from '@/types';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ─── CREATE NOTIFICATION ──────────────────────────────────────────────────────

interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sendEmail?: boolean;
}

/**
 * Create an in-app notification record AND send a push notification
 * if the user has a registered Expo push token.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const supabase = createAdminClient();

  // 1. Insert notification record (visible in-app)
  const { data: notification } = await supabase
    .from('notifications')
    .insert({
      user_id: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    })
    .select()
    .single();

  // 2. Get user's push token
  const { data: user } = await supabase
    .from('users')
    .select('expo_push_token')
    .eq('id', payload.userId)
    .single();

  if (!user?.expo_push_token) return;

  // 3. Send Expo push notification
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN && {
          Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
        }),
      },
      body: JSON.stringify({
        to: user.expo_push_token,
        title: payload.title,
        body: payload.body,
        data: {
          ...payload.data,
          notificationId: notification?.id,
          type: payload.type,
        },
        sound: 'default',
        badge: 1,
        priority: 'high',
      }),
    });

    const result = await response.json();

    // Mark push as sent
    if (notification && result.data?.status === 'ok') {
      await supabase
        .from('notifications')
        .update({ sent_push: true })
        .eq('id', notification.id);
    }
  } catch (error) {
    console.error('Push notification failed:', error);
    // Non-fatal — in-app notification was still created
  }
}

// ─── BATCH NOTIFICATIONS ──────────────────────────────────────────────────────

export async function sendBatchNotifications(
  notifications: NotificationPayload[]
): Promise<void> {
  await Promise.allSettled(notifications.map(sendNotification));
}

// ─── PREDEFINED NOTIFICATION EVENTS ──────────────────────────────────────────

export const notify = {
  async receiptSold(params: {
    sellerId: string;
    storeName: string;
    payout: number;
    orderId: string;
  }) {
    await sendNotification({
      userId: params.sellerId,
      type: 'sale',
      title: '💰 Receipt Sold!',
      body: `Your ${params.storeName} receipt sold. $${params.payout.toFixed(2)} coming your way.`,
      data: { orderId: params.orderId, screen: 'OrderDetail' },
    });
  },

  async receiptPurchased(params: {
    buyerId: string;
    storeName: string;
    orderId: string;
  }) {
    await sendNotification({
      userId: params.buyerId,
      type: 'purchase',
      title: '✅ Purchase Complete!',
      body: `Your ${params.storeName} receipt is ready to view.`,
      data: { orderId: params.orderId, screen: 'OrderDetail' },
    });
  },

  async disputeOpened(params: {
    sellerId: string;
    storeName: string;
    disputeId: string;
  }) {
    await sendNotification({
      userId: params.sellerId,
      type: 'dispute_opened',
      title: '⚠️ Dispute Opened',
      body: `A buyer opened a dispute on your ${params.storeName} receipt. Please respond within 48 hours.`,
      data: { disputeId: params.disputeId, screen: 'DisputeDetail' },
    });
  },

  async disputeResolved(params: {
    userId: string;
    inFavorOf: 'buyer' | 'seller';
    disputeId: string;
    refundAmount?: number;
  }) {
    const isFavorable =
      (params.inFavorOf === 'buyer');
    await sendNotification({
      userId: params.userId,
      type: 'dispute_resolved',
      title: '⚖️ Dispute Resolved',
      body: isFavorable
        ? `Your dispute was resolved in your favor.${params.refundAmount ? ` Refund: $${params.refundAmount.toFixed(2)}` : ''}`
        : 'The dispute was resolved in the seller\'s favor.',
      data: { disputeId: params.disputeId, screen: 'DisputeDetail' },
    });
  },

  async listingApproved(params: {
    sellerId: string;
    storeName: string;
    receiptId: string;
  }) {
    await sendNotification({
      userId: params.sellerId,
      type: 'listing_approved',
      title: '✅ Listing Approved!',
      body: `Your ${params.storeName} receipt is now live on the marketplace.`,
      data: { receiptId: params.receiptId, screen: 'ReceiptDetail' },
    });
  },

  async listingFlagged(params: {
    sellerId: string;
    storeName: string;
    receiptId: string;
    reason: string;
  }) {
    await sendNotification({
      userId: params.sellerId,
      type: 'listing_flagged',
      title: '🚩 Listing Under Review',
      body: `Your ${params.storeName} receipt has been flagged: ${params.reason}`,
      data: { receiptId: params.receiptId, screen: 'ReceiptDetail' },
    });
  },

  async payoutSent(params: {
    sellerId: string;
    amount: number;
    orderId: string;
  }) {
    await sendNotification({
      userId: params.sellerId,
      type: 'payout',
      title: '💸 Payout Sent',
      body: `$${params.amount.toFixed(2)} has been sent to your bank account.`,
      data: { orderId: params.orderId, screen: 'Payouts' },
    });
  },
};
