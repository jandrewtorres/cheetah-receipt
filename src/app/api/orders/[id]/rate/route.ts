// src/app/api/orders/[id]/rate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

const RateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = RateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const adminClient = createAdminClient();
  const { data: order } = await adminClient.from('orders')
    .select('id, buyer_id, seller_id, buyer_rated, status')
    .eq('id', params.id).single();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (order.buyer_rated) return NextResponse.json({ error: 'Already rated' }, { status: 409 });
  if (!['paid','delivered','completed'].includes(order.status)) return NextResponse.json({ error: 'Order not eligible for rating' }, { status: 422 });

  await adminClient.from('orders').update({
    buyer_rated: true,
    buyer_rating: parsed.data.rating,
    buyer_review: parsed.data.review ?? null,
    status: 'completed',
  }).eq('id', params.id);

  // Update seller's average rating
  const { data: sellerOrders } = await adminClient.from('orders')
    .select('seller_rating').eq('seller_id', order.seller_id).not('seller_rating', 'is', null);

  // Also include new buyer rating as seller_rating proxy
  const allRatings = [...(sellerOrders ?? []).map((o: any) => o.seller_rating), parsed.data.rating];
  const avgRating = allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length;

  await adminClient.from('users').update({
    seller_rating: Math.round(avgRating * 10) / 10,
    seller_rating_count: allRatings.length,
  }).eq('id', order.seller_id);

  return NextResponse.json({ data: { success: true } });
}
