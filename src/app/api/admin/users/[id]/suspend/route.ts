// src/app/api/admin/users/[id]/suspend/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { data } = await adminClient
    .from('users')
    .update({ is_suspended: true, suspension_reason: body.reason ?? 'Admin action' })
    .eq('id', params.id)
    .select()
    .single();

  // Remove all active listings from suspended user
  await adminClient
    .from('receipts')
    .update({ status: 'removed' })
    .eq('seller_id', params.id)
    .eq('status', 'active');

  return NextResponse.json({ data });
}
