'use client';
import { useQuery, useAction, useConvexAuth } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useState } from 'react';
import Link from 'next/link';

const PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ?? '';

const STATUS_LABEL: Record<string, string> = {
  active:   '[ Active ]',
  trialing: '[ Trial ]',
  past_due: '[ Past Due ]',
  canceled: '[ Canceled ]',
  none:     '[ Inactive ]',
};
const STATUS_COLOR: Record<string, string> = {
  active:   'text-[var(--t-fg)] font-black',
  trialing: 'text-[var(--t-muted)]',
  past_due: 'text-[var(--t-fg)] font-black',
  canceled: 'text-[var(--t-dim)]',
  none:     'text-[var(--t-dim)]',
};
const STATUS_DESC: Record<string, string> = {
  active:   'Your subscription is active. All features are enabled.',
  trialing: 'You are on a free trial. Subscribe before it ends to keep full access.',
  past_due: 'Your last payment failed. Update your payment method to restore access.',
  canceled: 'Your subscription is canceled. Subscribe again to restore access.',
  none:     'No active subscription. Subscribe to unlock all features.',
};

const FEATURES = [
  'Unlimited invoices',
  'Automated email reminders',
  'Customizable reminder schedule',
  'Real-time dashboard',
  'Invoice history',
];

export default function BillingContent() {
  const { isAuthenticated } = useConvexAuth();
  const tenant = useQuery(api.tenants.get, isAuthenticated ? {} : 'skip');
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const createPortal   = useAction(api.stripe.createPortalSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const status   = (tenant?.subscriptionStatus ?? 'none') as keyof typeof STATUS_LABEL;
  const isActive = status === 'active' || status === 'trialing';
  const sg       = 'font-[family-name:var(--font-space-grotesk)]';

  const handleSubscribe = async () => {
    setLoading(true);
    setError('');
    try {
      const { url } = await createCheckout({ priceId: PRICE_ID, returnUrl: `${window.location.origin}/billing` });
      if (url) window.location.href = url;
    } catch (err: any) { setError(err.message || 'Failed to start checkout. Please try again.'); }
    finally { setLoading(false); }
  };
  const handleManage = async () => {
    setLoading(true);
    setError('');
    try {
      const { url } = await createPortal({ returnUrl: `${window.location.origin}/billing` });
      if (url) window.location.href = url;
    } catch (err: any) { setError(err.message || 'Failed to open billing portal. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="px-5 md:px-10 py-10 max-w-2xl mx-auto pb-20 md:pb-14">

      {/* Page header */}
      <div className="mb-10">
        <Link href="/dashboard" className={`${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-muted)] hover:text-[var(--t-fg)] transition-colors underline underline-offset-4`}>
          ← Dashboard
        </Link>
        <h1 className={`${sg} font-bold text-2xl md:text-3xl tracking-tight uppercase mt-4 text-[var(--t-fg)]`}>Billing</h1>
        <p className={`${sg} small-caps font-bold text-sm mt-1.5 text-[var(--t-muted)]`}>
          Manage your subscription and payment details
        </p>
      </div>

      {/* Status row */}
      <div className="border border-[var(--t-border)] mb-6">
        <div className="px-7 py-5 border-b border-[var(--t-border)] bg-[var(--t-surface)] flex items-center justify-between">
          <span className={`${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-muted)]`}>Subscription Status</span>
          <span className={`${sg} small-caps font-bold text-xs ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
        </div>
        <div className="px-7 py-5">
          <p className="text-sm leading-relaxed text-[var(--t-muted)]">{STATUS_DESC[status]}</p>
        </div>
      </div>

      {/* Plan card */}
      <div className="border border-[var(--t-border)] mb-6">
        {/* Stat header */}
        <div className="grid grid-cols-2 border-b border-[var(--t-border)]">
          <div className="px-7 py-6 border-r border-[var(--t-border)]">
            <span className={`${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-muted)] block mb-2`}>Plan</span>
            <p className={`${sg} font-bold text-xl tracking-tight text-[var(--t-fg)]`}>Owev Pro</p>
          </div>
          <div className="px-7 py-6">
            <span className={`${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-muted)] block mb-2`}>Price</span>
            <div className="flex items-baseline gap-1">
              <span className={`${sg} font-bold text-xl tracking-tight text-[var(--t-fg)]`}>$20</span>
              <span className={`${sg} small-caps font-bold text-xs text-[var(--t-dim)]`}>/ month</span>
            </div>
          </div>
        </div>

        {/* Feature rows */}
        <div className="divide-y divide-[var(--t-border)]">
          {FEATURES.map((f) => (
            <div key={f} className="px-7 py-3.5 flex items-center justify-between hover:bg-[var(--t-surface)] transition-colors">
              <span className="text-sm font-bold text-[var(--t-fg)]">{f}</span>
              <span className={`${sg} small-caps font-black text-xs text-[var(--t-dim)]`}>[ Included ]</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-7 py-5 border-t border-[var(--t-border)] bg-[var(--t-surface)]">
          {isActive ? (
            <button onClick={handleManage} disabled={loading}
              className={`w-full border border-[var(--t-border)] py-3 ${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-fg)] hover:bg-[var(--t-fg)] hover:text-[var(--t-bg)] transition-colors disabled:opacity-40`}>
              {loading ? 'Loading...' : 'Manage Billing →'}
            </button>
          ) : (
            <button onClick={handleSubscribe} disabled={loading || !PRICE_ID}
              className={`w-full bg-[var(--t-fg)] text-[var(--t-bg)] py-3 ${sg} small-caps font-bold text-xs tracking-wider hover:opacity-80 transition-opacity disabled:opacity-40 border border-[var(--t-border)]`}>
              {loading ? 'Loading...' : 'Subscribe — $20 / Month'}
            </button>
          )}
          {!PRICE_ID && (
            <p className={`${sg} small-caps font-bold text-xs text-[var(--t-dim)] mt-3 text-center`}>
              NEXT_PUBLIC_STRIPE_PRICE_ID not configured
            </p>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="border border-[var(--t-border)] px-7 py-4 mb-6 bg-[var(--t-surface)]">
          <p className={`${sg} text-sm font-bold text-[var(--t-fg)]`}>{error}</p>
        </div>
      )}

      {/* Info note */}
      <div className="border border-[var(--t-border)] px-7 py-5 bg-[var(--t-surface)]">
        <p className={`${sg} small-caps font-bold text-xs tracking-wider text-[var(--t-fg)] mb-3`}>How It Works</p>
        <p className="text-sm leading-relaxed text-[var(--t-muted)]">
          Subscribe to enable automated email reminders. Reminders are scheduled when you create an invoice and automatically canceled when marked as paid.
        </p>
      </div>

    </div>
  );
}
