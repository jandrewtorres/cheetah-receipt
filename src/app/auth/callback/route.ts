// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWelcomeEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code     = searchParams.get('code');
  const redirect = searchParams.get('redirect') ?? '/marketplace';

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if this is a brand new user (created_at within last 10 seconds)
      const isNew = (Date.now() - new Date(data.user.created_at).getTime()) < 10000;
      if (isNew && data.user.email) {
        const adminClient = createAdminClient();
        const { data: profile } = await adminClient.from('users').select('full_name').eq('id', data.user.id).single();
        sendWelcomeEmail({ to: data.user.email, name: profile?.full_name ?? data.user.email.split('@')[0] })
          .catch(console.error);
      }
    }
  }

  return NextResponse.redirect(`${origin}${redirect}`);
}
