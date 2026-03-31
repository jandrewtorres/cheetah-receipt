// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET — fetch user notifications
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const { data, count } = await adminClient
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const unread = await adminClient
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);

  return NextResponse.json({ data, total: count, unread_count: unread.count ?? 0 });
}

// PATCH — mark all as read
export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  await adminClient.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);

  return NextResponse.json({ success: true });
}
