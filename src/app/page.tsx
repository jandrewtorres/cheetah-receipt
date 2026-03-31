// src/app/page.tsx
import Link from 'next/link';
import { Zap, Shield, Barcode, DollarSign, Upload, Search, Star, ArrowRight, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-900 font-sans">
      {/* Nav */}
      <nav className="bg-surface-800/80 backdrop-blur-xl border-b border-surface-500 sticky top-0 z-50">
        <div className="page-container h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl w-9 h-9 flex items-center justify-center">
              <Zap size={18} className="text-black fill-black" />
            </div>
            <div>
              <div className="font-black text-[17px] text-white leading-none">Cheetah</div>
              <div className="text-[9px] text-brand-500 font-bold tracking-[2px] uppercase leading-none mt-0.5">Receipts</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/marketplace" className="text-surface-200 hover:text-white text-sm font-semibold transition-colors">Browse</Link>
            <Link href="/auth/login"  className="btn-ghost py-2 px-4 text-sm">Sign In</Link>
            <Link href="/auth/signup" className="btn-primary py-2 px-4 text-sm">Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-blue-500/5 pointer-events-none" />
        <div className="page-container py-24 text-center relative">
          <div className="inline-flex items-center gap-2 bg-brand-500/15 border border-brand-500/30 rounded-full px-4 py-1.5 text-brand-500 text-sm font-semibold mb-8">
            <Zap size={14} className="fill-brand-500" /> The world's first receipt marketplace
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tight mb-6">
            Buy & Sell<br />
            <span className="gradient-text">Cash Receipts</span>
          </h1>
          <p className="text-surface-200 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Need a receipt for a return? Have receipts you don't need? Cheetah connects buyers and sellers of verified cash receipts with scanned barcodes, UPCs, and return dates.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/marketplace" className="btn-primary py-4 px-8 text-lg flex items-center justify-center gap-2">
              <Search size={20} /> Browse Receipts
            </Link>
            <Link href="/sell" className="btn-secondary py-4 px-8 text-lg flex items-center justify-center gap-2">
              <Upload size={20} /> Sell a Receipt
            </Link>
          </div>
          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-surface-200">
            {['1,284 active receipts','320+ stores','$6.49 avg price','GPT-4o scanning'].map(s => (
              <span key={s} className="flex items-center gap-1.5">
                <CheckCircle size={13} className="text-green-400" /> {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface-800 border-y border-surface-500 py-20">
        <div className="page-container">
          <h2 className="text-3xl font-black text-white text-center mb-4">How It Works</h2>
          <p className="text-surface-200 text-center mb-14">List or buy a receipt in under 2 minutes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Sellers */}
            <div>
              <div className="badge-gold mb-6 inline-block">For Sellers</div>
              {[
                { icon: Upload,   title: 'Upload Receipt', desc: 'Photo, scan, or PDF. Any cash receipt from any store.' },
                { icon: Zap,      title: 'AI Scans It',    desc: 'GPT-4o extracts all items, UPCs, barcodes, dates, and store info automatically.' },
                { icon: DollarSign,title:'Set Your Price',  desc: 'List for as little as $0.99. Earn 90% — we keep 10%.' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className="flex gap-4 mb-6">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-500 shrink-0">
                      <Icon size={18} />
                    </div>
                    {i < 2 && <div className="w-px flex-1 bg-surface-500 mt-2" />}
                  </div>
                  <div className="pb-6">
                    <div className="font-bold text-white mb-1">{title}</div>
                    <div className="text-surface-200 text-sm">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Buyers */}
            <div>
              <div className="badge-blue mb-6 inline-block">For Buyers</div>
              {[
                { icon: Search,   title: 'Browse Marketplace', desc: 'Search by store, item, UPC or category. Filter by price and return date.' },
                { icon: Shield,   title: 'Buy Securely',       desc: 'Pay with any card. Cheetah Buyer Protection on every purchase.' },
                { icon: Barcode,  title: 'Get Full Data',      desc: 'Instantly access all items, UPCs, barcodes, store number, and dates.' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className="flex gap-4 mb-6">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <Icon size={18} />
                    </div>
                    {i < 2 && <div className="w-px flex-1 bg-surface-500 mt-2" />}
                  </div>
                  <div className="pb-6">
                    <div className="font-bold text-white mb-1">{title}</div>
                    <div className="text-surface-200 text-sm">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="page-container">
          <h2 className="text-3xl font-black text-white text-center mb-14">Built for Trust</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Zap,        color: 'text-brand-500 bg-brand-500/15',  title: 'GPT-4o OCR',         desc: 'AI extracts every item, UPC, date and store detail. Manual review for anything it can\'t read.' },
              { icon: Shield,     color: 'text-green-400 bg-green-400/10',  title: 'Buyer Protection',   desc: '7-day dispute window on every purchase. Admin mediation and refunds when warranted.' },
              { icon: Barcode,    color: 'text-blue-400 bg-blue-400/10',    title: 'Verified Barcodes',  desc: 'All UPCs and barcodes verified for format and cross-checked against known fraud patterns.' },
              { icon: DollarSign, color: 'text-yellow-400 bg-yellow-400/10',title: 'Stripe Payouts',     desc: 'Sellers get paid via Stripe Connect. Fast bank transfers. No waiting around.' },
              { icon: Star,       color: 'text-purple-400 bg-purple-400/10',title: 'Ratings System',     desc: 'Buyer and seller ratings after every transaction. Like eBay, trust is earned.' },
              { icon: CheckCircle,color: 'text-red-400 bg-red-400/10',      title: 'Fraud Detection',    desc: '9-point fraud scoring on every receipt. Duplicates, date checks, math verification and more.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="card p-5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color.split(' ')[1]}`}>
                  <Icon size={20} className={color.split(' ')[0]} />
                </div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-surface-200 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-brand-500/10 to-brand-600/5 border-t border-brand-500/20 py-20">
        <div className="page-container text-center">
          <h2 className="text-4xl font-black text-white mb-4">Ready to Start?</h2>
          <p className="text-surface-200 text-lg mb-8">Free to join. List your first receipt in under 2 minutes.</p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signup" className="btn-primary py-4 px-8 text-lg flex items-center gap-2">
              Create Free Account <ArrowRight size={18} />
            </Link>
            <Link href="/marketplace" className="btn-ghost py-4 px-8 text-lg">Browse First</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-800 border-t border-surface-500 py-10">
        <div className="page-container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-brand-500 fill-brand-500" />
            <span className="font-black text-brand-500">Cheetah Receipts</span>
          </div>
          <div className="flex gap-6 text-sm text-surface-300">
            {['Marketplace','How It Works','Seller Guide','Buyer Protection','Help Center','Privacy','Terms'].map(l => (
              <Link key={l} href="#" className="hover:text-white transition-colors">{l}</Link>
            ))}
          </div>
          <div className="text-surface-400 text-xs">© 2026 Cheetah Receipts</div>
        </div>
      </footer>
    </div>
  );
}
