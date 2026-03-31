'use client';
// src/components/checkout/CheckoutModal.tsx
// Stripe Elements payment form. Creates order → gets client_secret → confirms payment.

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { X, Shield, Lock, Zap, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Props {
  receipt: { id: string; store_name: string; listing_price: number; total: number; seller_id: string };
  onClose: () => void;
  onSuccess: () => void;
}

// ── Outer wrapper: fetches client_secret and mounts Elements ─────────────────
export default function CheckoutModal({ receipt, onClose, onSuccess }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId]           = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    const createOrder = async () => {
      try {
        const res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receipt_id: receipt.id }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? 'Could not start checkout');
          setLoading(false);
          return;
        }
        setClientSecret(json.data.client_secret);
        setOrderId(json.data.order_id);
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    createOrder();
  }, [receipt.id]);

  const stripeOptions = {
    clientSecret: clientSecret ?? undefined,
    appearance: {
      theme: 'night' as const,
      variables: {
        colorPrimary: '#f59e0b',
        colorBackground: '#111827',
        colorText: '#f1f5f9',
        colorDanger: '#f87171',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        borderRadius: '12px',
        spacingUnit: '4px',
      },
    },
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-500">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-brand-500 fill-brand-500" />
            <span className="font-black text-white text-lg">Checkout</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-500 text-surface-200 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Order summary */}
        <div className="p-5 border-b border-surface-500 bg-surface-800">
          <div className="font-semibold text-white mb-3">{receipt.store_name} Receipt</div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-surface-200">
              <span>Receipt value</span><span>${receipt.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-surface-200">
              <span>Listing price</span><span>${receipt.listing_price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-surface-200">
              <span>Buyer protection</span><span className="text-green-400">Included</span>
            </div>
            <div className="flex justify-between font-black text-white text-base border-t border-surface-600 pt-2 mt-2">
              <span>Total</span><span className="text-brand-500">${receipt.listing_price.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment form */}
        <div className="p-5">
          {loading && (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-surface-200 text-sm">Preparing secure checkout...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {clientSecret && (
            <Elements stripe={stripePromise} options={stripeOptions}>
              <PaymentForm
                receipt={receipt}
                orderId={orderId!}
                onSuccess={onSuccess}
                onClose={onClose}
              />
            </Elements>
          )}

          {/* Security badges */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-surface-300">
            <span className="flex items-center gap-1"><Lock size={11} /> SSL Encrypted</span>
            <span className="flex items-center gap-1"><Shield size={11} /> Buyer Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inner form: uses Stripe hooks ─────────────────────────────────────────────
function PaymentForm({ receipt, orderId, onSuccess, onClose }: {
  receipt: Props['receipt'];
  orderId: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? 'Payment failed');
      setProcessing(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders?success=true`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed');
      setProcessing(false);
      return;
    }

    setSucceeded(true);
    setProcessing(false);
    setTimeout(onSuccess, 1500);
  };

  if (succeeded) return (
    <div className="text-center py-8">
      <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
      <div className="font-black text-white text-xl mb-1">Payment Successful!</div>
      <div className="text-surface-200 text-sm">Redirecting to your receipt...</div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: 'tabs' }} />

      {error && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm mt-4">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={processing || !stripe}
        className="btn-primary w-full py-3.5 mt-5 flex items-center justify-center gap-2 text-base"
      >
        {processing ? (
          <>
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Zap size={18} className="fill-black" />
            Pay ${receipt.listing_price.toFixed(2)}
          </>
        )}
      </button>
    </form>
  );
}
