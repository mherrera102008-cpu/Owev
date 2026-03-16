# Requirements: InvoiceTracker

**Defined:** 2026-03-16
**Core Value:** Businesses stop losing money to forgotten follow-ups — the system automatically tracks every invoice and sends reminders at the right time, so getting paid becomes passive instead of manual.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can sign up with email and password via Clerk
- [x] **AUTH-02**: User session persists across browser refresh

### Invoices

- [ ] **INV-01**: User can create an invoice with client name, client email, amount, and due date
- [ ] **INV-02**: Invoice status automatically transitions: upcoming → due → overdue based on due date
- [ ] **INV-03**: User can mark an invoice as paid with one click
- [ ] **INV-04**: User can add notes/description to an invoice

### Reminders

- [ ] **REM-01**: System automatically sends email reminders on a configurable schedule (before/on/after due date)
- [ ] **REM-02**: User can configure their reminder schedule preferences
- [ ] **REM-03**: User can pause or skip reminders for a specific invoice

### Dashboard

- [ ] **DASH-01**: Dashboard shows total invoices, overdue count, and total unpaid amount
- [ ] **DASH-02**: User can view and filter invoice list by status and date
- [ ] **DASH-03**: Dashboard shows aged receivables breakdown (30/60/90 days overdue)

### Billing

- [ ] **BILL-01**: Stripe subscription required to use the platform
- [ ] **BILL-02**: New accounts start on a free trial before billing begins

### Profile

- [ ] **PROF-01**: User can set their business name
- [ ] **PROF-02**: User can set a sender email/reply-to address for reminder emails
- [ ] **PROF-03**: User can upload a logo for branding in reminder emails

## v2 Requirements

### Authentication

- **AUTH-03**: User can log in with Google OAuth

### Billing

- **BILL-03**: User can upgrade or downgrade between subscription plans (multiple tiers)

### Reminders

- **REM-04**: WhatsApp reminders via Business API (deferred — see PROJECT.md)

### Dashboard

- **DASH-04**: CSV export of invoice data

## Out of Scope

| Feature | Reason |
|---------|--------|
| WhatsApp Business API | Explicitly deferred to future milestone — setup complexity, focus on email first |
| Mobile app | Web-first — mobile deferred |
| Multi-user teams | Single owner account per tenant for v1 — team features add auth complexity |
| Online payment collection | PCI compliance and dispute handling scope — defer to v2+ |
| Client payment portal | Dependent on online payment collection — deferred with it |
| Invoice PDF generation | Nice-to-have, not core to reminder value prop |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| INV-01 | Phase 2 | Pending |
| INV-02 | Phase 2 | Pending |
| INV-03 | Phase 2 | Pending |
| INV-04 | Phase 2 | Pending |
| DASH-01 | Phase 2 | Pending |
| DASH-02 | Phase 2 | Pending |
| REM-01 | Phase 3 | Pending |
| REM-02 | Phase 3 | Pending |
| REM-03 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| BILL-01 | Phase 4 | Pending |
| BILL-02 | Phase 4 | Pending |
| PROF-01 | Phase 4 | Pending |
| PROF-02 | Phase 4 | Pending |
| PROF-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after initial definition*
