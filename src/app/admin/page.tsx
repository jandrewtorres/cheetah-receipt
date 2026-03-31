'use client';
// src/app/admin/page.tsx
import { useState, useEffect } from 'react';
import Navbar from '@/components/ui/Navbar';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Package, Users, Flag, DollarSign,
  Settings, TrendingUp, CheckCircle, XCircle, Eye,
  AlertTriangle, Clock, RefreshCw
} from 'lucide-react';

type AdminTab = 'overview' | 'listings' | 'users' | 'disputes' | 'payouts';

export default function AdminPage() {
  const [tab, setTab]         = useState<AdminTab>('overview');
  const [stats, setStats]     = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [users, setUsers]     = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => { loadAll(); }, [tab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [
        { count: totalListings },
        { count: activeListings },
        { count: pendingReview },
        { count: flaggedCount },
        { count: totalUsers },
        { count: openDisputes },
        { data: recentOrders },
        { data: recentActivity },
      ] = await Promise.all([
        supabase.from('receipts').select('*', { count: 'exact', head: true }),
        supabase.from('receipts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('receipts').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase.from('receipts').select('*', { count: 'exact', head: true }).eq('status', 'flagged'),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('orders').select('amount').in('status', ['paid','completed']).limit(100),
        supabase.from('orders').select('*, receipts(store_name), buyer:users!orders_buyer_id_fkey(full_name)')
          .order('created_at', { ascending: false }).limit(10),
      ]);

      const totalRevenue = (recentOrders ?? []).reduce((s: number, o: any) => s + (o.amount * 0.10), 0);
      setStats({ totalListings, activeListings, pendingReview, flaggedCount, totalUsers, openDisputes, totalRevenue });
      setActivity(recentActivity ?? []);

      // Load tab-specific data
      if (tab === 'listings' || tab === 'overview') {
        const { data } = await supabase.from('receipts')
          .select('*, seller:users!receipts_seller_id_fkey(full_name, email), receipt_items(count)')
          .in('status', ['pending_review', 'flagged'])
          .order('created_at', { ascending: false })
          .limit(50);
        setListings(data ?? []);
      }
      if (tab === 'users') {
        const { data } = await supabase.from('users')
          .select('*').order('created_at', { ascending: false }).limit(50);
        setUsers(data ?? []);
      }
      if (tab === 'disputes') {
        const { data } = await supabase.from('disputes')
          .select('*, orders(amount, receipts(store_name)), opened_by_user:users!disputes_opened_by_fkey(full_name)')
          .order('created_at', { ascending: false }).limit(50);
        setDisputes(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  const approveReceipt = async (id: string) => {
    const res = await fetch(`/api/admin/receipts/${id}/approve`, { method: 'POST' });
    if (res.ok) { toast.success('Receipt approved and live!'); loadAll(); }
    else toast.error('Failed to approve');
  };

  const rejectReceipt = async (id: string, reason: string) => {
    const res = await fetch(`/api/admin/receipts/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) { toast.success('Receipt removed'); loadAll(); }
    else toast.error('Failed to reject');
  };

  const resolveDispute = async (id: string, inFavorOf: 'buyer' | 'seller', resolution: string) => {
    const res = await fetch(`/api/admin/disputes/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ in_favor_of: inFavorOf, resolution }),
    });
    if (res.ok) { toast.success('Dispute resolved'); loadAll(); }
    else toast.error('Failed to resolve');
  };

  const suspendUser = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}/suspend`, { method: 'POST' });
    if (res.ok) { toast.success('User suspended'); loadAll(); }
  };

  const NAV = [
    { id: 'overview',  icon: LayoutDashboard, label: 'Overview' },
    { id: 'listings',  icon: Package,         label: `Listings${stats?.pendingReview ? ` (${stats.pendingReview})` : ''}` },
    { id: 'users',     icon: Users,           label: 'Users' },
    { id: 'disputes',  icon: Flag,            label: `Disputes${stats?.openDisputes ? ` (${stats.openDisputes})` : ''}` },
    { id: 'payouts',   icon: DollarSign,      label: 'Payouts' },
  ] as const;

  return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 bg-surface-800 border-r border-surface-500 min-h-[calc(100vh-64px)] sticky top-16 p-3">
          <div className="text-[10px] text-surface-300 font-bold uppercase tracking-widest px-3 mb-2 mt-2">Admin Panel</div>
          {NAV.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id as AdminTab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors mb-1 ${
                tab === id ? 'bg-brand-500/15 text-brand-500' : 'text-surface-200 hover:text-white hover:bg-surface-600'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
          <div className="border-t border-surface-500 mt-3 pt-3">
            <button onClick={loadAll} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-surface-200 hover:text-white hover:bg-surface-600 transition-colors">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-8 overflow-auto">

          {/* Overview */}
          {tab === 'overview' && (
            <div>
              <h1 className="section-title mb-6">Dashboard Overview</h1>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Platform Revenue', value: `$${stats?.totalRevenue?.toFixed(2) ?? '0.00'}`, icon: DollarSign, color: 'text-green-400' },
                  { label: 'Active Listings',  value: stats?.activeListings ?? 0,  icon: Package,    color: 'text-blue-400' },
                  { label: 'Total Users',      value: stats?.totalUsers ?? 0,      icon: Users,      color: 'text-purple-400' },
                  { label: 'Open Disputes',    value: stats?.openDisputes ?? 0,    icon: Flag,       color: 'text-red-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="stat-card">
                    <Icon size={18} className={color} />
                    <div className={`stat-value ${color}`}>{value}</div>
                    <div className="stat-label">{label}</div>
                  </div>
                ))}
              </div>

              {/* Alerts */}
              {(stats?.pendingReview > 0 || stats?.flaggedCount > 0 || stats?.openDisputes > 0) && (
                <div className="space-y-3 mb-8">
                  {stats?.pendingReview > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock size={18} className="text-yellow-400" />
                        <div>
                          <div className="font-bold text-yellow-400">{stats.pendingReview} listings awaiting review</div>
                          <div className="text-surface-200 text-xs">Review and approve or reject</div>
                        </div>
                      </div>
                      <button onClick={() => setTab('listings')} className="btn-secondary py-2 px-4 text-sm">Review Now</button>
                    </div>
                  )}
                  {stats?.openDisputes > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={18} className="text-red-400" />
                        <div>
                          <div className="font-bold text-red-400">{stats.openDisputes} open disputes need resolution</div>
                          <div className="text-surface-200 text-xs">Buyers are waiting for a decision</div>
                        </div>
                      </div>
                      <button onClick={() => setTab('disputes')} className="btn-secondary py-2 px-4 text-sm">Resolve</button>
                    </div>
                  )}
                </div>
              )}

              {/* Recent activity */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-500 flex items-center gap-2">
                  <TrendingUp size={16} className="text-brand-500" />
                  <span className="font-bold text-white">Recent Sales</span>
                </div>
                {activity.slice(0, 8).map((order: any) => (
                  <div key={order.id} className="table-row px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm font-semibold">{order.receipts?.store_name}</div>
                      <div className="text-surface-200 text-xs">Buyer: {order.buyer?.full_name ?? 'Anonymous'} · {format(new Date(order.created_at), 'MMM d, h:mm a')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">${(order.amount * 0.10).toFixed(2)}</div>
                      <div className="text-surface-300 text-xs">fee</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Listings moderation */}
          {tab === 'listings' && (
            <div>
              <h1 className="section-title mb-6">Receipt Moderation</h1>
              {listings.length === 0 ? (
                <div className="text-center py-16 text-surface-200">
                  <CheckCircle size={32} className="mx-auto text-green-400 mb-3" />
                  All caught up! No receipts pending review.
                </div>
              ) : listings.map(l => (
                <div key={l.id} className="card p-5 mb-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white">{l.store_name}</span>
                        {l.store_number && <span className="text-surface-200 text-sm">{l.store_number}</span>}
                        <span className={l.status === 'flagged' ? 'badge-red' : 'badge-gold'}>{l.status}</span>
                      </div>
                      <div className="text-surface-200 text-sm">
                        Seller: {l.seller?.full_name} · {l.receipt_items?.[0]?.count ?? 0} items · ${l.total?.toFixed(2)} value
                      </div>
                      {l.flagged_reason && (
                        <div className="text-red-400 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={11} /> {l.flagged_reason}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-brand-500 font-black text-xl">${l.listing_price?.toFixed(2)}</div>
                      <div className="text-surface-200 text-xs">listing price</div>
                    </div>
                  </div>

                  {/* Fraud info */}
                  {l.fraud_score > 0 && (
                    <div className={`rounded-xl p-3 mb-4 border text-sm ${
                      l.fraud_risk === 'high' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                      l.fraud_risk === 'medium' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                      'bg-green-900/20 border-green-500/20 text-green-400'
                    }`}>
                      <span className="font-bold">Fraud Score: {l.fraud_score}/100</span>
                      {l.fraud_flags?.length > 0 && (
                        <span className="text-xs ml-2 opacity-80">{l.fraud_flags.slice(0, 2).join(' · ')}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button onClick={() => approveReceipt(l.id)}
                      className="flex items-center gap-2 bg-green-900/30 border border-green-500/30 text-green-400 hover:bg-green-900/50 rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
                      <CheckCircle size={14} /> Approve & Go Live
                    </button>
                    <button onClick={() => rejectReceipt(l.id, 'Failed admin review')}
                      className="flex items-center gap-2 bg-red-900/30 border border-red-500/30 text-red-400 hover:bg-red-900/50 rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
                      <XCircle size={14} /> Remove
                    </button>
                    <a href={l.image_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 btn-ghost py-2 px-4 text-sm ml-auto">
                      <Eye size={14} /> View Image
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Users */}
          {tab === 'users' && (
            <div>
              <h1 className="section-title mb-6">User Management</h1>
              <div className="card overflow-hidden">
                <div className="grid grid-cols-12 px-5 py-3 bg-surface-800 border-b border-surface-500 table-header">
                  <span className="col-span-4">User</span>
                  <span className="col-span-2">Role</span>
                  <span className="col-span-2">Sales</span>
                  <span className="col-span-2">Rating</span>
                  <span className="col-span-2">Actions</span>
                </div>
                {users.map(u => (
                  <div key={u.id} className="table-row grid grid-cols-12 px-5 py-3 items-center text-sm">
                    <div className="col-span-4 min-w-0">
                      <div className="font-semibold text-white truncate">{u.full_name ?? '—'}</div>
                      <div className="text-surface-200 text-xs truncate">{u.email}</div>
                    </div>
                    <div className="col-span-2">
                      <span className={u.role === 'admin' ? 'badge-gold' : u.role === 'seller' ? 'badge-blue' : 'badge-gray'}>{u.role}</span>
                    </div>
                    <div className="col-span-2 text-surface-200">{u.total_sales}</div>
                    <div className="col-span-2 text-yellow-400 font-semibold">{u.seller_rating?.toFixed(1) ?? '—'} ★</div>
                    <div className="col-span-2">
                      {!u.is_suspended ? (
                        <button onClick={() => suspendUser(u.id)}
                          className="text-red-400 hover:text-red-300 text-xs font-semibold transition-colors">
                          Suspend
                        </button>
                      ) : (
                        <span className="text-red-400 text-xs font-semibold">Suspended</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disputes */}
          {tab === 'disputes' && (
            <div>
              <h1 className="section-title mb-6">Dispute Resolution</h1>
              <div className="space-y-4">
                {disputes.length === 0 ? (
                  <div className="text-center py-16 text-surface-200">
                    <CheckCircle size={32} className="mx-auto text-green-400 mb-3" />
                    No disputes to resolve!
                  </div>
                ) : disputes.map(d => (
                  <div key={d.id} className="card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white">{d.orders?.receipts?.store_name ?? 'Receipt'}</span>
                          <span className={d.status === 'open' ? 'badge-red' : d.status === 'seller_responded' ? 'badge-gold' : 'badge-green'}>
                            {d.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-surface-200 text-sm">
                          Opened by: {d.opened_by_user?.full_name} · {format(new Date(d.created_at), 'MMM d, yyyy')}
                        </div>
                        <div className="text-surface-200 text-xs mt-0.5">Reason: {d.reason.replace(/_/g, ' ')}</div>
                      </div>
                      <div className="text-brand-500 font-black text-xl shrink-0">${d.orders?.amount?.toFixed(2)}</div>
                    </div>
                    <div className="bg-surface-800 rounded-xl p-3 mb-4 text-sm text-surface-200">
                      {d.description}
                    </div>
                    {['open','seller_responded','under_review'].includes(d.status) && (
                      <div className="flex gap-3">
                        <button onClick={() => resolveDispute(d.id, 'buyer', 'Admin ruled in buyer favor — refund issued')}
                          className="flex items-center gap-2 bg-blue-900/30 border border-blue-500/30 text-blue-400 hover:bg-blue-900/50 rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
                          Refund Buyer
                        </button>
                        <button onClick={() => resolveDispute(d.id, 'seller', 'Admin ruled in seller favor — sale upheld')}
                          className="flex items-center gap-2 bg-green-900/30 border border-green-500/30 text-green-400 hover:bg-green-900/50 rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
                          Uphold Sale
                        </button>
                        <a href={`/disputes/${d.id}`} className="btn-ghost py-2 px-4 text-sm ml-auto">View Full Dispute</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
