// src/app/api/stripe/dashboard-link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSellerDashboardLink } from '@/lib/stripe';

export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('users').select('stripe_account_id').eq('id', user.id).single();
  if (!profile?.stripe_account_id) return NextResponse.json({ error: 'No Stripe account' }, { status: 404 });

  const url = await getSellerDashboardLink(profile.stripe_account_id);
  return NextResponse.json({ url });
}
