'use client';
// src/app/auth/signup/page.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Zap, Mail, Lock, User, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function SignupPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  if (done) return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-white mb-2">Check your email!</h2>
        <p className="text-surface-200 mb-4">We sent a confirmation link to <strong className="text-white">{email}</strong></p>
        <Link href="/auth/login" className="btn-primary w-full py-3 flex items-center justify-center">Back to Sign In</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/marketplace" className="inline-flex items-center gap-2 mb-6">
            <div className="bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl w-10 h-10 flex items-center justify-center">
              <Zap size={20} className="text-black fill-black" />
            </div>
            <div className="text-left">
              <div className="font-black text-xl text-white">Cheetah</div>
              <div className="text-[10px] text-brand-500 font-bold tracking-widest uppercase">Receipts</div>
            </div>
          </Link>
          <h1 className="text-2xl font-black text-white mb-1">Create your account</h1>
          <p className="text-surface-200 text-sm">Free to join. Start buying or selling in minutes.</p>
        </div>

        <div className="card p-6">
          <button onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 btn-secondary py-3 mb-5">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-surface-500" />
            <span className="text-surface-300 text-xs">or email</span>
            <div className="flex-1 h-px bg-surface-500" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="input-label">Full Name</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-200" />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" required className="input pl-10" />
              </div>
            </div>
            <div>
              <label className="input-label">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-200" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className="input pl-10" />
              </div>
            </div>
            <div>
              <label className="input-label">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-200" />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" required minLength={8} className="input pl-10 pr-10" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-200 hover:text-white">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="bg-surface-800 rounded-xl p-3 space-y-1.5">
              {['Buy and sell receipts instantly', 'GPT-4o powered OCR scanning', 'Stripe-protected payments', 'Buyer & seller protection'].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-surface-200">
                  <CheckCircle size={11} className="text-green-400 shrink-0" /> {f}
                </div>
              ))}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Creating Account...' : 'Create Free Account'}
            </button>
          </form>

          <p className="text-center text-surface-200 text-sm mt-5">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-brand-500 font-semibold hover:text-brand-400">Sign in</Link>
          </p>
          <p className="text-center text-surface-300 text-xs mt-3">
            By signing up you agree to our{' '}
            <Link href="/terms" className="text-surface-200 hover:text-white">Terms</Link> and{' '}
            <Link href="/privacy" className="text-surface-200 hover:text-white">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
