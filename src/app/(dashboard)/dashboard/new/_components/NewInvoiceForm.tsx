// @ts-nocheck
'use client';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const COLORS = [
  { key: 'black',  hex: '#111827', label: 'Slate' },
  { key: 'blue',   hex: '#2563eb', label: 'Blue' },
  { key: 'violet', hex: '#7c3aed', label: 'Violet' },
  { key: 'green',  hex: '#16a34a', label: 'Green' },
  { key: 'rose',   hex: '#e11d48', label: 'Rose' },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$',    name: 'US Dollar',          decimals: 2 },
  { code: 'EUR', symbol: '€',    name: 'Euro',               decimals: 2 },
  { code: 'GBP', symbol: '£',    name: 'British Pound',      decimals: 2 },
  { code: 'INR', symbol: '₹',    name: 'Indian Rupee',       decimals: 2 },
  { code: 'JPY', symbol: '¥',    name: 'Japanese Yen',       decimals: 0 },
  { code: 'CNY', symbol: '¥',    name: 'Chinese Yuan',       decimals: 2 },
  { code: 'CAD', symbol: 'CA$',  name: 'Canadian Dollar',    decimals: 2 },
  { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar',  decimals: 2 },
  { code: 'CHF', symbol: 'Fr',   name: 'Swiss Franc',        decimals: 2 },
  { code: 'BRL', symbol: 'R$',   name: 'Brazilian Real',     decimals: 2 },
  { code: 'MXN', symbol: 'MX$',  name: 'Mexican Peso',       decimals: 2 },
  { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar',   decimals: 2 },
  { code: 'AED', symbol: 'د.إ',  name: 'UAE Dirham',         decimals: 2 },
  { code: 'KRW', symbol: '₩',    name: 'South Korean Won',   decimals: 0 },
];

export default function NewInvoiceForm() {
  const router = useRouter();
  const create = useMutation(api.invoices.create);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const [form, setForm] = useState({
    clientName:  '',
    clientEmail: '',
    amount:      '',
    currency:    'USD',
    dueDate:     '',
    description: '',
    accentColor: 'black',
  });

  const selectedCurrency = CURRENCIES.find((c) => c.code === form.currency) ?? CURRENCIES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const multiplier = selectedCurrency.decimals === 0 ? 1 : 100;
      const amountUnits = Math.round(parseFloat(form.amount) * multiplier);
      if (isNaN(amountUnits) || amountUnits <= 0) { setError('Please enter a valid amount'); setLoading(false); return; }
      const dueDate = new Date(form.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      await create({ clientName: form.clientName, clientEmail: form.clientEmail, amount: amountUnits, currency: form.currency, dueDate: dueDate.getTime(), description: form.description || undefined, accentColor: form.accentColor });
      router.push('/dashboard');
    } catch (err: any) { setError(err.message || 'Something went wrong'); setLoading(false); }
  };

  const sg       = 'font-[family-name:var(--font-space-grotesk)]';
  const fieldCls = `w-full px-0 py-3 bg-transparent border-b-2 border-[var(--t-border)] text-sm text-[var(--t-fg)] placeholder:text-[var(--t-dim)] focus:outline-none`;
  const labelCls = `block ${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-muted)] mb-3`;

  return (
    <div className="px-5 md:px-10 py-10 max-w-2xl mx-auto pb-20 md:pb-14">

      {/* Page header */}
      <div className="mb-10">
        <Link href="/dashboard" className={`${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-muted)] hover:text-[var(--t-fg)] transition-colors underline underline-offset-4`}>
          ← Dashboard
        </Link>
        <h1 className={`${sg} font-bold text-2xl md:text-3xl tracking-tight uppercase mt-4 text-[var(--t-fg)]`}>New Invoice</h1>
        <p className={`${sg} small-caps font-bold text-sm mt-1.5 text-[var(--t-muted)]`}>
          Reminders will be scheduled automatically
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Client info */}
        <div className="border border-[var(--t-border)]">
          <div className="px-7 py-4 border-b border-[var(--t-border)] bg-[var(--t-surface)]">
            <h2 className={`${sg} font-bold text-sm small-caps tracking-widest text-[var(--t-fg)]`}>Client Information</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--t-border)]">
            <div className="px-7 py-6">
              <label className={labelCls}>Client Name <span className="text-[var(--t-fg)] normal-case tracking-normal">*</span></label>
              <input type="text" required placeholder="Acme Corp" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className={fieldCls} />
            </div>
            <div className="px-7 py-6">
              <label className={labelCls}>Client Email <span className="text-[var(--t-fg)] normal-case tracking-normal">*</span></label>
              <input type="email" required placeholder="client@acme.com" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} className={fieldCls} />
            </div>
          </div>
        </div>

        {/* Invoice details */}
        <div className="border border-[var(--t-border)]">
          <div className="px-7 py-4 border-b border-[var(--t-border)] bg-[var(--t-surface)]">
            <h2 className={`${sg} font-bold text-sm small-caps tracking-widest text-[var(--t-fg)]`}>Invoice Details</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--t-border)] border-b border-[var(--t-border)]">
            <div className="px-7 py-6">
              <label className={labelCls}>Amount <span className="text-[var(--t-fg)] normal-case tracking-normal">*</span></label>
              <div className="flex items-end gap-3">
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className={`bg-transparent border-b-2 border-[var(--t-border)] text-sm font-bold text-[var(--t-fg)] focus:outline-none pb-3 ${sg} shrink-0`}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[var(--background)] text-[var(--foreground)]">
                      {c.code}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--t-dim)] pointer-events-none ${sg}`}>
                    {selectedCurrency.symbol}
                  </span>
                  <input
                    type="number" required
                    min={selectedCurrency.decimals === 0 ? '1' : '0.01'}
                    step={selectedCurrency.decimals === 0 ? '1' : '0.01'}
                    placeholder={selectedCurrency.decimals === 0 ? '0' : '0.00'}
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className={`${fieldCls} pl-7`}
                  />
                </div>
              </div>
            </div>
            <div className="px-7 py-6">
              <label className={labelCls}>Due Date <span className="text-[var(--t-fg)] normal-case tracking-normal">*</span></label>
              <input type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={`${fieldCls} [color-scheme:light] dark:[color-scheme:dark]`} />
            </div>
          </div>
          <div className="px-7 py-6">
            <label className={`${labelCls} flex items-center gap-2`}>
              Description <span className={`${sg} text-[var(--t-dim)] normal-case font-normal tracking-normal text-xs`}>(optional)</span>
            </label>
            <textarea rows={3} placeholder="e.g. Web design project — Q1 2026" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${fieldCls} resize-none`} />
          </div>
        </div>

        {/* Email accent color */}
        <div className="border border-[var(--t-border)]">
          <div className="px-7 py-4 border-b border-[var(--t-border)] bg-[var(--t-surface)]">
            <h2 className={`${sg} font-bold text-sm small-caps tracking-widest text-[var(--t-fg)]`}>Email Accent Color</h2>
          </div>
          <div className="px-7 py-6">
            <p className={`text-xs ${sg} small-caps font-bold tracking-wider text-[var(--t-muted)] mb-5`}>
              Used as the header color in reminder emails
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setForm({ ...form, accentColor: c.key })}
                  className={`flex items-center gap-2 px-4 py-2 border transition-colors ${
                    form.accentColor === c.key
                      ? 'border-[var(--t-border)] bg-[var(--t-fg)] text-[var(--t-bg)]'
                      : 'border-[var(--t-border)] text-[var(--t-muted)] hover:text-[var(--t-fg)] hover:bg-[var(--t-surface)]'
                  }`}
                >
                  <span className="w-3 h-3 shrink-0 rounded-sm" style={{ backgroundColor: c.hex }} />
                  <span className={`${sg} small-caps font-bold text-xs tracking-wider`}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="border border-[var(--t-border)] px-6 py-4 bg-[var(--t-surface)]">
            <p className="text-sm font-bold text-[var(--t-fg)]">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={loading}
            className={`flex-1 bg-[var(--t-fg)] text-[var(--t-bg)] py-3.5 ${sg} small-caps font-bold text-xs tracking-wider hover:opacity-80 transition-opacity disabled:opacity-40 border border-[var(--t-border)]`}>
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
          <Link href="/dashboard"
            className={`px-8 py-3.5 border border-[var(--t-border)] ${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-fg)] hover:bg-[var(--t-fg)] hover:text-[var(--t-bg)] transition-colors`}>
            Cancel
          </Link>
        </div>

      </form>
    </div>
  );
}
