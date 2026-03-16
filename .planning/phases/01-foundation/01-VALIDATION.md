---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via Next.js 16 default test setup) |
| **Config file** | `vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01-01 | 1 | AUTH-01 | smoke | `npx convex dev --once` (exits 0) | ❌ W0 | ⬜ pending |
| 1-01-02 | 01-02 | 1 | AUTH-01 | unit | `npx vitest run convex/schema` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01-03 | 2 | AUTH-01, AUTH-02 | integration | `npx vitest run auth` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — vitest configuration for Next.js 16 app router
- [ ] `tests/setup.ts` — shared test setup / mocks for Convex + Clerk
- [ ] `tests/schema.test.ts` — stub tests for schema shape validation
- [ ] `tests/auth.test.ts` — stub tests for auth flow and tenant isolation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clerk signup flow renders correctly | AUTH-01 | UI/browser interaction required | Open app, click Sign Up, complete Clerk hosted signup, verify redirect to /dashboard |
| Session persists across refresh | AUTH-02 | Browser session state | Sign in, refresh page (F5), verify still authenticated without redirect |
| Two accounts see isolated data | AUTH-01, AUTH-02 | Requires two separate authenticated sessions | Create account A + account B; sign in as A, create data; sign in as B, verify data not visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
