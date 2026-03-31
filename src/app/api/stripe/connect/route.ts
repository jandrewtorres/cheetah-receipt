// src/app/api/stripe/connect/route.ts
// POST — creates Stripe Connect account and returns onboarding URL
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createSellerAccount, createOnboardingLink } from '@/lib/stripe';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('users').select('stripe_account_id, email').eq('id', user.id).single();

  let accountId = profile?.stripe_account_id;

  if (!accountId) {
    accountId = await createSellerAccount({ email: profile!.email, userId: user.id });
    await adminClient.from('users').update({ stripe_account_id: accountId, role: 'seller' }).eq('id', user.id);
  }

  const url = await createOnboardingLink({
    accountId,
    returnUrl:  `${APP_URL}/dashboard?stripe=success`,
    refreshUrl: `${APP_URL}/dashboard?stripe=refresh`,
  });

  return NextResponse.json({ url });
}
