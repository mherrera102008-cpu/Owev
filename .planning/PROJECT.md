# nvoiceTracker

## What This Is

nvoiceTracker is a multi-tenant SaaS platform that helps small businesses and agencies track unpaid invoices and automatically remind clients to pay. Businesses sign up, add their invoices, and the system handles the follow-up — sending scheduled email reminders before and after due dates so owners never have to chase payments manually again.

## Core Value

Businesses stop losing money to forgotten follow-ups: the system automatically tracks every invoice and sends reminders at the right time, so getting paid becomes passive instead of manual.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User (business owner) can sign up and log in to their own account
- [ ] Each business's data is isolated from other tenants
- [ ] User can add an invoice with client name, email, amount, and due date
- [ ] Invoice statuses automatically update: upcoming → due → overdue
- [ ] User can mark an invoice as paid with one click
- [ ] System automatically sends email reminders based on configurable schedule (e.g. 1 day before, on due date, when overdue)
- [ ] Dashboard shows total invoices, overdue count, and total unpaid amount
- [ ] User can configure their reminder schedule preferences
- [ ] Subscription billing via Stripe — businesses pay to use the platform

### Out of Scope

- WhatsApp Business API integration — explicitly deferred to a future milestone
- Mobile app — web-first
- Multi-user teams per business — single owner account per tenant for v1

## Context

- Target users: small businesses and agencies currently managing invoices via spreadsheets or basic tools
- Pain point: manually checking due dates and writing individual reminder emails is repetitive and leads to forgotten payments
- Email reminders sent via third-party service (SendGrid or Resend)
- The product is designed to feel simple and fast — not enterprise-heavy
- WhatsApp integration was discussed but explicitly deferred; the architecture should not block it being added later

## Constraints

- **Email delivery**: Must use a third-party transactional email provider (SendGrid or Resend) — not SMTP/Gmail
- **Multi-tenancy**: Full data isolation between tenants is required from the start
- **Billing**: Stripe subscription required before launch — not optional for v1
- **Simplicity**: UI should be clean and fast; avoid over-engineering the feature set

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-tenant SaaS (not single-business) | Product built for many businesses to use, not an internal tool | — Pending |
| Stripe subscription billing in v1 | Monetization is part of the initial product, not a later addition | — Pending |
| WhatsApp deferred | Business API setup complexity — focus on email reminders first | — Pending |
| Third-party email (SendGrid/Resend) | Reliable delivery, avoids SMTP rate limits | — Pending |

---
*Last updated: 2026-03-16 after initialization*
