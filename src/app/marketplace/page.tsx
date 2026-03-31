'use client';
// src/app/marketplace/page.tsx
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/ui/Navbar';
import ReceiptCard from '@/components/receipt/ReceiptCard';
import { createClient } from '@/lib/supabase/client';
import type { Receipt } from '@/types';
import {
  Search, SlidersHorizontal, LayoutGrid, List,
  ChevronDown, Zap, TrendingUp, Clock, DollarSign
} from 'lucide-react';

const CATEGORIES = ['All','Electronics','Appliances','Hardware','Wholesale','Apparel','General','Grocery','Pharmacy','Home & Garden'];
const STORES     = ['All Stores','Target','Walmart','Best Buy','Home Depot','Costco','Nike','Amazon','CVS','Walgreens','IKEA'];
const SORTS = [
  { value: 'newest',        label: 'Newest First' },
  { value: 'price_asc',     label: 'Price: Low → High' },
  { value: 'price_desc',    label: 'Price: High → Low' },
  { value: 'highest_value', label: 'Highest Receipt Value' },
  { value: 'ending_soon',   label: 'Ending Soon' },
  { value: 'most_watched',  label: 'Most Watched' },
];

function MarketplaceInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [search,   setSearch]   = useState(searchParams.get('q') ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? 'All');
  const [store,    setStore]    = useState('All Stores');
  const [sort,     setSort]     = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const PER_PAGE = 24;

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('receipts')
        .select('*, seller:users!receipts_seller_id_fkey(full_name, seller_rating, total_sales), receipt_items(id, name, upc, unit_price)', { count: 'exact' })
        .eq('status', 'active');

      // Full-text search
      if (search) {
        query = query.or(`store_name.ilike.%${search}%,store_chain.ilike.%${search}%`);
      }
      if (category !== 'All') query = query.eq('category', category);
      if (store !== 'All Stores') query = query.eq('store_chain', store);
      if (minPrice) query = query.gte('listing_price', parseFloat(minPrice));
      if (maxPrice) query = query.lte('listing_price', parseFloat(maxPrice));

      // Sort
      switch (sort) {
        case 'price_asc':     query = query.order('listing_price', { ascending: true }); break;
        case 'price_desc':    query = query.order('listing_price', { ascending: false }); break;
        case 'highest_value': query = query.order('total', { ascending: false }); break;
        case 'ending_soon':   query = query.order('return_by_date', { ascending: true }); break;
        case 'most_watched':  query = query.order('watchers', { ascending: false }); break;
        default:              query = query.order('created_at', { ascending: false });
      }

      const { data, count, error } = await query
        .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

      if (!error) {
        setReceipts(data as unknown as Receipt[]);
        setTotal(count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [search, category, store, sort, minPrice, maxPrice, page]);

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);
  useEffect(() => { setPage(1); }, [search, category, store, sort, minPrice, maxPrice]);

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />

      {/* Hero bar */}
      <div className="bg-surface-800 border-b border-surface-500">
        <div className="page-container py-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                <Zap size={22} className="text-brand-500 fill-brand-500" />
                Receipt Marketplace
              </h1>
              <p className="text-surface-200 text-sm mt-1">
                {loading ? '...' : `${total.toLocaleString()} verified receipts available`}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { icon: TrendingUp, label: '1,284', sub: 'Active' },
                { icon: DollarSign, label: '$6.49', sub: 'Avg Price' },
                { icon: Clock,      label: '< 2min', sub: 'Avg List' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={sub} className="flex items-center gap-2 bg-surface-700 border border-surface-500 rounded-xl px-3 py-2">
                  <Icon size={14} className="text-brand-500" />
                  <div>
                    <div className="text-white font-bold text-sm leading-none">{label}</div>
                    <div className="text-surface-200 text-[10px]">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="bg-surface-800 border-b border-surface-600 sticky top-16 z-40">
        <div className="page-container">
          <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                  category === c
                    ? 'bg-brand-500/15 text-brand-500 border border-brand-500/30'
                    : 'text-surface-200 hover:text-white hover:bg-surface-600'
                }`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container py-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-200" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search store, item, UPC..."
              className="input pl-10 py-2.5 text-sm"
            />
          </div>

          {/* Store filter */}
          <div className="relative">
            <select value={store} onChange={e => setStore(e.target.value)}
              className="input py-2.5 pr-8 text-sm appearance-none cursor-pointer min-w-[140px]">
              {STORES.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200 pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="input py-2.5 pr-8 text-sm appearance-none cursor-pointer min-w-[160px]">
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200 pointer-events-none" />
          </div>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 btn-secondary py-2.5 px-4 text-sm ${showFilters ? 'border-brand-500/50 text-brand-500' : ''}`}>
            <SlidersHorizontal size={14} /> Filters
          </button>

          {/* View mode */}
          <div className="flex border border-surface-500 rounded-xl overflow-hidden">
            {[['grid', LayoutGrid], ['list', List]].map(([mode, Icon]) => (
              <button key={mode as string} onClick={() => setViewMode(mode as 'grid' | 'list')}
                className={`p-2.5 transition-colors ${viewMode === mode ? 'bg-brand-500/20 text-brand-500' : 'bg-surface-600 text-surface-200 hover:text-white'}`}>
                {Icon && <Icon size={15} />}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="card p-4 mb-6 flex flex-wrap gap-4 animate-fade-in">
            <div>
              <label className="input-label">Min Price ($)</label>
              <input value={minPrice} onChange={e => setMinPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="input w-32 py-2 text-sm" />
            </div>
            <div>
              <label className="input-label">Max Price ($)</label>
              <input value={maxPrice} onChange={e => setMaxPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="999" className="input w-32 py-2 text-sm" />
            </div>
            <div className="flex items-end">
              <button onClick={() => { setMinPrice(''); setMaxPrice(''); setCategory('All'); setStore('All Stores'); }}
                className="btn-ghost py-2 px-4 text-sm">Clear All</button>
            </div>
          </div>
        )}

        {/* Results header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-surface-200 text-sm">
            {loading ? 'Loading...' : (
              <>
                <span className="font-semibold text-white">{total.toLocaleString()}</span> receipts
                {search && <span> for "<span className="text-brand-500">{search}</span>"</span>}
                {category !== 'All' && <span> in <span className="text-brand-500">{category}</span></span>}
              </>
            )}
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card h-72 animate-pulse bg-surface-600" />
            ))}
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">No receipts found</h3>
            <p className="text-surface-200 mb-6">Try adjusting your search or filters</p>
            <button onClick={() => { setSearch(''); setCategory('All'); setStore('All Stores'); }} className="btn-secondary">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
            {receipts.map(r => <ReceiptCard key={r.id} receipt={r} view={viewMode} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-2 px-4 text-sm disabled:opacity-30">← Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${page === p ? 'bg-brand-500 text-black' : 'btn-secondary'}`}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary py-2 px-4 text-sm disabled:opacity-30">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return <Suspense fallback={<div className="min-h-screen bg-surface-900" />}><MarketplaceInner /></Suspense>;
}
