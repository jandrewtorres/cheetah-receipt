'use client';
// src/app/disputes/[id]/page.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/ui/Navbar';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Send, Paperclip, AlertTriangle, CheckCircle, Clock, Shield } from 'lucide-react';
import Link from 'next/link';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open:              { label: 'Open',              color: 'badge-red' },
  seller_responded:  { label: 'Seller Responded',  color: 'badge-gold' },
  under_review:      { label: 'Under Review',      color: 'badge-gold' },
  resolved_buyer:    { label: 'Resolved — Buyer',  color: 'badge-blue' },
  resolved_seller:   { label: 'Resolved — Seller', color: 'badge-green' },
  closed:            { label: 'Closed',            color: 'badge-gray' },
};

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [dispute, setDispute]   = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [message, setMessage]   = useState('');
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data: d } = await supabase
        .from('disputes')
        .select(`
          *,
          orders(*, receipts(store_name, total, listing_price),
            buyer:users!orders_buyer_id_fkey(id, full_name, email),
            seller:users!orders_seller_id_fkey(id, full_name, email)
          ),
          opened_by_user:users!disputes_opened_by_fkey(id, full_name)
        `)
        .eq('id', id)
        .single();

      const { data: msgs } = await supabase
        .from('dispute_messages')
        .select('*, sender:users!dispute_messages_sender_id_fkey(id, full_name, role)')
        .eq('dispute_id', id)
        .order('created_at', { ascending: true });

      setDispute(d);
      setMessages(msgs ?? []);
      setLoading(false);
    };
    load();

    // Realtime subscription for new messages
    const channel = supabase
      .channel(`dispute-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dispute_messages',
        filter: `dispute_id=eq.${id}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new]);
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!message.trim() || !currentUser || sending) return;
    setSending(true);
    const res = await fetch(`/api/disputes/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim() }),
    });
    if (res.ok) {
      setMessage('');
    } else {
      toast.error('Failed to send message');
    }
    setSending(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-surface-900"><Navbar />
      <div className="flex items-center justify-center h-64"><div className="animate-pulse text-surface-200">Loading dispute...</div></div>
    </div>
  );

  if (!dispute) return (
    <div className="min-h-screen bg-surface-900"><Navbar />
      <div className="page-container py-12 text-center text-surface-200">Dispute not found.</div>
    </div>
  );

  const order    = dispute.orders;
  const receipt  = order?.receipts;
  const buyer    = order?.buyer;
  const seller   = order?.seller;
  const cfg      = STATUS_LABELS[dispute.status] ?? STATUS_LABELS.open;
  const isResolved = dispute.status.startsWith('resolved') || dispute.status === 'closed';
  const canMessage = !isResolved && currentUser;

  return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />
      <div className="page-container py-8">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="card p-5 mb-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={18} className="text-red-400" />
                  <h1 className="font-black text-white text-xl">Dispute</h1>
                  <span className={cfg.color}>{cfg.label}</span>
                </div>
                <div className="text-surface-200 text-sm">
                  #{id.slice(0, 8).toUpperCase()} · Opened {format(new Date(dispute.created_at), 'MMM d, yyyy')}
                </div>
              </div>
            </div>

            {/* Order info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Receipt',    value: receipt?.store_name ?? '—' },
                { label: 'Amount',     value: `$${order?.amount?.toFixed(2) ?? '0.00'}` },
                { label: 'Reason',     value: dispute.reason?.replace(/_/g, ' ') },
                { label: 'Order ID',   value: `#${order?.id?.slice(0,8).toUpperCase()}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface-800 rounded-xl p-3">
                  <div className="text-surface-200 text-xs mb-0.5">{label}</div>
                  <div className="text-white text-sm font-semibold truncate">{value}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="mt-4 bg-surface-800 rounded-xl p-4">
              <div className="text-xs text-surface-200 font-bold uppercase tracking-wider mb-2">Buyer's Description</div>
              <p className="text-surface-100 text-sm leading-relaxed">{dispute.description}</p>
            </div>

            {/* Evidence */}
            {dispute.evidence_urls?.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-surface-200 font-bold uppercase tracking-wider mb-2">Evidence</div>
                <div className="flex gap-2 flex-wrap">
                  {dispute.evidence_urls.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-surface-700 border border-surface-500 rounded-lg px-3 py-1.5 text-xs text-brand-500 hover:text-brand-400 transition-colors">
                      <Paperclip size={11} /> Attachment {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution (if resolved) */}
            {isResolved && dispute.resolution && (
              <div className="mt-4 bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="font-bold text-green-400 text-sm">Resolution</span>
                </div>
                <p className="text-surface-100 text-sm">{dispute.resolution}</p>
                {dispute.refund_amount && (
                  <div className="mt-2 text-green-400 font-bold text-sm">
                    Refund: ${dispute.refund_amount.toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {[
              { label: 'Buyer', user: buyer, role: 'buyer' },
              { label: 'Seller', user: seller, role: 'seller' },
            ].map(({ label, user: u, role }) => (
              <div key={role} className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-500 font-black">
                  {u?.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <div className="text-surface-200 text-xs">{label}</div>
                  <div className="text-white font-semibold text-sm">{u?.full_name ?? '—'}</div>
                </div>
                {currentUser?.id === u?.id && (
                  <span className="badge-gold ml-auto text-xs">You</span>
                )}
              </div>
            ))}
          </div>

          {/* Message thread */}
          <div className="card overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-surface-500 flex items-center gap-2">
              <Shield size={15} className="text-brand-500" />
              <span className="font-bold text-white">Dispute Thread</span>
              <span className="text-surface-300 text-xs ml-auto">{messages.length} messages</span>
            </div>

            <div className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8 text-surface-300 text-sm">
                  No messages yet. Start the conversation below.
                </div>
              )}
              {messages.map(msg => {
                const isMe = msg.sender_id === currentUser?.id;
                const isAdmin = msg.is_admin;
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0
                      ${isAdmin ? 'bg-brand-500/20 text-brand-500' : isMe ? 'bg-blue-500/20 text-blue-400' : 'bg-surface-500 text-surface-200'}`}>
                      {isAdmin ? '⚡' : (msg.sender?.full_name?.[0]?.toUpperCase() ?? '?')}
                    </div>
                    <div className={`flex-1 max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className={`text-xs text-surface-300 ${isMe ? 'text-right' : ''}`}>
                        {isAdmin ? 'Cheetah Support' : msg.sender?.full_name ?? 'Unknown'} ·
                        {' '}{format(new Date(msg.created_at), 'MMM d, h:mm a')}
                      </div>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                        ${isAdmin ? 'bg-brand-500/15 border border-brand-500/30 text-brand-100' :
                          isMe ? 'bg-blue-600/30 border border-blue-500/30 text-white' :
                          'bg-surface-700 border border-surface-500 text-surface-100'}`}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            {canMessage && (
              <div className="border-t border-surface-500 p-4 flex gap-3">
                <input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type your message..."
                  className="input flex-1 py-2.5 text-sm"
                  disabled={sending}
                />
                <button onClick={sendMessage} disabled={!message.trim() || sending}
                  className="btn-primary px-4 py-2.5 flex items-center gap-2 text-sm">
                  <Send size={15} /> Send
                </button>
              </div>
            )}
            {isResolved && (
              <div className="border-t border-surface-500 p-4 text-center text-surface-300 text-sm flex items-center justify-center gap-2">
                <Clock size={13} /> This dispute has been resolved
              </div>
            )}
          </div>

          <Link href="/orders" className="text-surface-200 hover:text-white text-sm transition-colors">
            ← Back to Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
