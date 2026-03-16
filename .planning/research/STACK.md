# Stack Research

**Domain:** Multi-tenant invoice tracking / payment reminder SaaS
**Researched:** 2026-03-16
**Confidence:** HIGH (all versions verified against npm registry and official Next.js docs)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.6 | Full-stack React framework | App Router is now the standard; RSC + Server Actions eliminate the need for a separate API layer for most operations. Turbopack is the default bundler. Vercel deployment is zero-config. |
| React | 19.2.4 | UI rendering | Required by Next.js 16; React Compiler (stable in Next.js 16) eliminates manual memoization. |
| Convex | 1.33.1 | Backend-as-a-service: database, real-time queries, server functions, scheduled jobs | Replaces a traditional database + API layer. Built-in scheduled functions (`ctx.scheduler.runAt()`) handle reminder scheduling without a separate job queue. Ships with `convex/react-clerk` for first-class Clerk integration. Real-time subscriptions (`useQuery`) keep the dashboard live without polling. |
| Clerk | 7.0.4 | Authentication + multi-tenancy | Provides sign-up/sign-in flows, session management, and tenant identity (each user IS the tenant in v1). Verified Next.js 16 support in peer deps (`^16.0.10 || ^16.1.0-0`). Native Convex integration via `ConvexProviderWithClerk`. |
| Stripe | 20.4.1 | Subscription billing | Industry standard for SaaS billing. Handles subscription lifecycle, trial periods, and customer portal. Webhooks integrate with Convex HTTP endpoints. |
| Resend | 6.9.3 | Transactional email delivery | Superior DX over SendGrid: simple API, built-in React Email template support (peer dep), generous free tier (3,000 emails/month), and modern dashboard. Used as the email delivery layer for reminder notifications. |
| TypeScript | 5.9.3 | Type safety | Next.js 16 defaults to TypeScript. Minimum required version is 5.1.0 per official docs. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-email/components | 1.0.9 | Email template components (Button, Text, Link, etc.) | Building HTML reminder email templates in React |
| @react-email/render | 2.0.4 | Renders React Email templates to HTML strings | Required peer dep of Resend; called server-side before `resend.emails.send()` |
| tailwindcss | 4.2.1 | Utility-first CSS | Default in Next.js 16 project scaffold; no config file needed in v4 (CSS-first config) |
| shadcn/ui | 0.9.5 (CLI) | Accessible UI components (copy-paste, not a package dep) | Dashboard tables, modals, forms, status badges. Use `npx shadcn@latest add` to pull in components. |
| lucide-react | 0.577.0 | Icon library | Paired with shadcn/ui; consistent icon set |
| zod | 4.3.6 | Schema validation | Validate invoice form inputs and Stripe webhook payloads before writing to Convex |
| @tanstack/react-table | 8.21.3 | Headless table with sorting/filtering | Invoice list view with sort-by-status, filter-by-overdue |
| date-fns | 4.1.0 | Date manipulation | Computing days-until-due, overdue periods, reminder scheduling offsets |
| svix | 1.88.0 | Webhook verification | Verifying Clerk webhook signatures when syncing user data to Convex |
| @stripe/stripe-js | 8.9.0 | Client-side Stripe.js (redirect to Checkout, Customer Portal) | Loading Stripe on the frontend for Checkout Session redirects |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Turbopack | Dev bundler (default in Next.js 16) | Replaces Webpack for `next dev`; no config needed. Use `--webpack` flag only if a plugin requires Webpack specifically. |
| ESLint | Linting | Next.js 16 no longer runs linter automatically during `next build` — add `npm run lint` to CI explicitly. Use `eslint.config.mjs` (flat config format). |
| Biome | Optional: fast linter + formatter alternative | Use if team prefers a single tool over ESLint + Prettier separately |
| convex CLI | Convex deployment and schema management | Run `npx convex dev` in parallel with `next dev`; handles function pushing and type generation |

## Installation

```bash
# Create Next.js app (enables TypeScript, Tailwind, App Router, Turbopack by default)
npx create-next-app@latest invoicetracker --yes

# Core runtime dependencies
npm install convex @clerk/nextjs stripe resend

# Email templates
npm install @react-email/components @react-email/render

# UI and utilities
npm install lucide-react zod date-fns @tanstack/react-table @stripe/stripe-js

# Webhook verification
npm install svix

# Dev dependencies
npm install -D typescript@latest
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Convex | Supabase (Postgres + Edge Functions) | When you need SQL queries, complex joins, or existing Postgres tooling. Supabase requires separate cron infrastructure (e.g., pg_cron or Supabase Edge Functions + external scheduler) for reminder scheduling. Convex's native scheduling is a decisive advantage for this use case. |
| Convex | PlanetScale / Neon + Prisma | When team already has deep SQL expertise and wants granular query control. Adds significant infrastructure overhead: separate API layer, separate job queue (BullMQ, Inngest, or similar). |
| Resend | SendGrid | When you already have a SendGrid account with established reputation, templates stored in the SendGrid dashboard, or need SendGrid's advanced analytics. SendGrid's API DX is more verbose and its React integration is unofficial. |
| Resend | Postmark | When transactional email deliverability is the absolute top priority and budget allows ($15+/month from the start). Postmark has best-in-class delivery rates but no free tier. |
| shadcn/ui + Tailwind | Chakra UI / MUI | When team strongly prefers a runtime component library with built-in theming. shadcn/ui is preferred here because it generates zero bundle overhead (components copied into project, not imported from node_modules) and aligns with Tailwind v4's CSS-first approach. |
| Clerk | Auth.js (next-auth) | When you need fully self-hosted auth with no third-party dependency. Auth.js v5 supports App Router but requires significantly more custom code for session management, especially for multi-tenant data isolation. |
| Stripe | Lemon Squeezy | When targeting EU customers where merchant-of-record handling simplifies VAT compliance. Stripe is preferred because of its richer API, better webhook tooling, and the Stripe Customer Portal which handles self-service subscription management. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `middleware.ts` (Next.js 15 convention) | In Next.js 16, `middleware.ts` is deprecated and renamed to `proxy.ts`. The export function is also renamed from `middleware` to `proxy`. Run `npx @next/codemod@canary middleware-to-proxy .` if upgrading. All Clerk route protection must use `proxy.ts`. | `proxy.ts` with `export function proxy()` |
| External job queue (BullMQ, Inngest, Trigger.dev) | Convex has a native scheduler (`ctx.scheduler.runAt(timestamp, functionRef, args)`) that runs server functions at a specified future time. Adding a separate job queue for reminder scheduling duplicates infrastructure and adds cost without benefit. | `ctx.scheduler.runAt()` in Convex mutations |
| External cron service (Vercel Cron, Upstash QStash) | Same reason as above — Convex crons (`crons.ts`) cover recurring schedules natively. | `crons.ts` in Convex for any recurring tasks |
| `pages/` directory router | App Router is the current standard in Next.js 16. Pages Router is still supported but receives no new features. Convex's `convex/nextjs` helpers and Clerk's `@clerk/nextjs` are designed for App Router. | `app/` directory |
| `@sendgrid/mail` | Requires more boilerplate for HTML email templating, no React Email integration, and the official library is at v8.x with no meaningful DX improvements. For this project scale Resend is strictly better. | `resend` |
| Prisma | No Convex integration exists; Prisma is a Postgres/SQL ORM. Using Prisma means abandoning Convex entirely and building a separate API layer. | Convex's built-in query/mutation model |

## Stack Patterns by Variant

**If adding WhatsApp reminders later (deferred per PROJECT.md):**
- Add `@whatsapp-business/api` or Twilio's WhatsApp API as a new notification channel
- The Convex scheduled function that dispatches email reminders should be abstracted into a `sendReminder(invoiceId)` mutation that routes to whichever channels are enabled per tenant
- This means: design the reminder dispatcher as a strategy pattern from day one, not hardcoded to email

**If scaling past free Convex tier:**
- Convex's paid plans are per-function-call + storage; reminder SaaS with moderate user counts (sub-10K) fits the free tier comfortably during MVP
- No architectural change needed to upgrade; just update billing in Convex dashboard

**If needing multi-user teams per tenant (deferred to future milestone):**
- Clerk Organizations already support this model; enable `organizations` in Clerk dashboard
- Convex data model needs a `tenantId` field that maps to Clerk Organization ID instead of User ID
- Design tables with `tenantId` from day one even in single-owner v1 to avoid a migration

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@clerk/nextjs@7.0.4` | `next@^16.1.0-0`, `react@~19.2.x` | Explicitly listed in Clerk's peer deps; verified against npm registry |
| `convex@1.33.1` | `next@16.x` (via `convex/nextjs` export) | Convex ships first-party Next.js and Clerk exports; no additional adapter needed |
| `resend@6.9.3` | `@react-email/render@*` (any version) | Resend lists `@react-email/render` as peer dep; current is `2.0.4` |
| `tailwindcss@4.2.1` | Next.js 16 | Tailwind v4 uses CSS-first config (no `tailwind.config.js` by default); `create-next-app` scaffold handles this automatically |
| `stripe@20.4.1` | Node.js >=16 | No conflicts with Next.js 16 stack; Node.js 20.9 required by Next.js anyway |
| `zod@4.3.6` | TypeScript 5.x | Zod v4 dropped support for TypeScript < 4.9; TypeScript 5.9 is fine |

## Sources

- npm registry `next@latest` — version 16.1.6 confirmed
- npm registry `@clerk/nextjs@latest` — version 7.0.4, peerDeps include `next@^16.1.0-0`
- npm registry `convex@latest` — version 1.33.1, exports include `./react-clerk` and `./nextjs`
- npm registry `stripe@latest` — version 20.4.1
- npm registry `resend@latest` — version 6.9.3, peerDep `@react-email/render@*`
- npm registry `tailwindcss@latest` — version 4.2.1
- npm registry `zod@latest` — version 4.3.6
- npm registry `typescript@latest` — version 5.9.3
- https://nextjs.org/blog — Next.js 16.1 confirmed as latest stable (December 18, 2025)
- https://nextjs.org/docs/app/getting-started/installation — App Router setup, minimum Node.js 20.9, TypeScript min 5.1
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy — middleware renamed to proxy in v16 (BREAKING), codemod available

---
*Stack research for: multi-tenant invoice tracking / payment reminder SaaS*
*Researched: 2026-03-16*
