# Architecture Research

**Domain:** Multi-tenant invoice tracking SaaS (Clerk + Convex + Stripe + Resend)
**Researched:** 2026-03-16
**Confidence:** MEDIUM — drawn from training knowledge (cutoff Aug 2025); WebFetch/WebSearch unavailable. Patterns are well-established for this stack but should be validated against current Convex docs before implementation.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Dashboard   │  │  Invoice UI  │  │  Settings / Billing  │  │
│  │  (Next.js)   │  │  (Next.js)   │  │      (Next.js)       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         └─────────────────┴─────────────┬────────┘             │
│                                   Convex React hooks            │
└───────────────────────────────────────┬─────────────────────────┘
                                        │ WebSocket (real-time)
┌───────────────────────────────────────┼─────────────────────────┐
│                    CONVEX BACKEND     │                         │
│  ┌──────────────────┐  ┌─────────────┴──────┐  ┌────────────┐  │
│  │  Queries/         │  │  Mutations         │  │  Actions   │  │
│  │  (read, reactive) │  │  (write, tx-safe)  │  │  (HTTP,    │  │
│  │                  │  │                    │  │   email,   │  │
│  │  auth scoped to  │  │  auth scoped to    │  │   Stripe)  │  │
│  │  ctx.auth.userId │  │  ctx.auth.userId   │  └────────────┘  │
│  └──────────────────┘  └────────────────────┘                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  SCHEDULER LAYER                         │   │
│  │  ┌──────────────────┐   ┌──────────────────────────┐    │   │
│  │  │  Cron (daily)    │   │  Per-invoice scheduled   │    │   │
│  │  │  status sweeper  │   │  mutations (exact time)  │    │   │
│  │  └──────────────────┘   └──────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     DATABASE LAYER                        │  │
│  │  [tenants]  [invoices]  [reminders]  [reminderLog]        │  │
│  │  [subscriptions]  [scheduledJobs]                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐   ┌──────────────────┐   ┌─────────────┐
   │   Clerk     │   │     Stripe       │   │   Resend    │
   │  (identity) │   │  (subscriptions) │   │  (email)    │
   └─────────────┘   └──────────────────┘   └─────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Next.js App Router | UI rendering, routing, Stripe webhook endpoint | Next.js 14+ with App Router |
| Convex Queries | Read data, reactive subscriptions per tenant | `query()` with `ctx.auth` scoping |
| Convex Mutations | Write invoices, update status, mark paid | `mutation()` with `ctx.auth` scoping |
| Convex Actions | External HTTP calls (Stripe, Resend) | `action()` — no direct DB write, calls mutations |
| Convex Cron | Daily sweep: update invoice statuses (upcoming→due→overdue) | `crons.ts` with `cron.daily()` |
| Convex Scheduler | Per-invoice reminder dispatch at exact time | `ctx.scheduler.runAt()` inside mutations |
| Clerk | JWT issuance, user identity, org/user metadata | Clerk React SDK + Convex JWT validator |
| Stripe | Subscription lifecycle, billing portal | Stripe webhook → Next.js API route → Convex mutation |
| Resend | Transactional email delivery | Called from Convex action |

---

## Tenant Isolation Pattern (Clerk + Convex)

**Confidence: HIGH** — this is the canonical Convex + Clerk integration pattern.

### How It Works

Clerk issues JWTs. Convex validates them on every request. The `userId` from the validated JWT is the tenant key — all data reads and writes are scoped to it.

```
Clerk JWT
    ↓ (header: Authorization: Bearer <token>)
Convex auth middleware
    ↓ ctx.auth.getUserIdentity()
    ↓ identity.subject = Clerk userId
All queries/mutations filter by this userId
```

### Implementation Pattern

Every query and mutation that touches tenant data follows this guard:

```typescript
// convex/invoices.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // userId IS the tenant key — no separate tenantId needed for single-owner model
    return ctx.db
      .query("invoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect();
  },
});
```

### Database Index Strategy

Every table that holds per-tenant data needs a `by_owner` index:

```typescript
// convex/schema.ts
invoices: defineTable({
  ownerId: v.string(),         // Clerk userId — the tenant key
  clientName: v.string(),
  clientEmail: v.string(),
  amount: v.number(),
  dueDate: v.number(),         // Unix timestamp
  status: v.union(
    v.literal("upcoming"),
    v.literal("due"),
    v.literal("overdue"),
    v.literal("paid")
  ),
  reminderScheduleId: v.optional(v.id("_scheduled_functions")),
}).index("by_owner", ["ownerId"])
  .index("by_owner_status", ["ownerId", "status"]),
```

Why `by_owner` index on every tenant table: without it, every query does a full table scan. At 1,000 tenants with 50 invoices each, unindexed reads become expensive quickly.

### Tenants Table

Store per-tenant settings separately from the auth identity:

```typescript
tenants: defineTable({
  ownerId: v.string(),           // Clerk userId — FK to Clerk
  stripeCustomerId: v.optional(v.string()),
  stripeSubscriptionId: v.optional(v.string()),
  subscriptionStatus: v.union(
    v.literal("active"),
    v.literal("trialing"),
    v.literal("past_due"),
    v.literal("canceled"),
    v.literal("none")
  ),
  reminderConfig: v.object({
    daysBefore: v.array(v.number()),  // e.g. [7, 3, 1]
    daysAfter: v.array(v.number()),   // e.g. [1, 3, 7, 14]
  }),
}).index("by_owner", ["ownerId"])
  .index("by_stripe_customer", ["stripeCustomerId"]),
```

The `by_stripe_customer` index is critical: Stripe webhooks arrive with `customerId`, not `ownerId`. Without this index, you cannot resolve the tenant from a webhook efficiently.

---

## Invoice Lifecycle State Machine

**Confidence: HIGH** — standard pattern for this domain.

```
                   [Created]
                      │
                      ▼
               ┌─────────────┐
               │  upcoming   │  dueDate > today
               └──────┬──────┘
                      │  daily cron detects dueDate == today
                      ▼
               ┌─────────────┐
               │     due     │  dueDate == today
               └──────┬──────┘
                      │  daily cron detects dueDate < today
                      ▼
               ┌─────────────┐
               │   overdue   │  dueDate < today
               └──────┬──────┘
                      │  manual action by owner
                      ▼
               ┌─────────────┐
               │    paid     │  terminal state
               └─────────────┘
```

### Status Transition Rules

| From | To | Trigger | Handler |
|------|----|---------|---------|
| upcoming | due | `dueDate` date == today | Daily cron sweep |
| due | overdue | `dueDate` date < today | Daily cron sweep |
| overdue | paid | User clicks "Mark Paid" | Mutation |
| due | paid | User clicks "Mark Paid" | Mutation |
| upcoming | paid | User clicks "Mark Paid" | Mutation |
| any | (cancelled reminder) | Status becomes "paid" | Cancel scheduled job |

### Why a Daily Cron, Not Per-Invoice Timer, for Status

Status updates don't need exact-to-the-minute precision. A daily cron that sweeps all unpaid invoices and updates statuses based on `dueDate` comparison is simpler, more reliable, and avoids accumulating thousands of tiny scheduled jobs. Per-invoice timers are used for reminders (exact delivery time matters there), not for status transitions.

---

## Scheduled Reminder Architecture

**Confidence: MEDIUM** — Convex's `ctx.scheduler.runAt()` is well-established, but reminder cancellation patterns have edge cases worth validating in docs.

### Two-Layer Scheduling Pattern

```
Invoice Created / Due Date Changed
          │
          ▼
   schedulerMutation()
          │
          ├─ for each configured reminder day:
          │    ctx.scheduler.runAt(reminderTimestamp, "reminders:send", { invoiceId })
          │    → stores scheduledFunctionId on invoice
          │
          └─ stores array of scheduledFunctionIds: [id1, id2, id3]

Invoice Marked Paid
          │
          ▼
   cancelRemindersMutation()
          │
          └─ for each stored scheduledFunctionId:
               ctx.scheduler.cancel(id)
```

### Why Store Scheduled Job IDs

Convex's `ctx.scheduler.runAt()` returns a `_scheduled_functions` document ID. By storing it on the invoice, you can cancel pending reminders when the invoice is paid — without this, a paid invoice would still send "please pay" emails.

```typescript
// convex/schema.ts — store multiple job IDs
invoices: defineTable({
  // ...other fields
  scheduledReminderIds: v.optional(v.array(v.id("_scheduled_functions"))),
})
```

### Reminder Execution Flow

```
ctx.scheduler.runAt fires at scheduled time
          │
          ▼
    reminders:send mutation
          │
          ├─ fetch invoice (check still unpaid — idempotency guard)
          ├─ fetch tenant reminder config
          ├─ if invoice.status === "paid" → return early (no email)
          │
          ▼
    scheduleEmailAction()
          │
          ▼
    convex action → Resend API call
          │
          ▼
    write to reminderLog table (for audit trail)
```

### Cron vs Per-Invoice Scheduler — When to Use Which

| Use Case | Mechanism | Rationale |
|----------|-----------|-----------|
| Status transitions (upcoming→due→overdue) | Daily cron | Batch operation, no exact timing needed |
| Reminder emails | `ctx.scheduler.runAt()` | Exact delivery time matters (e.g., "7 days before due date at 9am") |
| Subscription expiry enforcement | Stripe webhook → mutation | Event-driven, not time-based |

---

## Stripe Webhook Pattern

**Confidence: HIGH** — this is the standard pattern for Next.js + Stripe.

### Architecture

Stripe webhooks must go through an HTTP endpoint that Stripe can reach — they cannot go directly to Convex (Stripe doesn't know Convex's internal action URLs in a reachable way). The correct pattern routes them through a Next.js API route:

```
Stripe event fires
          │
          ▼
POST /api/webhooks/stripe  (Next.js API route)
          │
          ├─ Validate Stripe signature (stripe.webhooks.constructEvent)
          ├─ Parse event type
          │
          ▼
convexClient.mutation(api.stripe.handleWebhook, { event })
          │
          └─ Convex mutation updates tenant subscription status
```

### Critical: Raw Body for Signature Verification

Stripe signature verification requires the raw unparsed body. In Next.js App Router this means:

```typescript
// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const body = await req.text();  // NOT req.json() — must be raw text
  const sig = req.headers.get("stripe-signature")!;
  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  // ...
}
```

### Events to Handle

| Stripe Event | Action |
|--------------|--------|
| `checkout.session.completed` | Create/link Stripe customer, activate subscription |
| `customer.subscription.created` | Set subscription active, record `subscriptionId` |
| `customer.subscription.updated` | Update subscription status (plan change, renewal) |
| `customer.subscription.deleted` | Mark tenant subscription as canceled |
| `invoice.payment_failed` | Mark subscription `past_due`, trigger dunning email |
| `invoice.payment_succeeded` | Confirm active status, reset `past_due` if applicable |

### Idempotency

Stripe may deliver the same webhook multiple times. Guard mutations:

```typescript
// convex/stripe.ts
export const handleWebhook = mutation({
  args: { stripeEventId: v.string(), eventType: v.string(), /* ... */ },
  handler: async (ctx, args) => {
    // Check if already processed
    const existing = await ctx.db
      .query("processedWebhooks")
      .withIndex("by_stripe_event_id", q => q.eq("stripeEventId", args.stripeEventId))
      .first();
    if (existing) return; // idempotent — already handled
    // ... process event
    await ctx.db.insert("processedWebhooks", { stripeEventId: args.stripeEventId });
  },
});
```

---

## Email Delivery Pipeline

**Confidence: HIGH** — Resend with Convex actions is a well-established pattern.

### Architecture

Convex mutations cannot make external HTTP calls. Email must go through a Convex action (which CAN call external APIs), triggered from a mutation:

```
Reminder scheduler fires
          │
          ▼
Convex mutation (reminder:dispatch)
    - fetch invoice + tenant data
    - verify invoice still unpaid
    - call ctx.scheduler.runAfter(0, "email:send", { ... })
          │
          ▼
Convex action (email:send)
    - build email payload
    - POST to Resend API
    - on success: mutation writes to reminderLog
    - on failure: mutation writes error to reminderLog
```

### Why Action-Not-Mutation for Email

Mutations are transactional and must be deterministic — they cannot have side effects like HTTP calls. Actions are the correct Convex primitive for external I/O.

### Email Payload Structure

```typescript
// convex/email.ts
interface ReminderEmailPayload {
  to: string;            // client email
  ownerName: string;     // tenant business name (from tenant config)
  clientName: string;
  invoiceAmount: number;
  dueDate: string;       // human-readable
  daysDiff: number;      // negative = before due, positive = after due
  reminderType: "before" | "on_due_date" | "overdue";
}
```

### Resend Integration

Use Resend SDK (`resend` npm package) inside a Convex action. Store `RESEND_API_KEY` as a Convex environment variable (not Next.js `.env`).

### Email Audit Trail

Write a `reminderLog` record on every send attempt (success or failure) to support debugging and prevent duplicate sends:

```typescript
reminderLog: defineTable({
  invoiceId: v.id("invoices"),
  ownerId: v.string(),
  sentAt: v.number(),           // Unix timestamp
  reminderType: v.string(),     // "7_days_before", "on_due_date", etc.
  status: v.union(v.literal("sent"), v.literal("failed")),
  resendMessageId: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
}).index("by_invoice", ["invoiceId"])
  .index("by_owner", ["ownerId"]),
```

---

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Clerk auth pages
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (dashboard)/              # Protected tenant routes
│   │   ├── dashboard/
│   │   ├── invoices/
│   │   └── settings/
│   └── api/
│       ├── webhooks/
│       │   └── stripe/           # Stripe webhook endpoint
│       └── billing/
│           └── portal/           # Stripe billing portal redirect
│
├── components/
│   ├── invoices/                 # Invoice-specific UI
│   ├── dashboard/                # Dashboard widgets
│   └── ui/                       # Shared design system components
│
└── lib/
    └── stripe.ts                 # Stripe SDK client config

convex/
├── schema.ts                     # All table definitions with indexes
├── invoices.ts                   # Invoice queries + mutations
├── tenants.ts                    # Tenant profile queries + mutations
├── reminders.ts                  # Reminder scheduling mutations
├── email.ts                      # Email action (calls Resend)
├── stripe.ts                     # Stripe webhook mutation
├── crons.ts                      # Daily status sweep cron
└── _generated/                   # Auto-generated (do not edit)
```

### Structure Rationale

- **convex/ at root level:** Convex CLI expects its folder at the project root. Do not nest it inside `src/`.
- **`(auth)/` route group:** Keeps auth pages separate from dashboard without affecting URL paths.
- **`convex/email.ts` is an action file:** Separating email logic from invoice logic prevents accidental direct calls — callers must go through the action primitive.
- **`convex/crons.ts` is a dedicated file:** Convex's cron registration requires a specific export pattern; keeping it separate makes the scheduler inventory visible.

---

## Data Flow

### Invoice Creation Flow

```
User fills invoice form
          │
          ▼
useConvexMutation(api.invoices.create)
          │ (WebSocket, real-time)
          ▼
Convex mutation: invoices.create
    1. Verify auth (ctx.auth.getUserIdentity)
    2. Check tenant subscription is active
    3. Insert invoice document with status: "upcoming"
    4. Call reminders.scheduleForInvoice(invoiceId, dueDate, tenantConfig)
          │
          ▼
reminders.scheduleForInvoice mutation
    For each configured reminder offset:
        ctx.scheduler.runAt(reminderTimestamp, api.reminders.dispatch, { invoiceId })
        → returns scheduledFunctionId
    Update invoice.scheduledReminderIds = [id1, id2, ...]
          │
          ▼
UI reactively updates (Convex real-time subscription)
```

### Reminder Dispatch Flow

```
ctx.scheduler fires at scheduled time
          │
          ▼
reminders.dispatch mutation
    1. Fetch invoice → if paid, return early
    2. Fetch tenant reminder config
    3. Build reminder context (daysDiff, reminderType)
    4. ctx.scheduler.runAfter(0, api.email.send, emailPayload)
          │
          ▼
email.send action
    1. Call Resend API
    2. On success: insert reminderLog { status: "sent" }
    3. On failure: insert reminderLog { status: "failed" }
```

### Stripe Subscription Flow

```
User clicks "Subscribe"
          │
          ▼
Next.js server action → Stripe checkout session create
          │
          ▼
User completes Stripe checkout
          │
          ▼
Stripe fires checkout.session.completed webhook
          │
          ▼
POST /api/webhooks/stripe (Next.js route)
    1. Verify signature
    2. convexClient.mutation(api.stripe.handleWebhook, event)
          │
          ▼
stripe.handleWebhook Convex mutation
    1. Idempotency check (processedWebhooks table)
    2. Find tenant by stripeCustomerId
    3. Update tenant.subscriptionStatus = "active"
    4. Store stripeSubscriptionId
          │
          ▼
Clerk user metadata (optional) updated via Clerk Backend API
    → gates dashboard access
```

### Dashboard Read Flow

```
User opens dashboard
          │
          ▼
useQuery(api.dashboard.stats)
    ↓ Convex reactive subscription
    ↓ scoped to ctx.auth.userId
    Returns: { totalInvoices, overdueCount, totalUnpaid }
          │
          ▼
Dashboard re-renders reactively when any invoice changes
```

---

## Component Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Next.js UI ↔ Convex | Convex React hooks over WebSocket | Real-time, auto-reconnects |
| Convex mutation ↔ Convex action | `ctx.scheduler.runAfter(0, actionFn, args)` | Actions cannot be called directly from mutations; use scheduler with delay 0 |
| Convex action ↔ Resend | HTTP POST via Resend SDK | RESEND_API_KEY in Convex env vars |
| Stripe ↔ Next.js | POST webhook to `/api/webhooks/stripe` | Must verify signature before trusting payload |
| Next.js webhook handler ↔ Convex | ConvexHttpClient (server-side) | Use service key, not user JWT |
| Clerk ↔ Convex | JWT validation on every request | Configured in Convex dashboard (JWKS URL from Clerk) |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 tenants | Current architecture is sufficient. Single cron sweep is fast. |
| 500-5,000 tenants | Monitor cron sweep duration. If sweep takes >5min, paginate with `cursor`. Add `by_owner_status` compound index to filter unpaid-only. |
| 5,000+ tenants | Convex handles this tier well due to its reactive query model. Consider partitioning the daily sweep by status to reduce per-run work. Email volume becomes the bottleneck (Resend plan limits). |

### Scaling Priorities

1. **First bottleneck: daily cron sweep** — sweeping all invoices across all tenants in one pass will eventually be slow. Fix: add a `nextStatusCheckAt` field to each invoice and only sweep invoices where that field is in the past.
2. **Second bottleneck: email throughput** — Resend's free tier has per-day limits. Fix: upgrade Resend plan; implement send-rate backoff in the email action.

---

## Anti-Patterns

### Anti-Pattern 1: Storing Stripe Data Only in Clerk Metadata

**What people do:** Put `stripeCustomerId` and `subscriptionStatus` in Clerk user public metadata only, never in the database.
**Why it's wrong:** Clerk metadata is not queryable. You cannot look up a tenant by `stripeCustomerId` when a webhook arrives. You end up calling the Clerk API on every webhook to resolve users, which is slow and adds a failure surface.
**Do this instead:** Store Stripe IDs in the `tenants` Convex table with an index on `stripeCustomerId`. Use Clerk metadata only as a cache/gate for client-side access control.

### Anti-Pattern 2: Calling Resend Directly from a Mutation

**What people do:** Try to make HTTP calls inside a `mutation()` handler.
**Why it's wrong:** Convex mutations must be deterministic and transactional — they cannot perform I/O. This will throw a runtime error.
**Do this instead:** Call email from a Convex `action()`. Trigger the action from the mutation via `ctx.scheduler.runAfter(0, api.email.send, payload)`.

### Anti-Pattern 3: No Idempotency Guard on Reminder Dispatch

**What people do:** The reminder scheduler fires the email action directly without checking if the invoice is still unpaid.
**Why it's wrong:** If an invoice is paid after a reminder is scheduled but before it fires (and `cancel()` wasn't called in time), the client receives a "please pay" email after they already paid.
**Do this instead:** Always check `invoice.status !== "paid"` at the top of the reminder dispatch mutation before sending.

### Anti-Pattern 4: Skipping the `by_owner` Index on Every Tenant Table

**What people do:** Rely on Convex's document storage without adding indexes, since it "works" in development with small data.
**Why it's wrong:** Without `by_owner` indexes, every query is a full collection scan. At scale this is slow and expensive.
**Do this instead:** Add `.index("by_owner", ["ownerId"])` in `schema.ts` from day one, before any data is written.

### Anti-Pattern 5: Using Next.js API Routes as the Primary Backend

**What people do:** Implement invoice CRUD as Next.js API routes instead of Convex mutations.
**Why it's wrong:** Loses Convex's real-time reactivity, optimistic updates, and transactional guarantees. Also duplicates auth logic.
**Do this instead:** Keep all data operations in Convex mutations/queries. Use Next.js API routes only for external webhook ingestion (Stripe) and Stripe checkout session creation.

---

## Build Order Implications

The component dependency graph defines this build order:

```
1. Convex schema + indexes
        ↓
2. Clerk auth + Convex JWT integration
        ↓
3. Tenant creation on first login (tenants table)
        ↓
4. Invoice CRUD (queries + mutations, with by_owner scoping)
        ↓
5. Invoice status state machine (daily cron)
        ↓
6. Reminder scheduling (ctx.scheduler.runAt per invoice)
        ↓
7. Email action (Resend integration)
        ↓
8. Stripe subscription flow (checkout + webhook)
        ↓
9. Subscription gate on dashboard access
```

**Why this order:**
- Schema must exist before any data operations.
- Auth must exist before any tenant-scoped queries (tenant creation depends on auth identity).
- Invoice CRUD must work before scheduling reminders (nothing to schedule without invoices).
- Reminder scheduling depends on the email action being functional.
- Stripe billing is last because it gates access rather than enabling core functionality — the product should work end-to-end before billing is enforced.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Clerk | JWT validator in Convex dashboard (JWKS endpoint from Clerk) | Configure `CLERK_JWT_ISSUER_DOMAIN` in Convex env |
| Stripe | Webhook → Next.js route → Convex mutation via ConvexHttpClient | Webhook secret in Next.js env; ConvexHttpClient uses Convex service key |
| Resend | Convex action → Resend SDK HTTP call | `RESEND_API_KEY` in Convex environment variables (not Next.js) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Invoice mutation ↔ reminder scheduler | Direct call within same mutation via `ctx.scheduler` | Same transaction context |
| Reminder dispatch ↔ email send | `ctx.scheduler.runAfter(0, ...)` | Crosses mutation→action boundary |
| Stripe webhook handler ↔ tenant update | `ConvexHttpClient.mutation()` from Next.js | Server-to-server; requires Convex deploy key |

---

## Sources

- Convex documentation (training knowledge, Aug 2025): `ctx.auth.getUserIdentity()`, `ctx.scheduler.runAt()`, actions vs mutations distinction, crons API
- Stripe documentation (training knowledge, Aug 2025): webhook signature verification, subscription event types, `checkout.session.completed` flow
- Clerk documentation (training knowledge, Aug 2025): JWT issuance, Convex integration via JWKS
- Resend documentation (training knowledge, Aug 2025): `resend` npm package, transactional email API

**Note:** All sources are from training knowledge (cutoff Aug 2025). WebFetch and WebSearch were unavailable during this research session. Validate the following before implementation:
- Convex's exact API for cancelling scheduled functions (`ctx.scheduler.cancel()` signature)
- Whether Convex now supports calling actions directly from mutations (this may have changed)
- Resend SDK version and constructor API (v2+ changed the API shape)

---
*Architecture research for: Multi-tenant invoice tracking SaaS*
*Researched: 2026-03-16*
