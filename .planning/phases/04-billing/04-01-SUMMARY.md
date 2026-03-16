---
phase: "04"
plan: "01"
subsystem: billing
tags: [stripe, webhooks, subscription, billing-ui]
dependency_graph:
  requires: [03-reminders, 01-foundation/schema]
  provides: [subscription-checkout, subscription-lifecycle, billing-page]
  affects: [convex/http.ts, convex/invoices.ts]
tech_stack:
  added: [stripe@17.x]
  patterns: [idempotent-webhook-processing, stripe-customer-portal, checkout-session]
key_files:
  created:
    - convex/stripe.ts
    - convex/webhooks.ts
    - src/app/(dashboard)/billing/page.tsx
    - src/app/(dashboard)/billing/_components/BillingContent.tsx
  modified:
    - convex/http.ts
    - convex/invoices.ts
    - src/app/(dashboard)/dashboard/_components/DashboardContent.tsx
decisions:
  - "Subscription gate in invoices.create left as comment — app remains fully functional for demo without Stripe configured"
  - "Stripe webhook uses idempotency via processedWebhooks table (already in schema from Phase 3 planning)"
  - "Used stripe.webhooks.constructEventAsync for async-compatible signature verification in Convex HTTP handlers"
metrics:
  duration_minutes: 17
  completed_date: "2026-03-16"
  tasks_completed: 9
  files_changed: 9
---

# Phase 4 Plan 1: Stripe Billing Summary

Stripe subscription billing with checkout session, full webhook lifecycle (5 events), idempotent event processing, billing management page, and dashboard nav link.

## What Was Built

### Convex Backend

**`convex/stripe.ts`** — Stripe actions and internal mutations:
- `createCheckoutSession` action: creates/reuses Stripe customer, creates checkout session in `subscription` mode
- `createPortalSession` action: opens Stripe Customer Portal for billing management
- `getTenantByOwner` internalQuery: fetches tenant for Stripe actions
- `setStripeCustomer` internalMutation: persists Stripe customer ID to tenant record
- `updateSubscription` internalMutation: updates `subscriptionStatus` and `stripeSubscriptionId` from webhook events

**`convex/webhooks.ts`** — Idempotency helpers:
- `isProcessed` internalQuery: checks `processedWebhooks` table by `stripeEventId`
- `markProcessed` internalMutation: inserts event ID before processing to prevent duplicate handling

**`convex/http.ts`** — Added `/stripe-webhook` route handling 5 Stripe lifecycle events:
- `checkout.session.completed` → sets status `active`
- `customer.subscription.updated` → maps Stripe status via `mapStripeStatus()`
- `customer.subscription.deleted` → sets status `canceled`
- `invoice.payment_failed` → sets status `past_due`
- `invoice.payment_succeeded` → sets status `active`

**`convex/invoices.ts`** — Subscription gate added as TODO comment (intentionally disabled for demo).

### Frontend

**`/billing` page** — Full billing management UI:
- Status card showing current subscription state (active/trialing/past_due/canceled/none) with appropriate colors and icons
- Plan card listing all Pro features + $29/month price
- "Subscribe Now" button → Stripe Checkout (disabled if PRICE_ID not configured)
- "Manage Billing" button → Stripe Customer Portal (shown when active/trialing)
- Configuration instructions banner

**Dashboard nav** — Added "Billing" link with CreditCard icon alongside Settings gear.

## Stripe Webhook URL

```
https://fleet-boar-312.eu-west-1.convex.site/stripe-webhook
```

## Setup Steps (for user)

1. Create Stripe account at stripe.com
2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Convex dashboard environment variables
3. Create a subscription product/price in Stripe dashboard
4. Set `NEXT_PUBLIC_STRIPE_PRICE_ID=price_xxx` in `.env.local`
5. Register webhook at the URL above in Stripe dashboard (select: checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed/succeeded)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed null version in package-lock.json preventing npm install**
- **Found during:** Step 1 (npm install stripe)
- **Issue:** `@tailwindcss/oxide/node_modules/@tailwindcss/oxide-freebsd-x64` had `"version": null` in package-lock.json — this is a pre-existing lock file corruption causing `npm` to throw `TypeError: Invalid Version` during dependency resolution
- **Fix:** Set the null version to `"4.2.1"` (matching the parent oxide package) in package-lock.json
- **Files modified:** `package-lock.json`
- **Commit:** b35b2bd

## Self-Check: PASSED

Files verified:
- FOUND: convex/stripe.ts
- FOUND: convex/webhooks.ts
- FOUND: src/app/(dashboard)/billing/page.tsx
- FOUND: src/app/(dashboard)/billing/_components/BillingContent.tsx
- FOUND: convex/http.ts (modified)
- FOUND: convex/invoices.ts (modified)

Commits verified:
- FOUND: b35b2bd feat(04-billing): Stripe checkout, subscription lifecycle webhooks, billing page

Build: PASSED (Next.js 16 Turbopack — 0 errors)
Tests: PASSED (12/12 vitest)
