'use client';
// src/app/marketplace/[id]/page.tsx
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/ui/Navbar';
import CheckoutModal from '@/components/checkout/CheckoutModal';
import { createClient } from '@/lib/supabase/client';
import { format, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Zap, Star, Shield, Eye, Clock, Barcode, MapPin,
  Calendar, CreditCard, ChevronLeft, Heart, Share2,
  CheckCircle, AlertCircle, Package, TrendingUp
} from 'lucide-react';
import Link from 'next/link';

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [receipt, setReceipt]       = useState<any>(null);
  const [items, setItems]           = useState<any[]>([]);
  const [seller, setSeller]         = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [watching, setWatching]     = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data: rec } = await supabase
        .from('receipts')
        .select('*, seller:users!receipts_seller_id_fkey(*)')
        .eq('id', id)
        .eq('status', 'active')
        .single();

      if (!rec) { router.push('/marketplace'); return; }

      const { data: itms } = await supabase
        .from('receipt_items')
        .select('id, name, quantity, unit_price, total_price, department')
        .eq('receipt_id', id);

      setReceipt(rec);
      setSeller(rec.seller);
      setItems(itms ?? []);

      // Increment view count
      await supabase.rpc('increment_receipt_views', { p_receipt_id: id }).catch(() => {
        supabase.from('receipts').update({ views: (rec.views ?? 0) + 1 }).eq('id', id);
      });

      // Check if user is watching
      if (user) {
        const { data: watch } = await supabase
          .from('receipt_watchers')
          .select('receipt_id')
          .eq('user_id', user.id)
          .eq('receipt_id', id)
          .single();
        setWatching(!!watch);

        // Check if already purchased
        const { data: order } = await supabase
          .from('orders')
          .select('id')
          .eq('receipt_id', id)
          .eq('buyer_id', user.id)
          .in('status', ['paid', 'delivered', 'completed'])
          .single();
        setAlreadyPurchased(!!order);
      }

      setLoading(false);
    };
    load();
  }, [id]);

  const toggleWatch = async () => {
    if (!currentUser) { router.push('/auth/login'); return; }
    if (watching) {
      await supabase.from('receipt_watchers').delete().eq('user_id', currentUser.id).eq('receipt_id', id);
      setWatching(false);
      toast('Removed from watchlist');
    } else {
      await supabase.from('receipt_watchers').insert({ user_id: currentUser.id, receipt_id: id });
      setWatching(true);
      toast.success('Added to watchlist');
    }
  };

  const handleBuyClick = () => {
    if (!currentUser) { router.push(`/auth/login?redirect=/marketplace/${id}`); return; }
    if (currentUser.id === receipt?.seller_id) { toast.error("You can't buy your own receipt"); return; }
    setShowCheckout(true);
  };

  if (loading) return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />
      <div className="page-container py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1,2,3].map(i => <div key={i} className="card h-40 animate-pulse bg-surface-600" />)}
          </div>
          <div className="card h-80 animate-pulse bg-surface-600" />
        </div>
      </div>
    </div>
  );

  if (!receipt) return null;

  const daysLeft = receipt.return_by_date
    ? differenceInDays(new Date(receipt.return_by_date), new Date())
    : null;
  const isUrgent = daysLeft !== null && daysLeft < 7;

  return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />

      <div className="page-container py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-surface-200 mb-6">
          <Link href="/marketplace" className="hover:text-white flex items-center gap-1 transition-colors">
            <ChevronLeft size={14} /> Marketplace
          </Link>
          <span>/</span>
          <span className="text-surface-100">{receipt.store_name}</span>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Receipt details */}
          <div className="lg:col-span-2 space-y-5">

            {/* Header card */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h1 className="text-2xl font-black text-white mb-1">{receipt.store_name} Receipt</h1>
                  <div className="flex items-center gap-3 text-sm text-surface-200">
                    {receipt.store_number && (
                      <span className="flex items-center gap-1"><Package size={13} /> {receipt.store_number}</span>
                    )}
                    {(receipt.store_city || receipt.store_state) && (
                      <span className="flex items-center gap-1">
                        <MapPin size={13} />
                        {[receipt.store_city, receipt.store_state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    <span className="flex items-center gap-1"><Eye size={13} /> {receipt.views} views</span>
                    <span className="flex items-center gap-1"><Heart size={13} /> {receipt.watchers} watching</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={toggleWatch}
                    className={`p-2.5 rounded-xl border transition-colors ${watching ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-surface-600 border-surface-500 text-surface-200 hover:text-white'}`}>
                    <Heart size={16} className={watching ? 'fill-red-400' : ''} />
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}
                    className="p-2.5 rounded-xl bg-surface-600 border border-surface-500 text-surface-200 hover:text-white transition-colors">
                    <Share2 size={16} />
                  </button>
                </div>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-surface-800 rounded-xl p-3 text-center">
                  <div className="text-surface-200 text-xs mb-1">Receipt Total</div>
                  <div className="text-white font-black text-xl">${receipt.total.toFixed(2)}</div>
                </div>
                <div className="bg-surface-800 rounded-xl p-3 text-center">
                  <div className="text-surface-200 text-xs mb-1">Purchase Date</div>
                  <div className="text-white font-bold text-sm">
                    {receipt.purchase_date ? format(new Date(receipt.purchase_date), 'MMM d, yyyy') : '—'}
                  </div>
                </div>
                <div className={`rounded-xl p-3 text-center border ${isUrgent ? 'bg-red-900/20 border-red-500/30' : 'bg-green-900/10 border-green-500/20'}`}>
                  <div className="text-surface-200 text-xs mb-1">Return By</div>
                  <div className={`font-bold text-sm ${isUrgent ? 'text-red-400' : 'text-green-400'}`}>
                    {receipt.return_by_date ? format(new Date(receipt.return_by_date), 'MMM d, yyyy') : 'No policy'}
                    {daysLeft !== null && <div className="text-xs font-normal">{daysLeft}d left</div>}
                  </div>
                </div>
              </div>

              {/* Store address */}
              {receipt.store_address && (
                <div className="flex items-center gap-2 text-sm text-surface-200 bg-surface-800 rounded-xl px-4 py-2.5">
                  <MapPin size={14} className="text-brand-500 shrink-0" />
                  {[receipt.store_address, receipt.store_city, receipt.store_state, receipt.store_zip].filter(Boolean).join(', ')}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-500 flex items-center gap-2">
                <Barcode size={16} className="text-brand-500" />
                <span className="font-bold text-white">Items ({items.length})</span>
                <span className="text-surface-300 text-xs ml-auto">UPCs visible after purchase</span>
              </div>
              <div className="divide-y divide-surface-600">
                <div className="grid grid-cols-12 px-5 py-2.5 bg-surface-800 text-xs text-surface-200 font-bold uppercase tracking-wider">
                  <span className="col-span-6">Item</span>
                  <span className="col-span-2">Dept</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-2 text-right">Price</span>
                </div>
                {items.map((item, i) => (
                  <div key={item.id} className="grid grid-cols-12 px-5 py-3 items-center text-sm hover:bg-surface-700/50 transition-colors">
                    <div className="col-span-6">
                      <div className="text-white font-medium">{item.name}</div>
                      <div className="text-surface-300 text-xs flex items-center gap-1 mt-0.5">
                        <Barcode size={10} />
                        <span className="blur-sm select-none">012345678901</span>
                        <span className="text-surface-400 no-blur text-[10px]">· unlock after purchase</span>
                      </div>
                    </div>
                    <div className="col-span-2 text-surface-300 text-xs">{item.department ?? '—'}</div>
                    <div className="col-span-2 text-center text-surface-200">{item.quantity}</div>
                    <div className="col-span-2 text-right text-white font-semibold">${item.total_price?.toFixed(2)}</div>
                  </div>
                ))}
                <div className="grid grid-cols-12 px-5 py-3 bg-surface-800 font-bold text-sm">
                  <span className="col-span-8 text-surface-200">Subtotal</span>
                  <span className="col-span-4 text-right text-white">${receipt.subtotal?.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-12 px-5 py-2 bg-surface-800 text-sm">
                  <span className="col-span-8 text-surface-200">Tax</span>
                  <span className="col-span-4 text-right text-surface-200">${receipt.tax?.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-12 px-5 py-3 bg-surface-700 font-black text-sm">
                  <span className="col-span-8 text-white">Total</span>
                  <span className="col-span-4 text-right text-brand-500 text-base">${receipt.total?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment info */}
            {(receipt.payment_method || receipt.last4) && (
              <div className="card p-4 flex items-center gap-3">
                <CreditCard size={18} className="text-surface-200" />
                <span className="text-surface-200 text-sm">Paid with</span>
                <span className="text-white font-semibold text-sm">
                  {receipt.payment_method}{receipt.last4 && ` ····${receipt.last4}`}
                </span>
              </div>
            )}

            {/* Seller info */}
            {seller && (
              <div className="card p-5">
                <div className="font-bold text-white mb-4">About the Seller</div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-500 font-black text-xl">
                    {seller.full_name?.[0]?.toUpperCase() ?? 'S'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white text-lg">{seller.full_name ?? 'Seller'}</div>
                    <div className="flex items-center gap-3 text-sm text-surface-200 mt-1">
                      <span className="flex items-center gap-1">
                        <Star size={13} className="text-yellow-400 fill-yellow-400" />
                        <strong className="text-white">{seller.seller_rating?.toFixed(1) ?? '0.0'}</strong>
                        <span>({seller.seller_rating_count ?? 0} ratings)</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp size={13} className="text-green-400" />
                        {seller.total_sales} sales
                      </span>
                      {seller.is_verified && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <CheckCircle size={13} /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                  <Shield size={20} className="text-green-400" title="Protected seller" />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Buy panel */}
          <div className="space-y-4">
            <div className="card p-5 sticky top-24">
              <div className="text-surface-200 text-xs uppercase tracking-wider mb-1">Listing Price</div>
              <div className="text-brand-500 font-black text-4xl mb-1">${receipt.listing_price?.toFixed(2)}</div>
              <div className="text-surface-300 text-sm mb-5">
                For access to all {items.length} items, barcodes & UPCs
              </div>

              {alreadyPurchased ? (
                <Link href="/orders" className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base mb-3">
                  <CheckCircle size={18} /> View Your Purchase
                </Link>
              ) : (
                <button onClick={handleBuyClick}
                  className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base mb-3">
                  <Zap size={18} className="fill-black" /> Buy It Now
                </button>
              )}

              <button onClick={toggleWatch}
                className={`w-full btn-secondary py-2.5 flex items-center justify-center gap-2 text-sm mb-4 ${watching ? 'border-red-500/40 text-red-400' : ''}`}>
                <Heart size={15} className={watching ? 'fill-red-400' : ''} />
                {watching ? 'Watching' : 'Add to Watchlist'}
              </button>

              {/* Trust signals */}
              <div className="space-y-2.5 border-t border-surface-500 pt-4">
                {[
                  { icon: Shield,       color: 'text-green-400', text: 'Cheetah Buyer Protection' },
                  { icon: CheckCircle,  color: 'text-blue-400',  text: 'Instant receipt access' },
                  { icon: Barcode,      color: 'text-brand-500', text: 'All UPCs & barcodes included' },
                  { icon: AlertCircle,  color: 'text-yellow-400',text: '7-day dispute window' },
                ].map(({ icon: Icon, color, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-xs text-surface-200">
                    <Icon size={13} className={color} /> {text}
                  </div>
                ))}
              </div>

              {/* Payout breakdown for seller */}
              <div className="mt-4 bg-surface-800 rounded-xl p-3 text-xs">
                <div className="flex justify-between text-surface-300 mb-1">
                  <span>Price</span><span>${receipt.listing_price?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-surface-300 mb-1">
                  <span>Buyer protection</span><span>Included</span>
                </div>
                <div className="flex justify-between font-bold text-white border-t border-surface-600 pt-1.5 mt-1.5">
                  <span>You pay</span><span>${receipt.listing_price?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Category / tags */}
            <div className="card p-4">
              <div className="text-xs text-surface-200 mb-2 uppercase tracking-wider font-bold">Category</div>
              <span className="badge-gold">{receipt.category}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout modal */}
      {showCheckout && (
        <CheckoutModal
          receipt={receipt}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => {
            setShowCheckout(false);
            setAlreadyPurchased(true);
            toast.success('Purchase complete! Redirecting to your orders...');
            setTimeout(() => router.push('/orders'), 2000);
          }}
        />
      )}
    </div>
  );
}
