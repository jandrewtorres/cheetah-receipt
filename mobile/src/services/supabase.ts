// mobile/src/services/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── API helpers ──────────────────────────────────────────────────────────────
const API_URL = process.env.EXPO_PUBLIC_API_URL!;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
  };
}

export const api = {
  async scanReceipt(formData: FormData) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_URL}/api/receipts/scan`, {
      method: 'POST',
      headers: { ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }) },
      body: formData,
    });
    return res.json();
  },

  async listReceipt(receiptId: string, listingPrice: number, category: string) {
    const res = await fetch(`${API_URL}/api/receipts/${receiptId}/list`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ listing_price: listingPrice, category }),
    });
    return res.json();
  },

  async createOrder(receiptId: string) {
    const res = await fetch(`${API_URL}/api/orders/create`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ receipt_id: receiptId }),
    });
    return res.json();
  },

  async openDispute(orderId: string, reason: string, description: string) {
    const res = await fetch(`${API_URL}/api/disputes`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ order_id: orderId, reason, description }),
    });
    return res.json();
  },

  async sendDisputeMessage(disputeId: string, message: string) {
    const res = await fetch(`${API_URL}/api/disputes/${disputeId}/messages`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ message }),
    });
    return res.json();
  },

  async updateManualReview(receiptId: string, corrections: Record<string, any>) {
    const res = await fetch(`${API_URL}/api/receipts/${receiptId}/manual-review`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(corrections),
    });
    return res.json();
  },
};
