# Feature Research

**Domain:** Invoice tracking and automated payment reminder SaaS (multi-tenant, small business / agency)
**Researched:** 2026-03-16
**Confidence:** MEDIUM — based on training knowledge (cutoff Aug 2025) covering FreshBooks, Invoice Ninja, Wave, Zoho Invoice, HoneyBook, Bonsai, and community feedback. Live competitor verification was not available during this research session.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Invoice CRUD (create, view, edit, delete) | Core primitive — the product IS invoices | LOW | Needs: client name, amount, due date, invoice number, optional line items |
| Invoice status lifecycle | Users need at-a-glance payment state | LOW | Statuses: Draft → Sent → Due → Overdue → Paid. Automatic date-driven transitions are the differentiator; manual-only would be table stakes |
| Mark invoice as paid | Users must be able to close the loop manually | LOW | One-click action; partial payment is NOT table stakes for v1 |
| Dashboard summary view | Users land here every session — needs orientation | LOW | Total outstanding, overdue count, total unpaid amount. Pie/bar charts are nice-to-have |
| Automated email reminders | Core value prop — if reminders aren't automatic, the tool is just a spreadsheet | MEDIUM | Triggered by schedule relative to due date (e.g. -3 days, 0 days, +3 days, +7 days). SendGrid or Resend as transport |
| Configurable reminder schedule | Different businesses have different norms; rigid schedules cause churn | LOW | User sets which intervals to send reminders. Per-invoice override is v1.x |
| Client directory | Emails and names must be reusable — re-entering every time creates friction | LOW | Name + email is the minimum. Phone, address, notes are v1.x |
| Secure authentication | Multi-tenant SaaS without auth is broken by definition | LOW | Email/password + session management. Social login (Google) is a differentiator |
| Tenant data isolation | Each business must only see their own data | MEDIUM | Row-level security or tenant-scoped queries; critical from day one |
| Subscription billing | The product charges for itself — this is a business constraint, not just a feature | MEDIUM | Stripe subscription; free trial or freemium tier decision is a product question |
| Invoice number generation | Expected by every freelancer/agency for accounting purposes | LOW | Auto-increment per tenant (INV-001, INV-002…). Custom prefix is v1.x |
| Search and filter invoices | Once a user has 10+ invoices, scrolling becomes painful | LOW | Filter by status, client, date range. Full-text search is v1.x |
| Basic email deliverability | Reminders that land in spam are worse than no reminders | MEDIUM | Use transactional provider (SendGrid/Resend), sender domain verification recommended |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable once table stakes are solid.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-invoice reminder override | Most tools apply one schedule globally; per-invoice flexibility removes friction for edge cases | LOW | "This client pays late — skip the 3-day reminder, just send overdue" |
| Reminder preview before sending | Users fear sending an embarrassing reminder — preview builds trust | LOW | Show rendered email before schedule is confirmed |
| Customizable reminder email templates | Branding matters to agencies; rigid templates feel impersonal | MEDIUM | Merge fields: {client_name}, {invoice_number}, {amount}, {due_date}, {days_overdue}. Full HTML editor is overkill |
| Client payment portal (view-only) | Clients can see invoice details without calling the business | HIGH | Requires a public-facing, unauthenticated route scoped to invoice token. Significant security surface |
| One-click "stop reminders" on invoice | Users get paid verbally and want to silence the system immediately | LOW | Status: "Paid — awaiting transfer" or just mark paid |
| Aged receivables report | Shows which invoices have been outstanding longest — actionable insight | MEDIUM | Groups invoices by age buckets: 0-30d, 31-60d, 61-90d, 90d+. Drives collections decisions |
| Reminder send history log | "Did the system actually send the reminder?" is a common support question | LOW | Per-invoice timeline of sent reminders with timestamps |
| Google / social login | Reduces signup friction vs. email/password | LOW | OAuth with Google. Critical for B2C but less so for B2B tools |
| WhatsApp reminder channel | Many clients globally read WhatsApp faster than email | HIGH | Business API approval process is significant. Deferred in PROJECT.md — architecture must not block it |
| Currency and locale support | Agencies working internationally need non-USD invoices | LOW | Currency field on invoice (display only). Formatting by locale. Not multi-currency conversion |
| Bulk actions on invoice list | Power users with 50+ invoices need to mark many paid at once | MEDIUM | Checkbox selection + bulk status change. Adds UI complexity |
| CSV / PDF export | Accountants want records outside the tool | MEDIUM | PDF generation per invoice; CSV of all invoices for a date range |
| In-app notification when invoice becomes overdue | Proactive push to owner, not just automated client emails | LOW | In-app banner or email digest to the business owner |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create more problems than they solve at this stage.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full accounting / bookkeeping | "While you're at it, track expenses too" | Scope explosion; competes with QuickBooks/Xero; attracts wrong user segment; adds years to development | Stay focused on the accounts-receivable problem. Integrate with accounting tools via CSV export instead |
| Online payment collection (Stripe payment links on invoice) | Clients paying in one click sounds perfect | Payment processing requires compliance (PCI, fraud, disputes, refunds); fundamentally changes the product from tracking to fintech | Mark-as-paid flow for now; add payment links as a distinct phase after core is solid |
| Multi-user team accounts per tenant | "My bookkeeper needs access too" | Session, permissions, and audit trail complexity multiplies every other feature's complexity | Single owner account for v1. Team access is a named v2 feature |
| AI-generated invoice content | "Auto-fill descriptions based on my past invoices" | Training data privacy, hallucination risk, no clear ROI for simple invoices | Good templates and copy-paste UX achieve 90% of the value |
| Real-time collaboration | Shared editing of invoices in real time | WebSocket complexity, conflict resolution, no real use case for solo operators | Last-write-wins with optimistic updates is fine |
| Email inbox integration ("read replies to reminders") | Owners want to see if clients responded | OAuth email access, parsing, threading complexity — huge scope | Remind user in-app to check their email; link to Gmail/Outlook |
| Native mobile apps (iOS / Android) | "I want to add invoices from my phone" | Doubles the frontend investment; mobile web is sufficient for this use pattern | Responsive web UI with PWA characteristics handles the use case |
| Recurring invoices / subscriptions | Retainer clients expect automatic invoice generation | Meaningful complexity (billing cycles, proration, pause/resume); distraction from core AR problem for v1 | Add as v2 feature once invoice lifecycle is proven. Architecture should not break it |
| Custom invoice PDF templates / branding | Professional appearance matters to agencies | Template engine, PDF rendering pipeline, font handling, asset storage — high complexity for low-frequency use | Offer one clean, well-branded default template. Custom templates are a paid tier upsell |

---

## Feature Dependencies

```
[Authentication + Tenant Isolation]
    └──required by──> [All other features]

[Client Directory]
    └──required by──> [Invoice CRUD]
                          └──required by──> [Automated Email Reminders]
                                                └──required by──> [Reminder Schedule Config]
                                                └──required by──> [Reminder Send History]

[Invoice Status Lifecycle]
    └──required by──> [Dashboard Summary]
    └──required by──> [Aged Receivables Report]
    └──required by──> [Mark as Paid]

[Subscription Billing]
    └──enables──> [All tenants using the platform commercially]

[Invoice CRUD]
    └──enhances──> [Invoice Number Generation]
    └──enhances──> [Search and Filter]
    └──enhances──> [CSV / PDF Export]

[Reminder Preview]
    └──enhances──> [Automated Email Reminders]

[Client Payment Portal]
    └──requires──> [Invoice CRUD]
    └──requires──> [Secure token generation]

[WhatsApp Channel]
    └──requires──> [Reminder Schedule Config] (same scheduling engine, different transport)
    └──requires──> [WhatsApp Business API approval] (external dependency)
```

### Dependency Notes

- **Authentication requires nothing** but must be phase 1; everything else is gated behind it.
- **Client Directory requires Auth**: clients belong to a tenant; without isolation, client data leaks across tenants.
- **Invoice CRUD requires Client Directory**: invoices reference a client by ID; the lookup must exist first.
- **Automated Reminders require Invoice CRUD**: the scheduler queries invoices for upcoming/overdue status. No invoices = nothing to remind.
- **Reminder Schedule Config enhances Automated Reminders**: configurable intervals are a UX layer on top of the core scheduler. The scheduler must exist first.
- **Subscription Billing does not technically block other features** but must ship before launch per PROJECT.md constraints. It gates production access.
- **WhatsApp channel enhances (not replaces) email reminders**: the scheduling engine is shared; only the transport layer changes. Defer until after email reminders are solid.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validated by PROJECT.md requirements.

- [ ] Auth (signup, login, session) — gates all other features
- [ ] Tenant data isolation — multi-tenancy is a day-one constraint
- [ ] Client directory (name + email) — required by invoices
- [ ] Invoice CRUD with auto-incrementing invoice numbers — core primitive
- [ ] Invoice status lifecycle (upcoming / due / overdue / paid, date-driven) — core automation
- [ ] Mark invoice as paid — close-the-loop action
- [ ] Automated email reminders via SendGrid or Resend — the core value prop
- [ ] Configurable reminder schedule — without this, one rigid schedule causes early churn
- [ ] Dashboard summary (totals, overdue count, unpaid amount) — orientation on login
- [ ] Stripe subscription billing — required before launch per project constraints

### Add After Validation (v1.x)

Features to add once core loop is proven by real tenants.

- [ ] Reminder send history per invoice — reduces "did it send?" support questions; add when users start asking
- [ ] Per-invoice reminder override — add when users complain about the global schedule being too rigid
- [ ] Aged receivables report — add when users have enough data to make it useful (20+ invoices)
- [ ] Customizable reminder email templates — add when branding complaints emerge
- [ ] Invoice search and filter — add when tenants accumulate enough invoices to make it painful (30+ invoices threshold)
- [ ] Google login — reduces signup friction; add when signup conversion data suggests it's a bottleneck
- [ ] CSV export — add when accountants start asking for records

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] WhatsApp reminder channel — high complexity (Business API), already deferred in PROJECT.md; architecture should not block it
- [ ] Client payment portal — high value but significant security surface; warrants its own phase
- [ ] Recurring invoices — adds billing-cycle complexity; only worth building after core AR is solid
- [ ] Online payment collection (Stripe payment links) — fintech scope; requires its own compliance consideration
- [ ] Multi-user team access per tenant — explicitly out of scope for v1 per PROJECT.md
- [ ] PDF invoice generation with custom branding — high effort, low frequency; offer basic export first
- [ ] Bulk actions on invoice list — useful at scale; not needed until users have 50+ invoices

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth + Tenant Isolation | HIGH | MEDIUM | P1 |
| Invoice CRUD | HIGH | LOW | P1 |
| Invoice Status Lifecycle | HIGH | LOW | P1 |
| Mark as Paid | HIGH | LOW | P1 |
| Automated Email Reminders | HIGH | MEDIUM | P1 |
| Configurable Reminder Schedule | HIGH | LOW | P1 |
| Dashboard Summary | HIGH | LOW | P1 |
| Stripe Subscription Billing | HIGH | MEDIUM | P1 |
| Client Directory | MEDIUM | LOW | P1 |
| Invoice Number Generation | MEDIUM | LOW | P1 |
| Reminder Send History | MEDIUM | LOW | P2 |
| Per-Invoice Reminder Override | MEDIUM | LOW | P2 |
| Aged Receivables Report | MEDIUM | MEDIUM | P2 |
| Invoice Search and Filter | MEDIUM | LOW | P2 |
| Customizable Email Templates | MEDIUM | MEDIUM | P2 |
| Google Login | LOW | LOW | P2 |
| CSV Export | LOW | MEDIUM | P2 |
| Client Payment Portal | HIGH | HIGH | P3 |
| WhatsApp Channel | HIGH | HIGH | P3 |
| Recurring Invoices | MEDIUM | HIGH | P3 |
| Online Payment Collection | HIGH | HIGH | P3 |
| Multi-User Team Accounts | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

Note: This analysis is based on training knowledge (pre-August 2025). Live verification was not available. Treat as MEDIUM confidence — useful for directional decisions but verify specific claims before marketing comparisons.

| Feature | FreshBooks | Invoice Ninja | Wave | Our Approach |
|---------|------------|---------------|------|--------------|
| Automated payment reminders | Yes (configurable schedule) | Yes (3 default intervals, customizable) | Yes (basic) | Yes — core value prop, make this exceptional |
| Reminder email customization | Yes (templates) | Yes (full template editor) | Limited | Start simple (merge fields), expand later |
| Client portal | Yes | Yes | Yes | Defer to v2 — high security surface |
| Online payment collection | Yes (Stripe, PayPal) | Yes (multiple gateways) | Yes (built-in) | Explicitly deferred — not our v1 scope |
| Recurring invoices | Yes | Yes | Yes | Explicitly deferred to v2+ |
| Multi-user / team access | Yes (tiered) | Yes | Limited | Explicitly out of scope for v1 |
| Mobile app | Yes (iOS + Android) | Yes | Yes | Web-only; responsive PWA is sufficient |
| Accounting integration | Yes (deep) | Partial | Yes (native accounting) | Not in scope — CSV export suffices |
| Invoice number series | Yes | Yes | Yes | Auto-increment per tenant, day one |
| Reminder send history | Yes (audit log) | Yes | Limited | P2 — add after core is working |
| WhatsApp reminders | No | No (plugin available) | No | Architecture ready, feature deferred |

**Key competitive gap to exploit:** Most tools treat payment reminders as a side feature attached to a larger invoicing/accounting product. This product goes deep on just the AR and reminder workflow — simpler onboarding, more opinionated reminder UX, and no accounting bloat.

---

## Sources

- Training knowledge covering FreshBooks, Invoice Ninja, Wave, Zoho Invoice, HoneyBook, Bonsai (as of Aug 2025) — MEDIUM confidence
- PROJECT.md requirements and constraints — HIGH confidence (primary spec)
- Industry convention for invoicing SaaS (invoice lifecycle, multi-tenancy patterns) — MEDIUM confidence
- Note: Live competitor verification via WebSearch and WebFetch was unavailable during this session. Recommend spot-checking competitor feature pages before marketing positioning decisions.

---
*Feature research for: Invoice tracking and automated payment reminder SaaS (multi-tenant)*
*Researched: 2026-03-16*
