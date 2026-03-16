# Project Research Summary

**Project:** InvoiceTracker
**Domain:** Multi-tenant invoice tracking and automated payment reminder SaaS
**Researched:** 2026-03-16
**Confidence:** MEDIUM (stack HIGH; architecture MEDIUM; features MEDIUM; pitfalls MEDIUM)

## Executive Summary

InvoiceTracker is a focused accounts-receivable SaaS for small businesses and freelancers. The core value proposition is not invoicing per se — it is automated, configurable payment reminders that remove the awkwardness of manually chasing clients. Research shows that all major competitors (FreshBooks, Invoice Ninja, Wave) treat reminders as a side feature attached to a large accounting product. The recommended approach is to own that narrow workflow deeply: simple invoice creation, smart reminder scheduling, and a clean dashboard showing who owes what. This is a defensible position that requires less engineering than a full accounting product and delivers more value per feature than broad competitors in this one area.

The recommended stack — Next.js 16 (App Router), Convex, Clerk, Stripe, and Resend — is a modern, tightly integrated combination that eliminates large categories of infrastructure that would otherwise need to be built or managed. Convex's native scheduler (`ctx.scheduler.runAt`) handles reminder dispatch without a separate job queue. Clerk's JWT integration with Convex enforces tenant isolation with minimal boilerplate. The entire backend — database, scheduled jobs, server functions — lives in Convex, with Next.js handling only UI rendering and Stripe webhook ingestion. This means the team can move fast without standing up separate services for crons, queues, or API layers.

The critical risk is multi-tenancy integrity. Convex does not enforce row-level security automatically — every query and mutation must explicitly scope data to the authenticated user via `ctx.auth.getUserIdentity()`. A missed filter anywhere means tenant data leaks. The second highest-risk area is the Stripe billing integration: subscription status must be synced from the full lifecycle of webhook events (not just checkout completion), idempotency must be enforced on every webhook handler, and the subscription gate must live in Convex mutations — not only in React components. Both risks are preventable with disciplined patterns established in the first phase.

---

## Key Findings

### Recommended Stack

The stack is built around Convex as the backend primitive, which is the decisive architectural choice. By colocating the database, server functions, scheduled jobs, and real-time subscriptions in Convex, the project avoids the need for a separate API layer, job queue (BullMQ, Inngest), or cron service (Vercel Cron, Upstash). Clerk handles auth and session management with first-class Convex integration. Resend + React Email handles transactional reminder emails with minimal boilerplate. The full stack is TypeScript throughout.

**Core technologies:**
- **Next.js 16.1.6**: Full-stack React framework — App Router and React Server Components are the current standard; zero-config Vercel deployment. Note: `middleware.ts` is deprecated in v16 and replaced by `proxy.ts` (breaking change from v15).
- **React 19.2.4**: Required by Next.js 16; React Compiler (stable) eliminates manual memoization.
- **Convex 1.33.1**: Backend-as-a-service (database + server functions + scheduler + real-time) — native `ctx.scheduler.runAt()` replaces any external job queue for reminder dispatch; `convex/react-clerk` provides first-class Clerk integration.
- **Clerk 7.0.4**: Authentication + tenant identity — JWTs validated by Convex on every request; `ConvexProviderWithClerk` is the integration pattern.
- **Stripe 20.4.1**: Subscription billing — Customer Portal handles self-service; webhooks drive subscription state in Convex.
- **Resend 6.9.3**: Transactional email — React Email templates (`@react-email/components` + `@react-email/render`) render reminder emails server-side before sending.
- **TypeScript 5.9.3**: Default in Next.js 16; Zod v4 for input validation.
- **Tailwind CSS 4.2.1 + shadcn/ui 0.9.5**: UI layer — Tailwind v4 uses CSS-first config (no `tailwind.config.js`); shadcn/ui components are copied into the project (zero bundle overhead).

See `.planning/research/STACK.md` for full version compatibility matrix and alternatives considered.

---

### Expected Features

The product's competitive position depends on being outstanding at the reminder workflow, not at general invoicing. Research identifies a clear MVP boundary.

**Must have (table stakes) — v1 launch:**
- Auth (signup, login, session) — gates all other features
- Tenant data isolation — multi-tenancy is a day-one constraint
- Client directory (name + email) — required by invoices
- Invoice CRUD with auto-incrementing invoice numbers — core primitive
- Invoice status lifecycle: upcoming → due → overdue → paid (date-driven via daily cron) — core automation
- Mark invoice as paid — closes the loop; cancels pending reminders
- Automated email reminders via Resend (schedule-driven) — the core value prop
- Configurable reminder schedule (days before/after due date) — without this, one rigid schedule causes early churn
- Dashboard summary (outstanding total, overdue count, unpaid amount) — orientation on login
- Stripe subscription billing — required before launch per project constraints

**Should have (competitive differentiators) — v1.x post-validation:**
- Reminder send history per invoice — reduces "did it send?" support questions
- Per-invoice reminder schedule override — removes rigidity for edge-case clients
- Aged receivables report (0–30d, 31–60d, 61–90d, 90d+ buckets)
- Customizable reminder email templates with merge fields
- Invoice search and filter (by status, client, date range)
- Google login — reduces signup friction
- CSV export — for accountants

**Defer (v2+):**
- WhatsApp reminder channel — Business API approval complexity; architecture must not block it (design reminder dispatcher as a strategy pattern from day one)
- Client payment portal — high security surface; warrants its own phase
- Recurring invoices — billing-cycle complexity
- Online payment collection — fintech compliance scope
- Multi-user team access per tenant — explicitly out of scope for v1
- PDF invoice generation with custom branding

**Anti-features to explicitly avoid:** full accounting/bookkeeping, real-time collaboration, native mobile apps, AI invoice generation.

See `.planning/research/FEATURES.md` for full prioritization matrix and competitor analysis.

---

### Architecture Approach

The architecture is a thin Next.js UI layer over a Convex backend, with Clerk providing identity and Stripe providing billing. There is no traditional REST API — Convex mutations and queries replace it. Next.js is used only for rendering, routing, and as the webhook ingestion point for Stripe (because Stripe webhooks need a reachable HTTP endpoint). All data operations, scheduling, and email dispatch happen inside Convex.

**Major components:**

1. **Next.js App Router** — UI rendering (RSC + Client Components), routing, Stripe webhook endpoint (`/api/webhooks/stripe`), Stripe checkout session creation
2. **Convex queries/mutations** — all tenant-scoped data reads/writes; every function enforces `ctx.auth.getUserIdentity()` for tenant isolation
3. **Convex actions** — external I/O only (email via Resend); mutations cannot make HTTP calls, so email sends are dispatched as actions via `ctx.scheduler.runAfter(0, ...)`
4. **Convex scheduler** — two tiers: (a) daily cron (`crons.ts`) sweeps all unpaid invoices to update statuses (upcoming→due→overdue); (b) per-invoice `ctx.scheduler.runAt()` fires reminder dispatch at exact timestamps
5. **Clerk** — JWT issuance; JWTs validated by Convex via JWKS on every request; `identity.subject` is the tenant key
6. **Stripe** — subscription lifecycle; webhook → Next.js route → `ConvexHttpClient.mutation()` → updates `tenants` table; `by_stripe_customer` index on `tenants` table is critical for webhook-to-tenant resolution
7. **Resend** — called from Convex action; `RESEND_API_KEY` stored in Convex environment variables (not Next.js)

**Key data model decisions:**
- `ownerId` (Clerk `userId`) is the tenant key on every table; `.index("by_owner", ["ownerId"])` required on all tenant-scoped tables from day one
- `scheduledReminderIds` array stored on each invoice to enable cancellation when invoice is paid
- `reminderLog` table provides send history and idempotency guard
- `processedWebhooks` table provides idempotency for Stripe events
- Design all tables with `tenantId`-style scoping now even in single-owner v1 to avoid migration pain when team accounts land

See `.planning/research/ARCHITECTURE.md` for full schema patterns, data flow diagrams, and build-order graph.

---

### Critical Pitfalls

Research identified 10 pitfalls. The top 5 by consequence severity:

1. **Missing tenant scope on Convex queries** — any query that filters by domain fields (status, dueDate) without also filtering by `ownerId` from `ctx.auth` causes cross-tenant data bleed. Prevention: canonical `getCurrentUserId(ctx)` helper used in every query/mutation; cross-tenant query test as part of auth phase acceptance criteria.

2. **Client-supplied userId accepted in mutation args** — passing `user.id` from Clerk's React SDK as a mutation argument allows any client to write data under another tenant's identity. Prevention: never accept `userId` in mutation args; always use `ctx.auth.getUserIdentity().subject`.

3. **Stripe webhooks without idempotency** — Stripe delivers events at-least-once; duplicate events cause double-activation, duplicate emails, or corrupted subscription state. Prevention: `processedWebhooks` table with unique index on `stripeEventId`; check before processing, insert after; entire check+process+insert in one Convex mutation transaction.

4. **Email reminders firing for already-paid invoices** — pre-scheduled jobs fire regardless of invoice status changes that occurred after scheduling. Prevention: always re-check `invoice.status !== "paid"` at execution time in the dispatch mutation; cancel scheduled job IDs when marking an invoice paid.

5. **Stripe subscription lifecycle incomplete** — handling only `checkout.session.completed` while ignoring `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed` means cancellations and failures are invisible to the system. Prevention: handle all 5 subscription lifecycle events from the start of the billing phase.

Additional high-severity pitfalls: timezone handling for reminder scheduling (store IANA timezone string on tenant; never raw UTC offset math), subscription gating only in React components (must also gate in Convex mutations), and dashboard over-fetching via a single `useQuery` returning all invoices (use paginated queries + separate aggregate queries).

See `.planning/research/PITFALLS.md` for full pitfall inventory with code examples and recovery strategies.

---

## Implications for Roadmap

The architecture's build-order graph is strict: schema → auth → tenant model → invoice CRUD → status machine → reminder scheduling → email delivery → billing. No phase can meaningfully start until the prior phase's dependencies exist. This suggests 5–6 phases.

### Phase 1: Foundation — Auth, Tenant Model, and Schema

**Rationale:** Everything is gated behind auth and tenant isolation. The Convex schema with all required indexes must exist before any data can be written. The `tenants` table must be populated on first login before any tenant-scoped features function. This phase has the highest ratio of "invisible but load-bearing" work.

**Delivers:** Working auth flow (signup, login, session), Convex schema with all tables and `by_owner` indexes, tenant creation on first login, `proxy.ts` route protection (replacing deprecated `middleware.ts`), canonical `getCurrentUserId(ctx)` helper.

**Addresses features:** Auth + tenant isolation (P1 table stakes)

**Avoids pitfalls:** Client-supplied userId (Pitfall 2), missing tenant scope (Pitfall 1)

**Research flag:** Standard patterns — Clerk + Convex JWT integration is well-documented; skip research-phase.

---

### Phase 2: Core Invoice Workflow

**Rationale:** The client directory and invoice CRUD are the foundational data primitives. The invoice status state machine (daily cron) provides the date-driven lifecycle that all reminder logic depends on. Mark-as-paid is included here because it is both table stakes and the trigger for reminder cancellation. Dashboard summary is included because users need orientation after onboarding.

**Delivers:** Client CRUD, invoice CRUD with auto-incrementing numbers, invoice status lifecycle (daily cron sweep: upcoming→due→overdue→paid), mark-as-paid action, dashboard summary view (totals, overdue count, unpaid amount).

**Addresses features:** Client directory, Invoice CRUD, Invoice status lifecycle, Mark as paid, Dashboard summary, Invoice number generation (all P1 table stakes)

**Avoids pitfalls:** Missing `by_owner` index (Pitfall 1 follow-through), dashboard over-fetching (separate aggregate queries from list queries from day one — Pitfall 10)

**Research flag:** Standard patterns for CRUD + state machine; skip research-phase. Dashboard aggregate query pattern in Convex is slightly niche — validate pagination API during implementation.

---

### Phase 3: Automated Email Reminders

**Rationale:** The core value proposition. Depends on invoice CRUD and status machine being stable. The scheduler, dispatcher, email action, and `reminderLog` table are all built together because they form a single functional unit — partial implementation produces nothing shippable.

**Delivers:** Configurable reminder schedule per tenant (days before/after due date), per-invoice `ctx.scheduler.runAt()` reminder dispatch, Resend email action with React Email templates, `reminderLog` audit table, reminder cancellation on mark-as-paid.

**Addresses features:** Automated email reminders (P1), Configurable reminder schedule (P1), Reminder send history (P2 — comes free with `reminderLog`)

**Avoids pitfalls:** Email reminders firing for paid invoices (Pitfall 4 — idempotency check at dispatch time), duplicate reminder sends (Pitfall 5 — single cron entry + claim pattern), timezone handling (Pitfall 6 — IANA timezone on tenant, stored at signup), Resend called from mutation not action (Pitfall in ARCHITECTURE.md)

**Research flag:** Needs research-phase. Convex scheduler cancellation API (`ctx.scheduler.cancel()` signature), whether actions can now be called directly from mutations, and Resend SDK v6 constructor API should all be verified against current docs before implementation.

---

### Phase 4: Stripe Subscription Billing

**Rationale:** Required before launch per project constraints, but deliberately placed after the core product is functional end-to-end. Billing gates access; it does not enable functionality. Building billing on top of a working product avoids the trap of gating half-built features.

**Delivers:** Stripe Checkout session creation, subscription activation, full webhook lifecycle handler (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`), `processedWebhooks` idempotency table, `requireActiveSubscription(ctx)` helper wired into all write mutations, Stripe Customer Portal link in settings.

**Addresses features:** Stripe subscription billing (P1)

**Avoids pitfalls:** Webhook idempotency (Pitfall 3), incomplete subscription lifecycle (Pitfall 8), raw body consumed before signature verification (Pitfall 9), subscription gate only on frontend (Pitfall 7), Stripe data only in Clerk metadata not Convex (Architecture anti-pattern 1)

**Research flag:** Standard Stripe + Next.js webhook pattern is well-documented; skip research-phase. Verify current Stripe subscription status enum values against live Stripe docs before implementation.

---

### Phase 5: Polish and v1.x Differentiators

**Rationale:** Once the core loop is proven with real tenants, add features that reduce friction and support questions. These are all low-complexity features that build on the foundation without changing the architecture.

**Delivers:** Per-invoice reminder schedule override, invoice search and filter, reminder preview before sending, aged receivables report, Google login, CSV export, in-app notification when invoice becomes overdue.

**Addresses features:** All P2 differentiators from FEATURES.md

**Avoids pitfalls:** None new — this phase benefits from prior phase foundations.

**Research flag:** Standard patterns; skip research-phase.

---

### Phase Ordering Rationale

- **Schema and indexes must precede all data phases:** Retrofitting indexes onto a populated Convex collection requires a migration; adding them before any data is written is zero-cost.
- **Auth before data:** Convex's tenant isolation is enforced by the developer, not the platform. Establishing the `getCurrentUserId` helper and the query/mutation pattern before any domain data is written ensures the pattern is never retrofitted.
- **Invoice CRUD before reminders:** The scheduler queries invoices; there is nothing to schedule without the invoice data model being stable.
- **Billing last:** Billing gates access but does not unlock features. The product should be demonstrably valuable before the billing gate is enforced, both for testing and for stakeholder confidence.
- **WhatsApp channel deferred:** The reminder dispatcher should be designed as a strategy pattern (email is one transport among many) from Phase 3, even though WhatsApp is not built. This is a low-cost architectural decision that prevents a painful refactor later.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry; Next.js 16 confirmed as latest stable; peer dependency compatibility verified. |
| Features | MEDIUM | Based on training knowledge of competitors (pre-August 2025); live competitor verification unavailable. Directionally sound for product decisions; verify specific feature claims before marketing comparisons. |
| Architecture | MEDIUM | Patterns are well-established for Clerk + Convex; drawn from training knowledge (cutoff Aug 2025). Three specific items need live doc validation before implementation (see Gaps below). |
| Pitfalls | MEDIUM | High confidence on the security and idempotency pitfalls (Stripe, Convex auth); lower confidence on Convex-specific API shapes (scheduler cancellation, action-from-mutation) which may have changed post-cutoff. |

**Overall confidence:** MEDIUM — stack is HIGH and reduces overall risk; architecture and pitfall specifics need targeted doc validation at Phase 3 (reminder scheduling).

### Gaps to Address

- **Convex `ctx.scheduler.cancel()` signature:** Research notes this may have changed; validate against current Convex docs before Phase 3 implementation. Key question: is it `ctx.scheduler.cancel(id)` or a different API shape?
- **Convex actions callable directly from mutations:** Research indicates you must use `ctx.scheduler.runAfter(0, ...)` to cross the mutation→action boundary; verify this constraint still holds in Convex 1.33.1.
- **Resend SDK v6 constructor API:** Resend SDK had breaking API changes between major versions; confirm constructor and `emails.send()` shape against Resend 6.9.3 docs before Phase 3.
- **Next.js 16 `proxy.ts` codemod:** `middleware.ts` → `proxy.ts` is a breaking change from v15. If the project is initialized with `create-next-app` targeting Next.js 16 directly, this is a non-issue. If upgrading from an existing codebase, run `npx @next/codemod@canary middleware-to-proxy .`.
- **Competitor feature verification:** FEATURES.md notes that live competitor verification was unavailable. Spot-check FreshBooks and Invoice Ninja reminder feature pages before any marketing positioning decisions.

---

## Sources

### Primary (HIGH confidence)
- npm registry — versions for `next`, `@clerk/nextjs`, `convex`, `stripe`, `resend`, `tailwindcss`, `zod`, `typescript` all verified as of 2026-03-16
- https://nextjs.org/blog — Next.js 16.1 confirmed as latest stable (December 18, 2025)
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy — `middleware.ts` → `proxy.ts` breaking change confirmed

### Secondary (MEDIUM confidence)
- Convex documentation (training knowledge, Aug 2025) — `ctx.auth.getUserIdentity()`, `ctx.scheduler.runAt()`, mutations vs. actions, crons API
- Stripe documentation (training knowledge, Aug 2025) — webhook signature verification, subscription lifecycle events, idempotency patterns
- Clerk documentation (training knowledge, Aug 2025) — JWT issuance, Convex integration via JWKS, `identity.subject` field
- Resend documentation (training knowledge, Aug 2025) — `resend` npm package, `@react-email/render` peer dep
- Industry knowledge: FreshBooks, Invoice Ninja, Wave, Zoho Invoice, HoneyBook, Bonsai feature analysis (training knowledge, pre-Aug 2025)

### Tertiary (LOW confidence — verify before use)
- Convex `ctx.scheduler.cancel()` exact API shape — needs live doc validation
- Full Stripe subscription event enum (`subscription.status` values) — verify against current Stripe API reference
- Clerk `identity.subject` field name in Convex context — verify against current Clerk + Convex integration guide

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
