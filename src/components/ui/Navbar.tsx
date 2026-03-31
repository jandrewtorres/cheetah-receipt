'use client';
// src/components/ui/Navbar.tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import {
  Zap, Search, Bell, ShoppingCart, Upload, Menu, X,
  User as UserIcon, LayoutDashboard, Package, LogOut, Shield
} from 'lucide-react';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; role: string } | null>(null);
  const [notifCount, setNotifCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase.from('users').select('full_name, role').eq('id', user.id).single()
          .then(({ data }) => setProfile(data));
        supabase.from('notifications').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('read', false)
          .then(({ count }) => setNotifCount(count ?? 0));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/marketplace?q=${encodeURIComponent(search.trim())}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/marketplace');
    setProfileOpen(false);
  };

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <nav className="bg-surface-800 border-b border-surface-500 sticky top-0 z-50">
      <div className="page-container">
        <div className="flex items-center h-16 gap-4">

          {/* Logo */}
          <Link href="/marketplace" className="flex items-center gap-2.5 shrink-0">
            <div className="bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl w-9 h-9 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Zap size={18} className="text-black fill-black" />
            </div>
            <div className="hidden sm:block">
              <div className="font-black text-[17px] text-white leading-none tracking-tight">Cheetah</div>
              <div className="text-[9px] text-brand-500 font-bold tracking-[2px] uppercase leading-none mt-0.5">Receipts</div>
            </div>
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-200" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search receipts, stores, items..."
                className="input pl-10 py-2.5 text-sm"
              />
            </div>
          </form>

          {/* Nav links (desktop) */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { href: '/marketplace', label: 'Browse' },
              { href: '/sell', label: 'Sell' },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isActive(href) ? 'text-brand-500 bg-brand-500/10' : 'text-surface-100 hover:text-white hover:bg-surface-600'
                }`}>
                {label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-auto md:ml-0">
            {/* Sell button */}
            <Link href="/sell" className="hidden sm:flex items-center gap-2 btn-primary py-2 px-4 text-sm">
              <Upload size={14} /> Sell Receipt
            </Link>

            {user ? (
              <>
                {/* Notifications */}
                <Link href="/notifications" className="relative p-2 rounded-xl bg-surface-600 border border-surface-500 text-surface-100 hover:text-white hover:bg-surface-500 transition-colors">
                  <Bell size={17} />
                  {notifCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </Link>

                {/* Profile dropdown */}
                <div className="relative">
                  <button onClick={() => setProfileOpen(v => !v)}
                    className="flex items-center gap-2 p-1.5 rounded-xl bg-surface-600 border border-surface-500 hover:bg-surface-500 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-500 text-xs font-black">
                      {profile?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 card shadow-2xl shadow-black/50 py-1 z-50 animate-fade-in">
                      <div className="px-4 py-3 border-b border-surface-500">
                        <div className="font-bold text-white text-sm truncate">{profile?.full_name ?? 'User'}</div>
                        <div className="text-surface-200 text-xs truncate">{user.email}</div>
                      </div>
                      {[
                        { href: '/dashboard', icon: LayoutDashboard, label: 'Seller Dashboard' },
                        { href: '/orders',    icon: Package,         label: 'My Orders' },
                        { href: '/settings',  icon: UserIcon,        label: 'Settings' },
                        ...(profile?.role === 'admin' ? [{ href: '/admin', icon: Shield, label: 'Admin Panel' }] : []),
                      ].map(({ href, icon: Icon, label }) => (
                        <Link key={href} href={href} onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-surface-100 hover:text-white hover:bg-surface-600 transition-colors">
                          <Icon size={15} />
                          {label}
                        </Link>
                      ))}
                      <div className="border-t border-surface-500 mt-1">
                        <button onClick={handleSignOut}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-surface-600 transition-colors">
                          <LogOut size={15} /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login" className="btn-ghost py-2 px-4 text-sm">Sign In</Link>
                <Link href="/auth/signup" className="btn-primary py-2 px-4 text-sm">Join Free</Link>
              </div>
            )}

            {/* Mobile menu */}
            <button onClick={() => setMobileOpen(v => !v)} className="md:hidden p-2 rounded-xl bg-surface-600 border border-surface-500 text-surface-100">
              {mobileOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-surface-500 py-3 space-y-1 animate-fade-in">
            {[
              { href: '/marketplace', label: 'Browse Receipts' },
              { href: '/sell',        label: 'Sell a Receipt' },
              { href: '/dashboard',   label: 'Dashboard' },
              { href: '/orders',      label: 'My Orders' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-surface-100 hover:text-white hover:bg-surface-600 transition-colors">
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
