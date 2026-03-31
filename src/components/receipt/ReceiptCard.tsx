'use client';
// src/components/receipt/ReceiptCard.tsx
import Link from 'next/link';
import { Receipt } from '@/types';
import { Eye, Star, Clock, Shield, Zap, Barcode } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

interface Props {
  receipt: Receipt;
  view?: 'grid' | 'list';
}

const STORE_COLORS: Record<string, string> = {
  Target:    'from-red-500/20 to-red-600/5',
  Walmart:   'from-blue-500/20 to-blue-600/5',
  'Best Buy':'from-blue-600/20 to-indigo-600/5',
  'Home Depot': 'from-orange-500/20 to-orange-600/5',
  Costco:    'from-red-600/20 to-red-700/5',
  Nike:      'from-surface-400/20 to-surface-500/5',
};

const STORE_EMOJI: Record<string, string> = {
  Target: '🎯', Walmart: '⚡', 'Best Buy': '🔵', 'Home Depot': '🏠',
  Costco: '🔴', Nike: '👟', Amazon: '📦', CVS: '💊',
  Walgreens: '💙', IKEA: '🇸🇪', Default: '🧾',
};

export default function ReceiptCard({ receipt, view = 'grid' }: Props) {
  const seller = receipt.seller as any;
  const items = (receipt as any).receipt_items ?? [];
  const daysLeft = receipt.return_by_date
    ? differenceInDays(new Date(receipt.return_by_date), new Date())
    : null;
  const isUrgent = daysLeft !== null && daysLeft < 7;
  const emoji = STORE_EMOJI[receipt.store_chain ?? ''] ?? STORE_EMOJI.Default;
  const gradient = STORE_COLORS[receipt.store_chain ?? ''] ?? 'from-surface-400/10 to-surface-500/5';

  if (view === 'list') {
    return (
      <Link href={`/marketplace/${receipt.id}`} className="card-hover flex items-center gap-4 p-4 group">
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} border border-surface-500 flex items-center justify-center text-2xl shrink-0`}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-white">{receipt.store_name}</span>
            {receipt.store_number && <span className="text-surface-200 text-xs">{receipt.store_number}</span>}
            <span className="badge-gray">{receipt.category}</span>
          </div>
          <div className="text-surface-200 text-xs">{items.length} items · ${receipt.total.toFixed(2)} receipt value</div>
          {daysLeft !== null && (
            <div className={`text-xs mt-1 font-semibold ${isUrgent ? 'text-red-400' : 'text-green-400'}`}>
              Return by {format(new Date(receipt.return_by_date!), 'MMM d')} ({daysLeft}d left)
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-4">
          {seller && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-surface-200">
              <Star size={11} className="text-yellow-400 fill-yellow-400" />
              {seller.seller_rating?.toFixed(1)} ({seller.total_sales})
            </div>
          )}
          <div className="text-right">
            <div className="text-brand-500 font-black text-xl">${receipt.listing_price.toFixed(2)}</div>
            <div className="text-surface-200 text-xs flex items-center gap-1 justify-end">
              <Eye size={10} /> {receipt.watchers}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/marketplace/${receipt.id}`} className="card-hover flex flex-col group overflow-hidden">
      {/* Store header */}
      <div className={`bg-gradient-to-br ${gradient} border-b border-surface-500 p-4 flex items-center gap-3`}>
        <div className="text-3xl">{emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-[15px] truncate">{receipt.store_name}</div>
          <div className="text-surface-200 text-xs truncate">
            {[receipt.store_number, receipt.store_city, receipt.store_state].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span className="badge-gray shrink-0">{receipt.category}</span>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Value + items */}
        <div className="flex justify-between">
          <div>
            <div className="text-surface-200 text-[10px] uppercase tracking-wider">Receipt Value</div>
            <div className="text-white font-bold text-lg">${receipt.total.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-surface-200 text-[10px] uppercase tracking-wider">Items</div>
            <div className="text-white font-bold text-lg flex items-center gap-1">
              <Barcode size={13} className="text-surface-200" />
              {items.length}
            </div>
          </div>
        </div>

        {/* Return deadline */}
        {daysLeft !== null && (
          <div className={`rounded-lg px-3 py-2 flex justify-between items-center text-xs font-semibold
            ${isUrgent ? 'bg-red-900/30 border border-red-500/30 text-red-400' : 'bg-green-900/20 border border-green-500/20 text-green-400'}`}>
            <span className="flex items-center gap-1.5"><Clock size={11} /> Return by</span>
            <span>{format(new Date(receipt.return_by_date!), 'MMM d, yyyy')}
              {isUrgent && <span className="ml-1 text-red-300">({daysLeft}d!)</span>}
            </span>
          </div>
        )}

        {/* Items preview */}
        <div className="flex-1 space-y-1">
          {items.slice(0, 2).map((item: any) => (
            <div key={item.id} className="flex justify-between text-xs text-surface-200">
              <span className="truncate max-w-[65%]">{item.name}</span>
              <span className="font-semibold">${item.unit_price?.toFixed(2)}</span>
            </div>
          ))}
          {items.length > 2 && (
            <div className="text-xs text-surface-300">+{items.length - 2} more items</div>
          )}
        </div>

        {/* Seller */}
        {seller && (
          <div className="flex items-center gap-2 bg-surface-800 rounded-xl px-3 py-2">
            <div className="w-6 h-6 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-500 text-[11px] font-black">
              {(seller.full_name ?? 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">{seller.full_name ?? 'Seller'}</div>
              <div className="flex items-center gap-1">
                <Star size={9} className="text-yellow-400 fill-yellow-400" />
                <span className="text-surface-200 text-[10px]">{seller.seller_rating?.toFixed(1)} · {seller.total_sales} sales</span>
              </div>
            </div>
            <Shield size={12} className="text-green-400 shrink-0" title="Verified seller" />
          </div>
        )}

        {/* Buy footer */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-surface-200 text-[10px] uppercase tracking-wider">List Price</div>
            <div className="text-brand-500 font-black text-2xl leading-none">${receipt.listing_price.toFixed(2)}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5 group-hover:brightness-110">
              <Zap size={13} className="fill-black" /> Buy Now
            </div>
            <div className="flex items-center gap-2 text-[10px] text-surface-300">
              <span className="flex items-center gap-0.5"><Eye size={9} /> {receipt.watchers}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
