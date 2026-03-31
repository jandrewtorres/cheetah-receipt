'use client';
// src/app/disputes/open/page.tsx
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/ui/Navbar';
import toast from 'react-hot-toast';
import { AlertTriangle, Upload, X } from 'lucide-react';

const REASONS = [
  { value: 'receipt_not_as_described', label: 'Receipt not as described' },
  { value: 'receipt_already_used',     label: 'Receipt was already used' },
  { value: 'duplicate_receipt',        label: 'Duplicate receipt' },
  { value: 'missing_items',            label: 'Items missing from receipt' },
  { value: 'wrong_store',              label: 'Wrong store / location' },
  { value: 'fraudulent_receipt',       label: 'Fraudulent receipt' },
  { value: 'other',                    label: 'Other' },
];

function OpenDisputeForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const orderId      = searchParams.get('order') ?? '';

  const [reason,      setReason]      = useState('');
  const [description, setDescription] = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) { toast.error('No order specified'); return; }
    if (!reason)  { toast.error('Please select a reason'); return; }
    if (description.length < 20) { toast.error('Please provide more detail (20 chars min)'); return; }
    setSubmitting(true);
    const res = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, reason, description }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) { toast.error(json.error ?? 'Failed to open dispute'); return; }
    toast.success('Dispute opened. Our team will review within 24 hours.');
    router.push(`/disputes/${json.data.id}`);
  };

  return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />
      <div className="page-container py-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <AlertTriangle size={24} className="text-red-400" />
            <div>
              <h1 className="text-2xl font-black text-white">Open a Dispute</h1>
              <p className="text-surface-200 text-sm">Our team typically responds within 24 hours</p>
            </div>
          </div>
          <form onSubmit={submit} className="card p-6 space-y-5">
            <div>
              <label className="input-label">Reason *</label>
              <select value={reason} onChange={e => setReason(e.target.value)} className="input appearance-none cursor-pointer" required>
                <option value="">Select a reason...</option>
                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Description * <span className="normal-case font-normal text-surface-300">(min 20 chars)</span></label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={5} placeholder="Describe the issue in detail..." required minLength={20}
                className="input resize-none" />
              <div className="text-right text-xs text-surface-300 mt-1">{description.length} chars</div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => router.back()} className="btn-ghost flex-1 py-3">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-danger flex-1 py-3 font-bold">
                {submitting ? 'Submitting...' : 'Open Dispute'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function OpenDisputePage() {
  return <Suspense><OpenDisputeForm /></Suspense>;
}
