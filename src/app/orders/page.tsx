'use client';
// src/app/orders/page.tsx
import { useState, useEffect } from 'react';
import Navbar from '@/components/ui/Navbar';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { Package, Barcode, Download, Star, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          receipt:receipts(
            *, receipt_items(*),
            seller:users!receipts_seller_id_fkey(full_name, seller_rating, total_sales)
          )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
      setOrders(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const submitRating = async (orderId: string, rating: number, review: string) => {
    const res = await fetch(`/api/orders/${orderId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, review }),
    });
    if (res.ok) {
      toast.success('Rating submitted!');
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, buyer_rated: true, buyer_rating: rating } : o));
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-surface-900"><Navbar />
      <div className="flex items-center justify-center h-64"><div className="animate-pulse text-surface-200">Loading orders...</div></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />
      <div className="page-container py-8">
        <h1 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
          <Package size={22} className="text-brand-500" /> My Purchases
        </h1>
        <p className="text-surface-200 text-sm mb-8">{orders.length} receipt{orders.length !== 1 ? 's' : ''} purchased</p>

        {orders.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-xl font-bold text-white mb-2">No purchases yet</h3>
            <Link href="/marketplace" className="btn-primary inline-flex mt-4">Browse Receipts</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const receipt = order.receipt as any;
              const items = receipt?.receipt_items ?? [];
              const seller = receipt?.seller;
              const isExpanded = expandedId === order.id;
              const isPaid = ['paid','delivered','completed'].includes(order.status);

              return (
                <div key={order.id} className="card overflow-hidden">
                  {/* Order header */}
                  <div className="p-5 flex items-center gap-4 cursor-pointer hover:bg-surface-600/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                    <div className="text-3xl">🧾</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-white">{receipt?.store_name}</span>
                        {receipt?.store_number && <span className="text-surface-200 text-xs">{receipt.store_number}</span>}
                      </div>
                      <div className="text-surface-200 text-xs">
                        {items.length} items · ${receipt?.total?.toFixed(2)} value ·
                        Purchased {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={isPaid ? 'badge-green' : 'badge-gold'}>{order.status}</span>
                      <span className="text-brand-500 font-black text-lg">${order.amount?.toFixed(2)}</span>
                      <span className="text-surface-200 text-lg">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded: full receipt data */}
                  {isExpanded && isPaid && (
                    <div className="border-t border-surface-500 p-5 animate-fade-in">
                      {/* Receipt details */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                        {[
                          { label: 'Store', value: receipt.store_name },
                          { label: 'Location', value: [receipt.store_city, receipt.store_state].filter(Boolean).join(', ') || '—' },
                          { label: 'Store #', value: receipt.store_number ?? '—' },
                          { label: 'Purchase Date', value: receipt.purchase_date ? format(new Date(receipt.purchase_date), 'MMM d, yyyy') : '—' },
                          { label: 'Return By', value: receipt.return_by_date ? format(new Date(receipt.return_by_date), 'MMM d, yyyy') : '—' },
                          { label: 'Payment', value: receipt.payment_method ?? '—' },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-surface-800 rounded-xl p-3">
                            <div className="text-surface-200 text-xs mb-1">{label}</div>
                            <div className="text-white text-sm font-semibold">{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Items table */}
                      <div className="mb-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Barcode size={15} className="text-brand-500" />
                          <span className="font-bold text-white text-sm">Items & Barcodes</span>
                        </div>
                        <div className="card overflow-hidden">
                          <div className="grid grid-cols-12 px-4 py-2 bg-surface-800 border-b border-surface-500 text-xs text-surface-200 font-bold uppercase tracking-wider">
                            <span className="col-span-5">Item</span>
                            <span className="col-span-4">UPC / Barcode</span>
                            <span className="col-span-1 text-center">Qty</span>
                            <span className="col-span-2 text-right">Price</span>
                          </div>
                          {items.map((item: any) => (
                            <div key={item.id} className="grid grid-cols-12 px-4 py-3 border-b border-surface-600 last:border-0 items-center text-sm">
                              <span className="col-span-5 text-white font-medium truncate">{item.name}</span>
                              <span className="col-span-4 font-mono text-xs text-surface-200 truncate">{item.upc ?? item.barcode ?? '—'}</span>
                              <span className="col-span-1 text-center text-surface-200">{item.quantity}</span>
                              <span className="col-span-2 text-right text-white font-semibold">${item.total_price?.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="px-4 py-3 bg-surface-800 flex justify-between text-sm font-bold">
                            <span className="text-surface-200">Total</span>
                            <span className="text-white">${receipt.total?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Seller info */}
                      {seller && (
                        <div className="flex items-center gap-3 bg-surface-800 rounded-xl px-4 py-3 mb-5">
                          <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-500 font-black">
                            {seller.full_name?.[0]?.toUpperCase() ?? 'S'}
                          </div>
                          <div className="flex-1">
                            <div className="text-white text-sm font-semibold">{seller.full_name}</div>
                            <div className="flex items-center gap-1 text-xs text-surface-200">
                              <Star size={10} className="text-yellow-400 fill-yellow-400" />
                              {seller.seller_rating?.toFixed(1)} · {seller.total_sales} sales
                            </div>
                          </div>
                          <CheckCircle size={14} className="text-green-400" />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => {
                          const data = JSON.stringify({ receipt: receipt, items }, null, 2);
                          const blob = new Blob([data], { type: 'application/json' });
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = `receipt-${receipt.store_name}-${order.id.slice(0,8)}.json`;
                          a.click();
                        }} className="btn-secondary flex items-center gap-2 py-2.5 px-4 text-sm">
                          <Download size={14} /> Export Data
                        </button>

                        {!order.buyer_rated && (
                          <RatingWidget orderId={order.id} onRate={submitRating} />
                        )}

                        {['paid','delivered','completed'].includes(order.status) && (
                          <Link href={`/disputes/open?order=${order.id}`}
                            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-semibold transition-colors ml-auto">
                            <AlertTriangle size={14} /> Open Dispute
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {isExpanded && !isPaid && (
                    <div className="border-t border-surface-500 p-5 text-center text-surface-200 text-sm">
                      Receipt data will be available once payment is confirmed.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RatingWidget({ orderId, onRate }: { orderId: string; onRate: (id: string, r: number, rev: string) => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover]   = useState(0);
  const [review, setReview] = useState('');
  const [open, setOpen]     = useState(false);

  return open ? (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(n => (
          <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}
            className={`text-xl ${n <= (hover || rating) ? 'text-yellow-400' : 'text-surface-400'}`}>★</button>
        ))}
      </div>
      <input value={review} onChange={e => setReview(e.target.value)} placeholder="Optional review..." className="input py-1.5 text-xs w-40" />
      <button onClick={() => { if (rating > 0) onRate(orderId, rating, review); setOpen(false); }}
        disabled={!rating} className="btn-primary py-1.5 px-3 text-xs">Submit</button>
    </div>
  ) : (
    <button onClick={() => setOpen(true)} className="btn-secondary flex items-center gap-2 py-2.5 px-4 text-sm">
      <Star size={14} /> Rate Seller
    </button>
  );
}
