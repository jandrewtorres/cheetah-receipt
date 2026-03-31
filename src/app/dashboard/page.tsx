'use client';
// src/app/dashboard/page.tsx
import { useState, useEffect } from 'react';
import Navbar from '@/components/ui/Navbar';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import {
  DollarSign, Package, TrendingUp, Star, Plus,
  Eye, Clock, CheckCircle, AlertCircle, XCircle, ExternalLink
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:          { label: 'Draft',         color: 'badge-gray',  icon: Clock },
  pending_review: { label: 'Under Review',  color: 'badge-gold',  icon: AlertCircle },
  active:         { label: 'Active',        color: 'badge-green', icon: CheckCircle },
  sold:           { label: 'Sold',          color: 'badge-blue',  icon: CheckCircle },
  removed:        { label: 'Removed',       color: 'badge-red',   icon: XCircle },
  flagged:        { label: 'Flagged',       color: 'badge-red',   icon: AlertCircle },
};

export default function DashboardPage() {
  const [profile, setProfile]   = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [orders, setOrders]     = useState<any[]>([]);
  const [payouts, setPayouts]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'listings'|'sales'|'payouts'>('listings');
  const [stripeStatus, setStripeStatus] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: prof },
        { data: lst },
        { data: ord },
        { data: pay },
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('receipts')
          .select('*, receipt_items(count)')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('orders')
          .select('*, receipts(store_name, listing_price), buyer:users!orders_buyer_id_fkey(full_name)')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('seller_payouts')
          .select('*')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setProfile(prof);
      setListings(lst ?? []);
      setOrders(ord ?? []);
      setPayouts(pay ?? []);
      setLoading(false);

      // Check Stripe account status
      if (prof?.stripe_account_id) {
        const res = await fetch('/api/stripe/account-status');
        if (res.ok) setStripeStatus(await res.json());
      }
    };
    load();
  }, []);

  const connectStripe = async () => {
    const res = await fetch('/api/stripe/connect', { method: 'POST' });
    const { url } = await res.json();
    window.location.href = url;
  };

  if (loading) return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-surface-200">Loading dashboard...</div>
      </div>
    </div>
  );

  const totalEarned  = orders.filter(o => ['paid','completed'].includes(o.status)).reduce((s, o) => s + o.seller_payout, 0);
  const activeLists  = listings.filter(l => l.status === 'active').length;
  const totalSales   = orders.filter(o => o.status !== 'pending').length;
  const pendingPayout = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />
      <div className="page-container py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Seller Dashboard</h1>
            <p className="text-surface-200 text-sm">Welcome back, {profile?.full_name ?? 'Seller'}</p>
          </div>
          <Link href="/sell" className="btn-primary flex items-center gap-2 py-2.5 px-5">
            <Plus size={16} /> New Listing
          </Link>
        </div>

        {/* Stripe Connect Banner */}
        {!profile?.stripe_account_id && (
          <div className="bg-brand-500/10 border border-brand-500/30 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-brand-500 mb-1">⚡ Connect your bank to get paid</div>
              <div className="text-surface-200 text-sm">Set up Stripe to receive payouts when your receipts sell.</div>
            </div>
            <button onClick={connectStripe} className="btn-primary py-2.5 px-5 text-sm shrink-0">
              Connect Bank
            </button>
          </div>
        )}

        {stripeStatus && !stripeStatus.payouts_enabled && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-yellow-400 mb-1">⚠️ Stripe setup incomplete</div>
              <div className="text-surface-200 text-sm">Complete your Stripe account to enable payouts.</div>
            </div>
            <button onClick={connectStripe} className="btn-secondary py-2.5 px-5 text-sm shrink-0">
              Complete Setup
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Earned',    value: `$${totalEarned.toFixed(2)}`,  icon: DollarSign, color: 'text-green-400' },
            { label: 'Active Listings', value: activeLists,                    icon: Package,    color: 'text-blue-400' },
            { label: 'Total Sales',     value: totalSales,                     icon: TrendingUp, color: 'text-brand-500' },
            { label: 'Seller Rating',   value: `${profile?.seller_rating?.toFixed(1) ?? '—'} ★`, icon: Star, color: 'text-yellow-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card">
              <Icon size={18} className={color} />
              <div className={`stat-value ${color}`}>{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-500 mb-6 gap-1">
          {([
            { id: 'listings', label: `Listings (${listings.length})` },
            { id: 'sales',    label: `Sales (${totalSales})` },
            { id: 'payouts',  label: `Payouts` },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                tab === t.id ? 'border-brand-500 text-brand-500' : 'border-transparent text-surface-200 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Listings tab */}
        {tab === 'listings' && (
          <div className="space-y-3">
            {listings.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">📋</div>
                <div className="font-bold text-white mb-2">No listings yet</div>
                <Link href="/sell" className="btn-primary inline-flex items-center gap-2 mt-2"><Plus size={14} /> List Your First Receipt</Link>
              </div>
            ) : listings.map(l => {
              const cfg = STATUS_CONFIG[l.status] ?? STATUS_CONFIG.draft;
              const StatusIcon = cfg.icon;
              return (
                <div key={l.id} className="card p-4 flex items-center gap-4">
                  <div className="text-2xl">🧾</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-white text-sm">{l.store_name}</span>
                      {l.store_number && <span className="text-surface-200 text-xs">{l.store_number}</span>}
                    </div>
                    <div className="text-surface-200 text-xs">
                      {l.receipt_items?.[0]?.count ?? 0} items · ${l.total?.toFixed(2)} receipt value ·
                      Listed {format(new Date(l.created_at), 'MMM d')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-surface-200"><Eye size={11} /> {l.watchers}</span>
                    <span className={cfg.color + ' flex items-center gap-1'}>
                      <StatusIcon size={11} />
                      <span className="text-xs font-semibold">{cfg.label}</span>
                    </span>
                    <span className="text-brand-500 font-black text-lg">${l.listing_price?.toFixed(2)}</span>
                    <Link href={`/marketplace/${l.id}`} className="text-surface-200 hover:text-white transition-colors">
                      <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sales tab */}
        {tab === 'sales' && (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="text-center py-16 text-surface-200">No sales yet</div>
            ) : orders.map(o => (
              <div key={o.id} className="card p-4 flex items-center gap-4">
                <div className="text-2xl">💰</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm">{(o.receipts as any)?.store_name}</div>
                  <div className="text-surface-200 text-xs">
                    Buyer: {(o.buyer as any)?.full_name ?? 'Anonymous'} ·
                    {format(new Date(o.created_at), ' MMM d, yyyy')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-green-400 font-black text-lg">${o.seller_payout?.toFixed(2)}</div>
                  <div className="text-surface-300 text-xs line-through">${o.amount?.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payouts tab */}
        {tab === 'payouts' && (
          <div>
            {pendingPayout > 0 && (
              <div className="bg-green-900/20 border border-green-500/20 rounded-2xl p-4 mb-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-green-400">Pending Payout</div>
                  <div className="text-surface-200 text-sm">Processing — arrives in 2-3 business days</div>
                </div>
                <div className="text-green-400 font-black text-2xl">${pendingPayout.toFixed(2)}</div>
              </div>
            )}
            <div className="space-y-3">
              {payouts.length === 0 ? (
                <div className="text-center py-16 text-surface-200">No payouts yet. Sell a receipt to get started!</div>
              ) : payouts.map(p => (
                <div key={p.id} className="card p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white text-sm">${p.amount.toFixed(2)}</div>
                    <div className="text-surface-200 text-xs">{format(new Date(p.created_at), 'MMM d, yyyy')}</div>
                  </div>
                  <span className={p.status === 'paid' ? 'badge-green' : p.status === 'failed' ? 'badge-red' : 'badge-gold'}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
