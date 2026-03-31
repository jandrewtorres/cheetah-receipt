'use client';
// src/app/notifications/page.tsx
import { useState, useEffect } from 'react';
import Navbar from '@/components/ui/Navbar';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { Bell, CheckCheck, DollarSign, Package, AlertTriangle, Zap, Shield, Settings } from 'lucide-react';

const TYPE_ICONS: Record<string, { icon: any; color: string }> = {
  sale:              { icon: DollarSign,  color: 'text-green-400 bg-green-400/15' },
  purchase:          { icon: Package,     color: 'text-blue-400 bg-blue-400/15' },
  dispute_opened:    { icon: AlertTriangle,color:'text-red-400 bg-red-400/15' },
  dispute_update:    { icon: AlertTriangle,color:'text-yellow-400 bg-yellow-400/15' },
  dispute_resolved:  { icon: Shield,      color: 'text-purple-400 bg-purple-400/15' },
  payout:            { icon: DollarSign,  color: 'text-brand-500 bg-brand-500/15' },
  listing_flagged:   { icon: AlertTriangle,color:'text-orange-400 bg-orange-400/15' },
  listing_approved:  { icon: Zap,         color: 'text-green-400 bg-green-400/15' },
  system:            { icon: Bell,        color: 'text-surface-200 bg-surface-500/30' },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setNotifications(data ?? []);
      setLoading(false);

      // Mark all as read
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    };
    load();

    // Realtime
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.channel('notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          payload => setNotifications(prev => [payload.new as any, ...prev]))
        .subscribe();
    });
  }, []);

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />
      <div className="page-container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                <Bell size={22} className="text-brand-500" /> Notifications
              </h1>
              {unread > 0 && <p className="text-surface-200 text-sm">{unread} unread</p>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="btn-ghost py-2 px-4 text-sm flex items-center gap-2">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-20 animate-pulse bg-surface-600" />)}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-24">
              <Bell size={40} className="text-surface-400 mx-auto mb-3" />
              <h3 className="font-bold text-white mb-1">No notifications yet</h3>
              <p className="text-surface-200 text-sm">We'll notify you about sales, purchases, and disputes here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => {
                const cfg = TYPE_ICONS[n.type] ?? TYPE_ICONS.system;
                const Icon = cfg.icon;
                return (
                  <div key={n.id} className={`card p-4 flex items-start gap-4 transition-colors ${!n.read ? 'border-brand-500/20 bg-brand-500/5' : ''}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color.split(' ')[1]}`}>
                      <Icon size={18} className={cfg.color.split(' ')[0]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className={`font-semibold text-sm ${!n.read ? 'text-white' : 'text-surface-100'}`}>{n.title}</div>
                        <div className="text-surface-300 text-xs shrink-0">{format(new Date(n.created_at), 'MMM d, h:mm a')}</div>
                      </div>
                      <div className="text-surface-200 text-sm mt-0.5">{n.body}</div>
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
