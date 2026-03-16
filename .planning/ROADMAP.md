# Roadmap: InvoiceTracker

## Overview

InvoiceTracker ships in four phases that follow the strict build-order dictated by the architecture: auth and tenant isolation first (everything gates on this), then the core invoice workflow (the data primitives reminders depend on), then automated email reminders (the product's core value), then Stripe billing and business profile (required before launch). Each phase is independently shippable and testable before the next begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Project scaffold, Convex schema, Clerk auth, tenant model, and user sync webhook
- [ ] **Phase 2: Core Invoice Workflow** - Invoice CRUD, status lifecycle cron, mark-as-paid, and dashboard
- [ ] **Phase 3: Automated Reminders** - Reminder scheduler, email dispatch via Resend, configurable schedule, and per-invoice override
- [ ] **Phase 4: Stripe Billing** - Subscription checkout, webhook lifecycle, subscription gating, and business profile settings

## Phase Details

### Phase 1: Foundation
**Goal**: Users can securely sign in to their own isolated account and the system enforces full tenant data isolation from the first write
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. User can sign up with email and password via Clerk and land on their dashboard
  2. User session persists across browser refresh without being asked to log in again
  3. User is redirected to login when accessing protected routes while unauthenticated
  4. Two different accounts cannot see each other's data — tenant isolation is enforced at the query level, not just the UI
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Next.js 16 scaffold, install all deps, shadcn/ui init, vitest Wave 0 test stubs
- [ ] 01-02-PLAN.md — Convex schema (4 tables + all indexes), auth.config.ts, getCurrentUserId helper, upsertFromClerk mutation
- [ ] 01-03-PLAN.md — proxy.ts route protection, ClerkProvider layout tree, sign-in/sign-up pages, dashboard shell, Clerk webhook handler

### Phase 2: Core Invoice Workflow
**Goal**: Users can manage their full invoice book and the system automatically keeps status current without manual intervention
**Depends on**: Phase 1
**Requirements**: INV-01, INV-02, INV-03, INV-04, DASH-01, DASH-02
**Success Criteria** (what must be TRUE):
  1. User can create an invoice with client name, client email, amount, due date, and optional notes
  2. Invoice status automatically changes from upcoming to due to overdue as days pass — without any user action
  3. User can mark an invoice as paid with one click and it no longer appears in the unpaid totals
  4. Dashboard shows total invoice count, overdue count, and total unpaid amount on first load
  5. User can filter the invoice list by status and browse by date
**Plans**: TBD

Plans:
- [ ] 02-01: Invoice CRUD — create, read, update, delete with tenant scoping and auto-incrementing invoice numbers
- [ ] 02-02: Status lifecycle — daily Convex cron sweeping all unpaid invoices (upcoming → due → overdue)
- [ ] 02-03: Dashboard — summary aggregates (total, overdue count, unpaid amount) and filtered invoice list view

### Phase 3: Automated Reminders
**Goal**: The system automatically sends email reminders to clients on the right days without the user having to do anything after creating the invoice
**Depends on**: Phase 2
**Requirements**: REM-01, REM-02, REM-03, DASH-03
**Success Criteria** (what must be TRUE):
  1. Client receives an email reminder automatically on the days configured in the user's reminder schedule (e.g. 1 day before, on due date, 3 days overdue)
  2. User can change their reminder schedule preferences and new invoices pick up the updated schedule
  3. User can pause or skip reminders for a specific invoice without affecting others
  4. No reminder email is sent for an invoice that has already been marked as paid
  5. Dashboard aged receivables breakdown shows how much is 30/60/90 days overdue
**Plans**: TBD

Plans:
- [ ] 03-01: Reminder scheduler — per-invoice `ctx.scheduler.runAt()` dispatch wired to invoice creation and status changes; cancellation on mark-as-paid
- [ ] 03-02: Email dispatch — Resend action with React Email template, `reminderLog` audit table, idempotency guard
- [ ] 03-03: Reminder configuration — user schedule preferences UI, per-invoice pause/skip override, aged receivables dashboard widget

### Phase 4: Stripe Billing
**Goal**: The platform is monetized — new accounts start on a free trial, active subscriptions are required to use the product, and users can manage billing from within the app
**Depends on**: Phase 3
**Requirements**: BILL-01, BILL-02, PROF-01, PROF-02, PROF-03
**Success Criteria** (what must be TRUE):
  1. New user lands on a free trial that expires after the configured period — no credit card required to start
  2. After trial expires, user is prompted to subscribe and cannot create invoices or trigger reminders until they do
  3. User can complete Stripe Checkout and gain immediate access to the full product
  4. Subscription cancellation and payment failure are reflected in the user's access within one webhook delivery
  5. User can set their business name, reply-to email, and upload a logo that appears in reminder emails
**Plans**: TBD

Plans:
- [ ] 04-01: Stripe Checkout — checkout session creation, `tenants` table subscription fields, `processedWebhooks` idempotency table
- [ ] 04-02: Webhook lifecycle — all five subscription events handled (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`)
- [ ] 04-03: Subscription gating + business profile — `requireActiveSubscription` helper in Convex mutations, trial/expired UI gates, business name/sender email/logo settings

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Core Invoice Workflow | 0/3 | Not started | - |
| 3. Automated Reminders | 0/3 | Not started | - |
| 4. Stripe Billing | 0/3 | Not started | - |
