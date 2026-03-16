# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** Businesses stop losing money to forgotten follow-ups — the system automatically tracks every invoice and sends reminders at the right time, so getting paid becomes passive instead of manual.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 4 (Foundation)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-03-16 — Roadmap created, project initialized

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Stack confirmed — Next.js 16, Convex, Clerk, Stripe, Resend, Tailwind v4, shadcn/ui
- [Init]: `middleware.ts` replaced by `proxy.ts` in Next.js 16 — use proxy.ts for route protection
- [Init]: Never accept `userId` in Convex mutation args — always use `ctx.auth.getUserIdentity().subject`
- [Init]: Reminder dispatcher designed as strategy pattern from Phase 3 to unblock WhatsApp channel later

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3]: Validate Convex `ctx.scheduler.cancel()` signature against current docs before implementation
- [Phase 3]: Confirm Convex action-from-mutation constraint still holds in Convex 1.33.1
- [Phase 3]: Confirm Resend SDK v6 constructor and `emails.send()` shape before implementation

## Session Continuity

Last session: 2026-03-16
Stopped at: Roadmap created — ready to plan Phase 1
Resume file: None
