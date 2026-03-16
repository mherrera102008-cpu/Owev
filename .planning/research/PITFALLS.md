# Pitfalls Research

**Domain:** Multi-tenant invoice tracking SaaS (Clerk + Convex + Stripe + Next.js)
**Researched:** 2026-03-16
**Confidence:** MEDIUM — external search tools unavailable; findings drawn from training knowledge of Convex docs, Clerk docs, Stripe docs, and known SaaS patterns. Flag items marked LOW for independent verification before implementation.

---

## Critical Pitfalls

### Pitfall 1: Convex Queries Missing Tenant Scope (Data Bleed Between Tenants)

**What goes wrong:**
A Convex query fetches all rows matching a filter (e.g., `invoices where status == "overdue"`) without also filtering by `userId` or `orgId`. Every tenant sees every other tenant's data, or — worse — mutation functions modify records belonging to another tenant.

**Why it happens:**
Convex's document model makes it trivial to write `.filter(q => q.eq(q.field("status"), "overdue"))` and ship it. The filter works correctly in single-tenant tests. Multi-tenant enforcement is not automatic — Convex does not inject a tenant scope at the query layer the way row-level security (RLS) in Postgres does. The developer must add it manually every time.

**How to avoid:**
1. Create a single canonical helper `getCurrentUserId(ctx)` that reads `ctx.auth.getUserIdentity()` and throws if no identity is found. Never inline identity extraction.
2. Every `query` and `mutation` that touches tenant-owned data must call `getCurrentUserId(ctx)` and include `q.eq(q.field("userId"), userId)` in every filter — not just on queries that seem "sensitive."
3. Add an index on `(userId, ...)` for every tenant-scoped table so the filter is cheap and the pattern is enforced at the index level.
4. Write an explicit test: create two users, insert an invoice for user A, query as user B — assert empty result.

**Warning signs:**
- Any query that filters by a domain field (status, dueDate) but does NOT also filter by `userId`.
- Convex functions that accept a `userId` argument from the client instead of reading it from `ctx.auth` — clients can pass any value.
- Dashboard aggregate counts that return non-zero results for a brand new tenant account.

**Phase to address:** Authentication + multi-tenancy foundation phase (the very first data phase). Retrofit is painful.

---

### Pitfall 2: Clerk Identity Not Validated in Convex — Client-Supplied userId

**What goes wrong:**
The frontend reads `useUser()` from Clerk, extracts `user.id`, and passes it as an argument to a Convex mutation: `api.invoices.create({ userId: user.id, ... })`. The Convex function trusts this argument without verifying it. Any client can forge a `userId` and write data under another tenant's identity.

**Why it happens:**
It is the obvious way to pass identity in a React app. It works in development. Clerk's frontend SDK makes `user.id` trivially accessible.

**How to avoid:**
Never accept `userId` as a client argument for data ownership. Always use `ctx.auth.getUserIdentity()` inside Convex functions. The Convex + Clerk integration issues a JWT that Convex validates server-side — `ctx.auth` is the authoritative source. For Clerk, the `subject` field of the identity is the `userId`.

```typescript
// WRONG — never do this
export const createInvoice = mutation({
  args: { userId: v.string(), ... },
  handler: async (ctx, { userId, ... }) => { ... }
});

// CORRECT
export const createInvoice = mutation({
  args: { ... }, // no userId arg
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;
    ...
  }
});
```

**Warning signs:**
- Any Convex mutation `args` schema that includes `userId: v.string()`.
- Convex functions that receive identity from the client and store it directly.

**Phase to address:** Authentication + multi-tenancy foundation phase. Establish the pattern before any data mutations are written.

---

### Pitfall 3: Stripe Webhook Processing Without Idempotency Guard

**What goes wrong:**
Stripe delivers webhooks at-least-once. Under network failures or Stripe retries, the same `invoice.payment_succeeded` or `customer.subscription.updated` event can arrive 2–3 times within seconds. Without an idempotency check, the handler runs twice: a subscription is activated twice, a "payment received" email fires twice, or a counter is incremented twice.

**Why it happens:**
The handler is written as a simple "receive event → update database" pipeline. It works in testing because Stripe CLI rarely retries during local development.

**How to avoid:**
Store processed Stripe event IDs in a Convex `stripeEvents` table with the `stripeEventId` as a unique-indexed field. Before processing any webhook:
1. Check if `stripeEventId` already exists in the table.
2. If yes, return 200 immediately (acknowledge without processing).
3. If no, process the event, then insert the `stripeEventId`.

This must be done atomically. In Convex, the entire mutation is a transaction — insert the event record and perform business logic in the same mutation handler. If business logic throws, the event record is not written, so it will retry correctly.

**Warning signs:**
- Webhook handler functions that do not reference any `stripeEventId` or deduplication table.
- Users reporting duplicate "payment confirmed" emails after subscribing.
- Subscription status toggling back and forth in logs.

**Phase to address:** Stripe subscription billing phase. Add idempotency before enabling live webhooks.

---

### Pitfall 4: Email Reminders Firing for Already-Paid Invoices

**What goes wrong:**
A scheduled reminder job runs, queries for invoices due "tomorrow," and sends reminder emails. A client paid 10 minutes ago — the invoice is now marked paid — but the reminder fires anyway because the scheduler pre-fetched or queued the job before the status update landed.

**Why it happens:**
Two patterns cause this: (1) reminders are pre-scheduled at invoice creation time with fixed timestamps, so canceling them when an invoice is paid requires explicitly canceling every scheduled job; (2) reminders are calculated at run-time but the query uses stale data or doesn't filter by `status != "paid"`.

**How to avoid:**
Use a polling-based reminder approach rather than pre-scheduled-per-invoice approach:
- Run a single Convex scheduled function (cron) every 15–60 minutes.
- The cron queries for invoices where `status != "paid"` AND `nextReminderAt <= now()`.
- Check `status` at execution time, not at scheduling time.
- After sending, update `nextReminderAt` to the next scheduled reminder date.

This means the paid check is always fresh at send time. The "already paid" case becomes impossible to hit because the query excludes paid invoices.

If using per-invoice scheduled jobs (Convex `ctx.scheduler.runAt`), you must cancel the job ID when marking an invoice paid. Store the `schedulerId` on the invoice document and call `ctx.scheduler.cancel(invoice.schedulerId)` in the `markPaid` mutation.

**Warning signs:**
- Reminder send logic does not re-check `invoice.status` immediately before calling the email API.
- `markPaid` mutation does not cancel any scheduled job references.
- Users reporting "I got a reminder after I already paid."

**Phase to address:** Email reminder scheduling phase.

---

### Pitfall 5: Duplicate Reminder Sends (Race Condition in Scheduled Jobs)

**What goes wrong:**
Two instances of the reminder cron job overlap, or a retry fires while the first execution is still in progress. Both instances query the same set of invoices that need reminders and both send emails — clients receive duplicate reminders within seconds of each other.

**Why it happens:**
Convex scheduled functions are designed to not overlap by default for a single scheduled run. However, if reminders are triggered via multiple paths (e.g., a manual "send now" button AND a cron job), both can fire simultaneously. Alternatively, a developer adds a second cron entry during debugging and forgets to remove it.

**How to avoid:**
1. Use a single cron entry for reminder dispatch — no ad-hoc triggers for the same action.
2. Use a "claim" pattern: in the same Convex mutation that reads invoices to remind, immediately update a `reminderLockedUntil` timestamp on each invoice before sending. Any concurrent execution will skip locked invoices.
3. For the "send now" override, mark it as an explicit action in the invoice record, not a duplicate scheduler invocation.

**Warning signs:**
- Multiple Convex `crons` entries targeting the same reminder function.
- Reminder logic that does not update any state on the invoice before the email is sent (no atomic claim step).
- Client complaints of receiving the same reminder email twice.

**Phase to address:** Email reminder scheduling phase.

---

### Pitfall 6: Timezone Handling — Reminders Fire at Wrong Local Time

**What goes wrong:**
Due dates are stored as UTC timestamps. The reminder "1 day before due date" fires at midnight UTC, which is 7pm the previous day in New York, or 8am the next day in Tokyo. Clients receive reminders at unexpected times, degrading trust.

**Why it happens:**
All JavaScript `Date` math defaults to UTC. The developer stores `dueDate` as a UTC epoch, computes `dueDate - 86400000` for "1 day before," and schedules at that UTC time. No timezone is ever considered.

**How to avoid:**
1. Store the business owner's IANA timezone string (e.g., `"America/New_York"`) on their account at signup.
2. When calculating reminder send times, convert the due date to the owner's local timezone, then determine the target send time in that timezone (e.g., 9am local), then convert back to UTC for storage.
3. Use `Intl.DateTimeFormat` or a date library with IANA timezone support (date-fns-tz or Temporal API polyfill) — never manual UTC offset arithmetic.
4. Store `nextReminderAt` as a UTC epoch computed using the owner's timezone.

**Warning signs:**
- No timezone field on the user/tenant table.
- Reminder time calculations using raw millisecond arithmetic without timezone conversion.
- All reminders firing at the same UTC hour regardless of tenant location.

**Phase to address:** Email reminder scheduling phase, immediately when scheduling logic is designed.

---

### Pitfall 7: Subscription Gating — Features Accessible Without Active Subscription

**What goes wrong:**
Subscription status is checked only on the frontend (e.g., hide the "Add Invoice" button if not subscribed). The Convex mutation that actually creates invoices does not verify subscription status. A user with browser DevTools or direct API access can call the mutation and create invoices regardless of their subscription state.

**Why it happens:**
Frontend gating is fast to implement and feels sufficient during development. It is easy to forget that Convex functions are callable directly from any client.

**How to avoid:**
Subscription gating must exist in the Convex mutation, not only in the React component:
1. Store `subscriptionStatus` and `subscriptionTier` on the user/tenant document in Convex, updated by the Stripe webhook handler.
2. Every mutation that creates or modifies tenant data calls a `requireActiveSubscription(ctx)` helper that reads the tenant's subscription status from the database and throws if not active.
3. The frontend gate is UX polish — the backend gate is the actual enforcement.

**Warning signs:**
- Subscription status checked only via `useUser()` hooks or Clerk metadata in React components.
- Convex mutations that do not read any subscription field before performing write operations.
- The Stripe webhook handler exists but does not write `subscriptionStatus` back to the user's Convex document.

**Phase to address:** Stripe subscription billing phase.

---

### Pitfall 8: Stripe Webhook Subscription Status Out of Sync With Convex

**What goes wrong:**
A user cancels their subscription via Stripe's portal. The cancellation webhook (`customer.subscription.deleted` or `customer.subscription.updated` with `status: "canceled"`) is not handled or is handled incorrectly, so Convex still shows the user as subscribed. They continue using the product for free after cancellation.

**Why it happens:**
Developers handle `checkout.session.completed` (the happy path) but miss the full set of subscription lifecycle events: `customer.subscription.updated` (covers downgrades, trial ending, payment failure), `customer.subscription.deleted` (cancellation), `invoice.payment_failed` (grace period), `invoice.payment_succeeded` (renewal).

**How to avoid:**
Handle the complete subscription lifecycle, not just activation:
- `checkout.session.completed` → set active
- `customer.subscription.updated` → sync status field (covers: trial_end, past_due, paused)
- `customer.subscription.deleted` → set inactive/cancelled
- `invoice.payment_failed` → set past_due, trigger grace period
- `invoice.payment_succeeded` → ensure status is active (handles renewal)

Map Stripe's `subscription.status` values directly to a local enum. Do not derive local status from partial fields.

**Warning signs:**
- Webhook handler only has a `checkout.session.completed` case.
- Users who cancelled via Stripe portal can still add invoices.
- No `past_due` or `canceled` status handling in the Convex `users` table.

**Phase to address:** Stripe subscription billing phase.

---

### Pitfall 9: Next.js Route Handler vs. Convex HTTP Action for Stripe Webhooks

**What goes wrong:**
The developer puts the Stripe webhook handler in a Next.js API route (`/api/webhooks/stripe`). This works but creates a split architecture: Stripe calls Next.js, which then has to call Convex via an HTTP action or the Convex client. The Next.js handler must be deployed, has cold-start latency risk, and complicates local development (requires `ngrok` or similar to test webhooks against the Next.js server).

A subtler failure: Next.js API routes with the App Router can buffer the request body before you access it, breaking Stripe's signature verification (which requires the raw body bytes).

**Why it happens:**
Developers familiar with Next.js naturally reach for `/api/` routes. It is the default pattern they know.

**How to avoid:**
Two valid approaches — pick one and be consistent:
1. **Convex HTTP Action** (`convex/http.ts`): Handle webhooks entirely in Convex. Stripe calls the Convex HTTP endpoint directly. All database writes happen in the same Convex context. Simpler architecture.
2. **Next.js route with `request.text()`**: If staying in Next.js, read the body as raw text (`await request.text()`), pass to `stripe.webhooks.constructEvent(rawBody, sig, secret)`, then call Convex via the server-side Convex client.

Never use `request.json()` before signature verification — it consumes the body stream and the raw bytes are lost.

**Warning signs:**
- Stripe webhook handler uses `request.json()` or `req.body` before calling `stripe.webhooks.constructEvent`.
- Webhook signature verification errors in production but not in local testing.
- Architecture has Next.js receiving webhooks and then making HTTP calls to Convex.

**Phase to address:** Stripe subscription billing phase.

---

### Pitfall 10: Convex Real-Time Subscriptions Causing Over-Fetching on Dashboard

**What goes wrong:**
The dashboard subscribes to a `useQuery(api.invoices.list)` that returns all invoices for the tenant. As invoice count grows, every real-time update (any invoice status change anywhere) re-renders the entire dashboard with the full list. At 500+ invoices, this creates noticeable UI jank and excess bandwidth.

**Why it happens:**
`useQuery` with Convex is reactive — any document change that affects the query result triggers a re-delivery. Fetching the full list and computing aggregates client-side is the path of least resistance.

**How to avoid:**
1. Use separate queries for aggregate values (total, overdue count, unpaid amount) and for the paginated invoice list.
2. Implement server-side aggregates in Convex using `collect()` with lean projections rather than fetching full documents.
3. Use Convex's pagination (`usePaginatedQuery`) for the invoice list, not a single query returning all documents.
4. Aggregate queries that return a single number re-render cheaply; only the list query triggers expensive re-renders.

**Warning signs:**
- Single `useQuery` returning an array of full invoice objects used both for display and for computing dashboard counts.
- No pagination on the invoice list at any point in the implementation.
- Dashboard visibly re-renders/flickers when any invoice is updated.

**Phase to address:** Dashboard and invoice list phase; revisit during any performance pass.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip per-mutation subscription check, gate only at page level | Faster to build | Free usage after cancellation; requires audit of all mutations to retrofit | Never for production |
| Store Clerk `userId` from client args instead of `ctx.auth` | Less boilerplate per function | Security hole — any client can impersonate any user | Never |
| Single `useQuery` for all invoices (no pagination) | Simpler React code | UI jank and excess bandwidth at scale; pagination is hard to retrofit | MVP only if invoice count is guaranteed low (<50/tenant) |
| Hardcode UTC for all date math | No timezone setup needed | Reminders fire at wrong times for non-UTC users | Never if users are in multiple timezones |
| Handle only `checkout.session.completed` webhook | Subscription activation works | Cancellations, failures, renewals silently break | Never for production billing |
| Use `request.json()` in Stripe webhook handler | Familiar API | Breaks Stripe signature verification in production | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Clerk + Convex | Reading `userId` from Clerk's React SDK and passing it as a mutation argument | Always use `ctx.auth.getUserIdentity().subject` inside the Convex function |
| Clerk + Convex | Not calling `ctx.auth.getUserIdentity()` — returning `null` silently and operating as unauthenticated | Always throw if `getUserIdentity()` returns null; never degrade silently |
| Stripe webhooks | Using `request.json()` before `stripe.webhooks.constructEvent()` | Use `request.text()` to get raw body; pass string (not parsed object) to `constructEvent` |
| Stripe webhooks | Handling only the creation event, not update/delete lifecycle events | Handle all 5 subscription lifecycle events |
| Stripe webhooks | Not returning HTTP 200 quickly, causing Stripe to retry | Acknowledge 200 first, process asynchronously if needed (or ensure Convex mutation is fast) |
| Resend/SendGrid | Not storing send attempts before calling the API | Write a `reminderSent` record to Convex before calling email API; if API fails, the record isn't written and retry is safe |
| Resend/SendGrid | Sending from an unverified domain | Verify domain DNS records before any production sends; emails to Gmail/Yahoo will be spam-binned without SPF/DKIM |
| Convex + Next.js | Using the Convex browser client in a Next.js Server Component | Use `ConvexHttpClient` for server-side fetches in Server Components; `useQuery` only in client components |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full invoice list query without index on `(userId, status)` | Slow dashboard as invoice count grows; Convex scans all documents | Add compound index `(userId, status)` from day one | ~500+ invoices per tenant |
| Computing dashboard aggregates client-side from full list | Dashboard slow to render; excess data transferred | Dedicated aggregate Convex queries with server-side filtering | ~100+ invoices per tenant |
| Sending emails synchronously inside a Convex mutation | Mutation timeout if email provider is slow; no retry on failure | Trigger email sends from a Convex action called after mutation, not inside mutation | Any email provider outage |
| Running reminder checks too frequently | High Convex function invocation count; cost at scale | 15–60 minute cron intervals are sufficient for invoice reminders; sub-minute is wasteful | Depends on Convex pricing tier |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting `userId` from client as mutation argument | Tenant impersonation — attacker writes data to another tenant's account | Always read identity from `ctx.auth` server-side |
| No subscription check in Convex mutations | Free usage after cancellation; resource abuse | `requireActiveSubscription(ctx)` helper called in every write mutation |
| Stripe webhook endpoint without signature verification | Attacker can forge events (fake payment, cancel others' subscriptions) | Always call `stripe.webhooks.constructEvent` with the signing secret; reject if it throws |
| Storing Stripe secret key in Next.js client bundle | Key exposed to browser; attacker can make arbitrary Stripe API calls | Stripe secret key only in server-side code and environment variables; never in `NEXT_PUBLIC_*` vars |
| Email addresses for reminders editable without re-verification | Attacker could redirect reminder emails to arbitrary addresses | Invoice client email is informational; re-sending to a new address is a new send, not a privilege escalation — but validate email format server-side |
| Convex HTTP actions without authentication check | Any internet caller can invoke mutations | All non-webhook HTTP actions must verify the Clerk JWT via `ctx.auth` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No optimistic UI on "Mark Paid" | Button feels unresponsive; user clicks twice → double action | Convex's `useMutation` supports optimistic updates; mark paid optimistically, roll back on error |
| Showing raw UTC timestamps in the invoice list | Business owners see "2026-03-17T00:00:00Z" instead of "Mar 17, 2026" | Format all dates using the user's locale and timezone on render |
| No confirmation when cancelling a reminder schedule | User accidentally disables all reminders for an invoice without realizing | Require explicit confirmation or undo action for schedule changes |
| Subscription paywall shown after data loss | User adds invoices, hits paywall, all data gone | Never delete data on subscription lapse; gate new additions only, preserve existing data |
| Email reminder with no "mark as paid" link | Client receives reminder but must contact business owner to stop reminders | Include a tokenized "I've paid, notify my vendor" link in reminder emails (even if simple) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Multi-tenancy isolation:** Every Convex query and mutation filters by `userId` from `ctx.auth` — verify by querying as a different user and confirming empty results.
- [ ] **Webhook idempotency:** Process a Stripe webhook event ID twice — verify it does not double-process (subscription not activated twice, no duplicate email sent).
- [ ] **Invoice paid before reminder fires:** Mark an invoice paid, wait for scheduled reminder time — verify no email is sent.
- [ ] **Subscription cancellation:** Cancel via Stripe test dashboard — verify user is blocked from adding new invoices within one webhook delivery.
- [ ] **Stripe webhook signature:** Send a forged webhook payload — verify it returns 400 and no database changes occur.
- [ ] **Timezone reminders:** Set a test invoice due date in a non-UTC timezone — verify reminder fires at correct local time, not midnight UTC.
- [ ] **Subscription gate in backend:** Bypass frontend gate by calling Convex mutation directly with an inactive-subscription account — verify mutation throws.
- [ ] **Email domain verification:** Send a reminder to a Gmail address from production — verify it lands in inbox, not spam.
- [ ] **Duplicate reminder prevention:** Trigger the reminder cron twice simultaneously — verify no duplicate emails sent.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Data bleed between tenants discovered post-launch | HIGH | Audit all Convex queries; add `userId` filters; run data audit to detect if cross-tenant reads occurred; notify affected users |
| Stripe webhooks processed without idempotency (duplicate records) | MEDIUM | Write a deduplication migration script; add idempotency table; replay Stripe webhook history from dashboard to verify state |
| Reminders sent to paid invoices | LOW | Add status re-check before send; send apology email to affected clients; add test for this case |
| Subscription gate only on frontend | MEDIUM | Add server-side check to all mutations; audit for any free usage that occurred; decide on grace period policy |
| Wrong timezone on reminders | LOW | Add timezone field to user schema; backfill from browser `Intl.DateTimeFormat().resolvedOptions().timeZone` on next login; resend missed reminders |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Tenant data isolation (missing userId filter) | Auth + data model phase | Cross-tenant query test returns empty |
| Client-supplied userId accepted | Auth + data model phase | Direct mutation call with forged userId is rejected |
| Stripe webhook idempotency | Billing phase | Replay event twice; no duplicate side effects |
| Reminders fire for paid invoices | Reminder scheduling phase | Mark paid before scheduled time; no email sent |
| Duplicate reminder sends | Reminder scheduling phase | Simultaneous cron triggers; single email sent |
| Timezone handling | Reminder scheduling phase | Non-UTC user receives reminder at correct local time |
| Subscription gate in mutations only on frontend | Billing phase | Direct Convex mutation call without active subscription is rejected |
| Incomplete Stripe lifecycle handling | Billing phase | Cancellation webhook processed; user access blocked |
| Raw body lost before Stripe signature verification | Billing phase | Forged webhook returns 400 |
| Dashboard over-fetching | Dashboard/performance phase | 500 invoices; dashboard load time < 1s |

---

## Sources

- Convex documentation on authentication (ctx.auth, getUserIdentity) — training knowledge, HIGH confidence
- Convex documentation on scheduled functions and crons — training knowledge, HIGH confidence
- Stripe documentation on webhook best practices and idempotency — training knowledge, HIGH confidence
- Stripe subscription lifecycle events reference — training knowledge, MEDIUM confidence (verify full event list against current Stripe docs)
- Clerk + Convex integration docs — training knowledge, MEDIUM confidence (verify JWT subject field name against current Clerk docs)
- Next.js App Router request body handling — training knowledge, MEDIUM confidence
- General SaaS multi-tenancy patterns — training knowledge, MEDIUM confidence
- Note: WebSearch and WebFetch were unavailable during this research session; all findings are from training data. Recommend verifying Stripe event names, Convex `ctx.auth` API shape, and Clerk subject field against current official documentation before implementation.

---
*Pitfalls research for: Multi-tenant invoice tracking SaaS (InvoiceTracker)*
*Researched: 2026-03-16*
