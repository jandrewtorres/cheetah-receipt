'use client';
// src/app/settings/page.tsx
import { useState, useEffect } from 'react';
import Navbar from '@/components/ui/Navbar';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { User, Lock, CreditCard, Bell, ExternalLink, Save, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [tab, setTab]         = useState<'profile'|'security'|'payments'|'notifications'>('profile');

  // Form states
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      setProfile(data);
      setFullName(data?.full_name ?? '');
      setEmail(user.email ?? '');
      setLoading(false);
    };
    load();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('users').update({ full_name: fullName }).eq('id', user.id);
    toast.success('Profile updated!');
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPass !== confirmPass) { toast.error('Passwords do not match'); return; }
    if (newPass.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Password updated!');
    setNewPass(''); setConfirmPass('');
  };

  const openStripe = async () => {
    if (profile?.stripe_account_id) {
      const res = await fetch('/api/stripe/dashboard-link');
      const { url } = await res.json();
      window.open(url, '_blank');
    } else {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const { url } = await res.json();
      window.location.href = url;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/marketplace');
  };

  const TABS = [
    { id: 'profile',       icon: User,        label: 'Profile' },
    { id: 'security',      icon: Lock,        label: 'Security' },
    { id: 'payments',      icon: CreditCard,  label: 'Payments' },
    { id: 'notifications', icon: Bell,        label: 'Notifications' },
  ] as const;

  if (loading) return (
    <div className="min-h-screen bg-surface-900"><Navbar />
      <div className="flex items-center justify-center h-64"><div className="animate-pulse text-surface-200">Loading settings...</div></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />
      <div className="page-container py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-black text-white mb-6">Settings</h1>

          {/* Tab nav */}
          <div className="flex border-b border-surface-500 mb-6 gap-1">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                  tab === id ? 'border-brand-500 text-brand-500' : 'border-transparent text-surface-200 hover:text-white'
                }`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* Profile */}
          {tab === 'profile' && (
            <div className="card p-6 space-y-5">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/20 border-2 border-brand-500/30 flex items-center justify-center text-brand-500 font-black text-2xl">
                  {fullName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <div className="font-bold text-white">{fullName || 'Your Name'}</div>
                  <div className="text-surface-200 text-sm">{email}</div>
                  <div className="flex gap-2 mt-1">
                    {profile?.is_verified && <span className="badge-blue text-xs">Verified</span>}
                    <span className="badge-gray text-xs capitalize">{profile?.role}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="input-label">Full Name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} className="input" placeholder="Your full name" />
              </div>

              <div>
                <label className="input-label">Email</label>
                <input value={email} disabled className="input opacity-50 cursor-not-allowed" />
                <p className="text-surface-300 text-xs mt-1">Email cannot be changed after signup</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 border-t border-surface-500 pt-5">
                {[
                  { label: 'Sales',          value: profile?.total_sales ?? 0 },
                  { label: 'Purchases',      value: profile?.total_purchases ?? 0 },
                  { label: 'Seller Rating',  value: `${profile?.seller_rating?.toFixed(1) ?? '0.0'} ★` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-surface-800 rounded-xl p-3 text-center">
                    <div className="text-white font-bold text-lg">{value}</div>
                    <div className="text-surface-200 text-xs">{label}</div>
                  </div>
                ))}
              </div>

              <button onClick={saveProfile} disabled={saving} className="btn-primary flex items-center gap-2 py-3 px-5">
                <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Security */}
          {tab === 'security' && (
            <div className="card p-6 space-y-5">
              <h2 className="font-bold text-white">Change Password</h2>
              <div>
                <label className="input-label">New Password</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="input" placeholder="Min 8 characters" />
              </div>
              <div>
                <label className="input-label">Confirm Password</label>
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="input" placeholder="Repeat new password" />
              </div>
              <button onClick={changePassword} disabled={saving || !newPass} className="btn-primary flex items-center gap-2 py-3 px-5">
                <Lock size={15} /> {saving ? 'Updating...' : 'Update Password'}
              </button>

              <div className="border-t border-surface-500 pt-5">
                <h2 className="font-bold text-white mb-3">Danger Zone</h2>
                <button onClick={signOut} className="btn-danger flex items-center gap-2 py-3 px-5">
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Payments */}
          {tab === 'payments' && (
            <div className="card p-6 space-y-5">
              <h2 className="font-bold text-white">Stripe Account</h2>
              <p className="text-surface-200 text-sm">
                Connect your bank account to receive payouts when your receipts sell. Powered by Stripe Connect.
              </p>
              <div className="bg-surface-800 rounded-xl p-4 border border-surface-500">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-white">Payout Account</div>
                  {profile?.stripe_account_id ? (
                    <span className="badge-green">Connected</span>
                  ) : (
                    <span className="badge-red">Not Connected</span>
                  )}
                </div>
                {profile?.stripe_account_id ? (
                  <div className="space-y-2 text-sm text-surface-200">
                    <div>Account ID: <span className="font-mono text-white">{profile.stripe_account_id.slice(0, 20)}...</span></div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={openStripe} className="btn-secondary flex items-center gap-2 py-2 px-4 text-sm">
                        <ExternalLink size={13} /> Stripe Dashboard
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={openStripe} className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm">
                    <CreditCard size={14} /> Connect Bank Account
                  </button>
                )}
              </div>

              <div className="bg-surface-800 rounded-xl p-4 border border-surface-500">
                <div className="font-semibold text-white mb-2">Platform Fee</div>
                <div className="text-surface-200 text-sm">Cheetah charges <strong className="text-white">10% per sale</strong>. You receive 90% of each listing price.</div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {tab === 'notifications' && (
            <div className="card p-6 space-y-4">
              <h2 className="font-bold text-white mb-2">Notification Preferences</h2>
              {[
                { label: 'Receipt sold',      sub: 'When a buyer purchases your receipt', key: 'notify_sale' },
                { label: 'Receipt purchased', sub: 'When you buy a receipt',               key: 'notify_purchase' },
                { label: 'Dispute opened',    sub: 'When a buyer opens a dispute',         key: 'notify_dispute' },
                { label: 'Dispute resolved',  sub: 'When admin resolves a dispute',        key: 'notify_resolved' },
                { label: 'Payout sent',       sub: 'When your earnings are transferred',   key: 'notify_payout' },
                { label: 'Listing approved',  sub: 'When admin approves your listing',     key: 'notify_approved' },
              ].map(({ label, sub, key }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-surface-600 last:border-0">
                  <div>
                    <div className="text-white text-sm font-semibold">{label}</div>
                    <div className="text-surface-300 text-xs">{sub}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-5 bg-surface-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-brand-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                </div>
              ))}
              <button className="btn-primary flex items-center gap-2 py-3 px-5 mt-2">
                <Save size={15} /> Save Preferences
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
