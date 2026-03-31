'use client';
// src/app/auth/forgot-password/page.tsx
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Zap, Mail, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  };

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

          {sent ? (
            <div className="card p-8 text-center">
              <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-black text-white mb-2">Check your email</h2>
              <p className="text-surface-200 text-sm mb-6">
                We sent a password reset link to <strong className="text-white">{email}</strong>.
                Check your inbox (and spam folder).
              </p>
              <Link href="/auth/login" className="btn-primary w-full py-3 flex items-center justify-center">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black text-white mb-1">Forgot your password?</h1>
              <p className="text-surface-200 text-sm">Enter your email and we'll send a reset link.</p>
            </>
          )}
        </div>

        {!sent && (
          <div className="card p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="input-label">Email Address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-200" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="input pl-10"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-center text-surface-200 text-sm mt-5">
              Remember your password?{' '}
              <Link href="/auth/login" className="text-brand-500 font-semibold hover:text-brand-400">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
