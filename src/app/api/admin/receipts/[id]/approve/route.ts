// src/app/api/admin/receipts/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications/push';
import { sendListingApprovedEmail } from '@/lib/email';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: receipt } = await adminClient.from('receipts')
    .update({ status: 'active', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', params.id).select('*, seller:users!receipts_seller_id_fkey(email, full_name)').single();

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const seller = (receipt as any).seller;
  await Promise.allSettled([
    notify.listingApproved({ sellerId: receipt.seller_id, storeName: receipt.store_name, receiptId: receipt.id }),
    seller && sendListingApprovedEmail({ to: seller.email, sellerName: seller.full_name ?? 'Seller', receiptId: receipt.id, storeName: receipt.store_name, listingPrice: receipt.listing_price }),
  ]);

  return NextResponse.json({ data: receipt });
}
