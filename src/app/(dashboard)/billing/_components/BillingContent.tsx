'use client';
import { useQuery, useAction } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useState } from 'react';
import { ArrowLeft, FileText, CreditCard, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';

const PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ?? '';

const STATUS_INFO = {
  active: {
    label: 'Active',
    description: 'Your subscription is active. All features are enabled.',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: CheckCircle,
    iconColor: 'text-green-600',
  },
  trialing: {
    label: 'Free Trial',
    description: 'You are on a free trial. Subscribe to continue after it ends.',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: Clock,
    iconColor: 'text-blue-600',
  },
  past_due: {
    label: 'Past Due',
    description: 'Your last payment failed. Update your payment method to restore access.',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: AlertCircle,
    iconColor: 'text-amber-600',
  },
  canceled: {
    label: 'Canceled',
    description: 'Your subscription has been canceled. Subscribe to regain access.',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: AlertCircle,
    iconColor: 'text-red-600',
  },
  none: {
    label: 'No Subscription',
    description: 'Subscribe to unlock all features.',
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: CreditCard,
    iconColor: 'text-gray-400',
  },
};

export default function BillingContent() {
  const tenant = useQuery(api.tenants.get);
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const createPortal = useAction(api.stripe.createPortalSession);
  const [loading, setLoading] = useState(false);

  const status = (tenant?.subscriptionStatus ?? 'none') as keyof typeof STATUS_INFO;
  const info = STATUS_INFO[status];
  const StatusIcon = info.icon;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { url } = await createCheckout({
        priceId: PRICE_ID,
        returnUrl: window.location.origin + '/billing',
      });
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setLoading(true);
    try {
      const { url } = await createPortal({
        returnUrl: window.location.origin + '/billing',
      });
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-900" />
            <span className="text-lg font-bold text-gray-900">InvoiceTracker</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Current status card */}
        <div className={`rounded-xl border p-6 ${info.bg} ${info.border}`}>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <StatusIcon className={`h-5 w-5 ${info.iconColor}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className={`text-base font-semibold ${info.color}`}>{info.label}</h2>
              </div>
              <p className={`text-sm ${info.color} opacity-80`}>{info.description}</p>
            </div>
          </div>
        </div>

        {/* Plan card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">InvoiceTracker Pro</h3>
          <ul className="space-y-3 mb-6">
            {[
              'Unlimited invoices',
              'Automated email reminders',
              'Customizable reminder schedule',
              'Invoice history & audit log',
              'Real-time dashboard',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-600">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-3xl font-bold text-gray-900">$29</span>
            <span className="text-gray-400 text-sm">/ month</span>
          </div>

          {status === 'active' || status === 'trialing' ? (
            <button
              onClick={handleManage}
              disabled={loading}
              className="w-full py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Manage Billing'}
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={loading || !PRICE_ID}
              className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Subscribe Now'}
            </button>
          )}

          {!PRICE_ID && (
            <p className="text-xs text-amber-600 mt-2 text-center">
              NEXT_PUBLIC_STRIPE_PRICE_ID not configured
            </p>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <p className="text-sm text-blue-800 font-medium mb-1">Stripe configuration required</p>
          <p className="text-sm text-blue-700 leading-relaxed">
            To activate billing, set <code className="bg-blue-100 px-1 rounded">STRIPE_SECRET_KEY</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">STRIPE_WEBHOOK_SECRET</code> in your Convex dashboard,
            and <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_STRIPE_PRICE_ID</code> in{' '}
            <code className="bg-blue-100 px-1 rounded">.env.local</code>.
          </p>
        </div>
      </main>
    </div>
  );
}
