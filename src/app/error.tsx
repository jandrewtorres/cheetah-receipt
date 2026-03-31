'use client';
// src/app/error.tsx
// Global error boundary for Next.js App Router.
// Catches unhandled errors in server components and displays a recovery UI.

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your error tracking service here (e.g. Sentry)
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">⚡</div>
        <h1 className="text-2xl font-black text-white mb-3">Something went wrong</h1>
        <p className="text-surface-200 text-sm mb-2">
          An unexpected error occurred. Our team has been notified.
        </p>
        {error.digest && (
          <p className="text-surface-300 text-xs mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary py-2.5 px-6">
            Try Again
          </button>
          <Link href="/marketplace" className="btn-secondary py-2.5 px-6">
            Go to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
