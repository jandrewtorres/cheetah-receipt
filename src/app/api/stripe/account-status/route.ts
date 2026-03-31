// src/app/api/stripe/account-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSellerAccountStatus } from '@/lib/stripe';

export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('users').select('stripe_account_id').eq('id', user.id).single();
  if (!profile?.stripe_account_id) return NextResponse.json({ connected: false });

  try {
    const status = await getSellerAccountStatus(profile.stripe_account_id);
    return NextResponse.json({ connected: true, ...status });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
