'use client';
// src/app/sell/page.tsx
// Multi-step receipt upload flow:
// 1. Upload → 2. Scanning → 3. Manual Review (if needed) → 4. Set Price → 5. Live

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/ui/Navbar';
import toast from 'react-hot-toast';
import {
  Upload, ScanLine, CheckCircle, AlertCircle, DollarSign,
  Camera, FileText, Link as LinkIcon, Edit3, Zap, ChevronRight
} from 'lucide-react';
import type { OcrResult } from '@/types';

type Step = 'upload' | 'scanning' | 'review' | 'price' | 'done';

const CATEGORIES = ['General','Electronics','Appliances','Hardware','Wholesale','Apparel','Grocery','Pharmacy','Home & Garden'];
const CONFIDENCE_COLOR = (c: number) => c >= 80 ? 'text-green-400' : c >= 60 ? 'text-yellow-400' : 'text-red-400';

export default function SellPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep]           = useState<Step>('upload');
  const [scanPct, setScanPct]     = useState(0);
  const [scanMsg, setScanMsg]     = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [fraudNeeded, setFraudNeeded] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [itemCorrections, setItemCorrections] = useState<Record<string, Record<string, string>>>({});
  const [listingPrice, setListingPrice] = useState('');
  const [category, setCategory]   = useState('General');
  const [listedReceipt, setListedReceipt] = useState<any>(null);

  // ── Upload handler ─────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setStep('scanning');
    setScanPct(0);

    const scanMessages = [
      'Uploading image...',
      'Detecting store information...',
      'Extracting line items...',
      'Reading barcodes & UPCs...',
      'Verifying dates...',
      'Running fraud checks...',
      'Finalizing...',
    ];

    // Animate progress while waiting for API
    let msgIdx = 0;
    setScanMsg(scanMessages[0]);
    const interval = setInterval(() => {
      setScanPct(p => {
        const next = Math.min(p + Math.random() * 12 + 3, 88);
        msgIdx = Math.min(Math.floor(next / 14), scanMessages.length - 1);
        setScanMsg(scanMessages[msgIdx]);
        return next;
      });
    }, 400);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/receipts/scan', { method: 'POST', body: fd });
      const json = await res.json();

      clearInterval(interval);

      if (!res.ok) {
        if (json.code === 'FRAUD_REJECTED') {
          toast.error('Receipt could not be accepted: ' + (json.fraud_flags?.[0] ?? 'Duplicate detected'));
          setStep('upload');
          return;
        }
        throw new Error(json.error ?? 'Scan failed');
      }

      setScanPct(100);
      setScanMsg('Complete!');

      await new Promise(r => setTimeout(r, 600));

      setReceiptId(json.data.receipt_id);
      setOcrResult(json.data.ocr);
      setFraudNeeded(json.data.fraud.needs_review);

      if (json.data.needs_manual_input) {
        setStep('review');
      } else {
        setStep('price');
      }
    } catch (err: any) {
      clearInterval(interval);
      toast.error(err.message ?? 'Scan failed. Please try again.');
      setStep('upload');
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Manual review submit ───────────────────────────────────────────────────
  const submitReview = async () => {
    if (!receiptId) return;
    try {
      const items = ocrResult?.items
        .filter(item => item.name.needs_review)
        .map((item, i) => ({
          id: (item as any).id ?? i,
          ...itemCorrections[i],
        })) ?? [];

      const res = await fetch(`/api/receipts/${receiptId}/manual-review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...corrections, items }),
      });

      if (!res.ok) throw new Error('Failed to save corrections');

      const json = await res.json();
      if (json.data.still_needs_review) {
        toast.error('Please fill in all highlighted fields');
        return;
      }
      setStep('price');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── List receipt ───────────────────────────────────────────────────────────
  const listReceipt = async () => {
    if (!receiptId || !listingPrice) return;
    const price = parseFloat(listingPrice);
    if (isNaN(price) || price < 0.99) {
      toast.error('Minimum listing price is $0.99');
      return;
    }
    try {
      const res = await fetch(`/api/receipts/${receiptId}/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_price: price, category }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setListedReceipt(json.data);
      setStep('done');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to list receipt');
    }
  };

  const payout = listingPrice ? parseFloat(listingPrice) * 0.90 : 0;

  // ─── RENDER STEPS ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-900">
      <Navbar />

      <div className="page-container py-10">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white mb-2 flex items-center justify-center gap-2">
              <Zap size={28} className="text-brand-500 fill-brand-500" /> Sell a Receipt
            </h1>
            <p className="text-surface-200">Upload your receipt and start earning in under 2 minutes</p>
          </div>

          {/* Progress */}
          {step !== 'done' && (
            <div className="flex items-center gap-2 mb-8">
              {(['upload','scanning','review','price'] as Step[]).map((s, i, arr) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-2 ${i < arr.indexOf(step) ? 'text-brand-500' : i === arr.indexOf(step) ? 'text-white' : 'text-surface-300'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border
                      ${i < arr.indexOf(step) ? 'bg-brand-500 border-brand-500 text-black' :
                        i === arr.indexOf(step) ? 'border-brand-500 text-brand-500' :
                        'border-surface-400 text-surface-300'}`}>
                      {i < arr.indexOf(step) ? '✓' : i + 1}
                    </div>
                    <span className="text-xs font-semibold hidden sm:block capitalize">{s}</span>
                  </div>
                  {i < arr.length - 1 && <div className={`flex-1 h-px ${i < arr.indexOf(step) ? 'bg-brand-500' : 'bg-surface-500'}`} />}
                </div>
              ))}
            </div>
          )}

          {/* ── STEP: UPLOAD ── */}
          {step === 'upload' && (
            <div className="card p-8 animate-fade-in">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
                  ${dragOver ? 'border-brand-500 bg-brand-500/10' : 'border-surface-400 hover:border-surface-300 hover:bg-surface-600/50'}`}
              >
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <div className="text-5xl mb-4">📄</div>
                <h3 className="font-bold text-white text-lg mb-2">Drop your receipt here</h3>
                <p className="text-surface-200 text-sm">JPEG, PNG, HEIC, PDF — up to 20MB</p>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { icon: Camera, label: 'Take Photo', action: () => fileRef.current?.click() },
                  { icon: FileText, label: 'Upload File', action: () => fileRef.current?.click() },
                  { icon: LinkIcon, label: 'Use URL', action: () => toast('URL upload coming soon!') },
                ].map(({ icon: Icon, label, action }) => (
                  <button key={label} onClick={action}
                    className="flex flex-col items-center gap-2 btn-secondary py-4 text-xs font-semibold">
                    <Icon size={18} className="text-surface-100" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tips */}
              <div className="mt-6 bg-surface-800 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-surface-100 uppercase tracking-wider mb-3">Tips for best results</div>
                {[
                  'Lay receipt flat on a dark surface',
                  'Ensure all text is clearly visible',
                  'Include the full receipt (top to bottom)',
                  'Good lighting — no flash glare',
                ].map(t => (
                  <div key={t} className="flex items-center gap-2 text-xs text-surface-200">
                    <CheckCircle size={11} className="text-green-400 shrink-0" /> {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: SCANNING ── */}
          {step === 'scanning' && (
            <div className="card p-10 text-center animate-fade-in">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="w-24 h-24 rounded-2xl bg-surface-700 border border-surface-500 overflow-hidden relative">
                  <div className="text-4xl absolute inset-0 flex items-center justify-center">📄</div>
                  <div className="scan-line" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Scanning Receipt...</h3>
              <p className="text-surface-200 text-sm mb-6">{scanMsg}</p>
              <div className="bg-surface-700 rounded-full h-2 mb-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-300"
                  style={{ width: `${scanPct}%` }} />
              </div>
              <div className="text-brand-500 font-black text-2xl">{Math.round(scanPct)}%</div>
              {fraudNeeded && (
                <div className="mt-4 text-xs text-yellow-400 flex items-center justify-center gap-1">
                  <AlertCircle size={12} /> Fraud check in progress...
                </div>
              )}
            </div>
          )}

          {/* ── STEP: MANUAL REVIEW ── */}
          {step === 'review' && ocrResult && (
            <div className="space-y-4 animate-fade-in">
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle size={20} className="text-yellow-400" />
                  <div>
                    <div className="font-bold text-white">Manual Review Required</div>
                    <div className="text-surface-200 text-sm">Some fields couldn't be read clearly. Please verify or correct them.</div>
                  </div>
                </div>

                {/* Overall confidence */}
                <div className="flex items-center gap-3 bg-surface-800 rounded-xl px-4 py-3">
                  <div className="flex-1">
                    <div className="text-xs text-surface-200 mb-1">Overall OCR Confidence</div>
                    <div className="bg-surface-600 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                        style={{ width: `${ocrResult.overall_confidence}%` }} />
                    </div>
                  </div>
                  <div className={`font-black text-lg ${CONFIDENCE_COLOR(ocrResult.overall_confidence)}`}>
                    {ocrResult.overall_confidence}%
                  </div>
                </div>
              </div>

              {/* Header fields needing review */}
              {ocrResult.fields_needing_review.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Edit3 size={16} className="text-brand-500" /> Receipt Details
                  </h3>
                  <div className="space-y-4">
                    {[
                      { key: 'store_name',    label: 'Store Name',     required: true },
                      { key: 'store_number',  label: 'Store Number' },
                      { key: 'store_address', label: 'Address' },
                      { key: 'store_city',    label: 'City' },
                      { key: 'store_state',   label: 'State' },
                      { key: 'purchase_date', label: 'Purchase Date', type: 'date', required: true },
                      { key: 'return_by_date',label: 'Return By Date', type: 'date' },
                      { key: 'total',         label: 'Total Amount',  type: 'number', required: true },
                    ].filter(f => ocrResult.fields_needing_review.includes(f.key) || ocrResult[f.key as keyof OcrResult]?.['needs_review']).map(field => {
                      const ocrField = ocrResult[field.key as keyof OcrResult] as any;
                      return (
                        <div key={field.key}>
                          <label className="input-label">
                            {field.label}
                            {field.required && <span className="text-red-400 ml-1">*</span>}
                            {ocrField?.confidence != null && (
                              <span className={`ml-2 normal-case font-normal ${CONFIDENCE_COLOR(ocrField.confidence)}`}>
                                {ocrField.confidence}% confidence
                              </span>
                            )}
                          </label>
                          <input
                            type={field.type ?? 'text'}
                            defaultValue={ocrField?.value ?? ''}
                            onChange={e => setCorrections(c => ({ ...c, [field.key]: e.target.value }))}
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                            className="input"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Items needing review */}
              {ocrResult.items.some(i => i.name.needs_review) && (
                <div className="card p-5">
                  <h3 className="font-bold text-white mb-4">Items to Verify</h3>
                  <div className="space-y-3">
                    {ocrResult.items.map((item, idx) => {
                      if (!item.name.needs_review) return null;
                      return (
                        <div key={idx} className="bg-surface-800 rounded-xl p-4 border border-yellow-500/20">
                          <div className="text-xs text-yellow-400 mb-2 font-semibold">Item {idx + 1} — {item.name.confidence}% confidence</div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="input-label">Item Name *</label>
                              <input defaultValue={item.name.value ?? ''}
                                onChange={e => setItemCorrections(c => ({ ...c, [idx]: { ...c[idx], name: e.target.value } }))}
                                className="input text-sm py-2" placeholder="Item name..." />
                            </div>
                            <div>
                              <label className="input-label">UPC / Barcode</label>
                              <input defaultValue={item.upc.value ?? ''}
                                onChange={e => setItemCorrections(c => ({ ...c, [idx]: { ...c[idx], upc: e.target.value } }))}
                                className="input text-sm py-2 font-mono" placeholder="012345678901" />
                            </div>
                            <div>
                              <label className="input-label">Unit Price *</label>
                              <input type="number" step="0.01" defaultValue={item.unit_price.value ?? ''}
                                onChange={e => setItemCorrections(c => ({ ...c, [idx]: { ...c[idx], unit_price: e.target.value } }))}
                                className="input text-sm py-2" placeholder="0.00" />
                            </div>
                            <div>
                              <label className="input-label">Qty</label>
                              <input type="number" min="1" defaultValue={item.quantity.value ?? 1}
                                onChange={e => setItemCorrections(c => ({ ...c, [idx]: { ...c[idx], quantity: e.target.value } }))}
                                className="input text-sm py-2" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button onClick={submitReview} className="btn-primary w-full flex items-center justify-center gap-2 py-4">
                Looks Good — Set Price <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ── STEP: PRICE ── */}
          {step === 'price' && (
            <div className="card p-6 animate-fade-in">
              <h2 className="font-black text-white text-xl mb-1 flex items-center gap-2">
                <DollarSign size={20} className="text-brand-500" /> Set Your Price
              </h2>
              <p className="text-surface-200 text-sm mb-6">Buyers pay this to access your receipt data and barcodes.</p>

              {/* Suggested prices */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                {['1.99','3.99','6.99','12.99'].map(p => (
                  <button key={p} onClick={() => setListingPrice(p)}
                    className={`rounded-xl py-3 text-sm font-bold border transition-all ${
                      listingPrice === p ? 'bg-brand-500/20 border-brand-500 text-brand-500' : 'bg-surface-700 border-surface-500 text-surface-100 hover:border-surface-300'
                    }`}>
                    ${p}
                  </button>
                ))}
              </div>

              {/* Custom price */}
              <div className="mb-5">
                <label className="input-label">Custom Price ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-200 font-bold">$</span>
                  <input
                    type="number" min="0.99" step="0.01"
                    value={listingPrice}
                    onChange={e => setListingPrice(e.target.value)}
                    placeholder="0.00"
                    className="input pl-8 text-lg font-bold"
                  />
                </div>
              </div>

              {/* Category */}
              <div className="mb-6">
                <label className="input-label">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="input appearance-none cursor-pointer">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Payout breakdown */}
              {listingPrice && parseFloat(listingPrice) > 0 && (
                <div className="bg-surface-800 rounded-xl p-4 border border-surface-500 mb-6">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-surface-200">
                      <span>Listing price</span><span className="text-white font-semibold">${parseFloat(listingPrice).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-surface-200">
                      <span>Platform fee (10%)</span><span>-${(parseFloat(listingPrice) * 0.10).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-surface-500 pt-2 font-bold">
                      <span className="text-white">You receive</span>
                      <span className="text-green-400 text-lg">${payout.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <button onClick={listReceipt} disabled={!listingPrice || parseFloat(listingPrice) < 0.99}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-base">
                <Zap size={18} className="fill-black" />
                List Receipt for ${parseFloat(listingPrice || '0').toFixed(2)}
              </button>
              <p className="text-center text-surface-300 text-xs mt-3 flex items-center justify-center gap-1">
                <ScanLine size={11} /> Buyers can only access receipt data after purchase
              </p>
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div className="card p-8 text-center animate-fade-in">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-black text-white mb-2">Receipt Listed!</h2>
              <p className="text-surface-200 mb-6">
                {listedReceipt?.live
                  ? 'Your receipt is now live on the marketplace.'
                  : 'Your receipt is under review and will go live within 24 hours.'}
              </p>
              <div className="bg-surface-800 rounded-xl p-4 border border-brand-500/20 mb-6">
                <div className="text-brand-500 font-bold text-sm mb-1">Listing ID</div>
                <div className="text-white font-mono text-lg">{receiptId?.slice(0, 8).toUpperCase()}</div>
                <div className="text-surface-200 text-sm mt-1">
                  {listedReceipt?.live ? '✅ Live — visible to buyers' : '⏳ Under review'}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => router.push('/dashboard')} className="btn-secondary flex-1 py-3">
                  View Dashboard
                </button>
                <button onClick={() => { setStep('upload'); setOcrResult(null); setReceiptId(null); setListingPrice(''); }} className="btn-primary flex-1 py-3">
                  List Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
