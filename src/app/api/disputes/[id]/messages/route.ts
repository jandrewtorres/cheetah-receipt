// src/app/api/disputes/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

const MessageSchema = z.object({ message: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = MessageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });

  const adminClient = createAdminClient();

  // Verify user is party to this dispute
  const { data: dispute } = await adminClient.from('disputes')
    .select('id, status, orders(buyer_id, seller_id)')
    .eq('id', params.id).single();

  if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (['resolved_buyer','resolved_seller','closed'].includes(dispute.status)) {
    return NextResponse.json({ error: 'Dispute is closed' }, { status: 422 });
  }

  const order = (dispute as any).orders;
  const { data: profile } = await adminClient.from('users').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';
  const isParty = order?.buyer_id === user.id || order?.seller_id === user.id;

  if (!isAdmin && !isParty) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: message } = await adminClient.from('dispute_messages').insert({
    dispute_id: params.id,
    sender_id: user.id,
    message: parsed.data.message,
    is_admin: isAdmin,
  }).select().single();

  // If seller responds, update status
  if (order?.seller_id === user.id && dispute.status === 'open') {
    await adminClient.from('disputes').update({ status: 'seller_responded' }).eq('id', params.id);
  }

  return NextResponse.json({ data: message }, { status: 201 });
}
