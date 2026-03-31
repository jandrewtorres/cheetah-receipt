// src/app/api/receipts/route.ts
// GET /api/receipts — public marketplace listing endpoint
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search   = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const store    = searchParams.get('store') ?? '';
  const sort     = searchParams.get('sort') ?? 'newest';
  const minPrice = searchParams.get('min_price');
  const maxPrice = searchParams.get('max_price');
  const page     = parseInt(searchParams.get('page') ?? '1');
  const perPage  = parseInt(searchParams.get('per_page') ?? '24');

  const adminClient = createAdminClient();

  let query = adminClient
    .from('receipts')
    .select(
      '*, seller:users!receipts_seller_id_fkey(full_name, seller_rating, total_sales, is_verified), receipt_items(id, name, upc, unit_price)',
      { count: 'exact' }
    )
    .eq('status', 'active');

  if (search)   query = query.or(`store_name.ilike.%${search}%,store_chain.ilike.%${search}%`);
  if (category) query = query.eq('category', category);
  if (store)    query = query.eq('store_chain', store);
  if (minPrice) query = query.gte('listing_price', parseFloat(minPrice));
  if (maxPrice) query = query.lte('listing_price', parseFloat(maxPrice));

  switch (sort) {
    case 'price_asc':     query = query.order('listing_price', { ascending: true }); break;
    case 'price_desc':    query = query.order('listing_price', { ascending: false }); break;
    case 'highest_value': query = query.order('total', { ascending: false }); break;
    case 'ending_soon':   query = query.order('return_by_date', { ascending: true, nullsFirst: false }); break;
    case 'most_watched':  query = query.order('watchers', { ascending: false }); break;
    default:              query = query.order('created_at', { ascending: false });
  }

  const { data, count, error } = await query.range((page - 1) * perPage, page * perPage - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data,
    total: count ?? 0,
    page,
    per_page: perPage,
    has_more: (count ?? 0) > page * perPage,
  });
}
