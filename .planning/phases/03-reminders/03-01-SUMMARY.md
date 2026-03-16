---
phase: 3
plan: 1
subsystem: reminders
tags: [convex-scheduler, resend, email, settings]
dependency_graph:
  requires: [02-invoice-crud-dashboard]
  provides: [reminder-scheduling, reminder-email, settings-ui]
  affects: [invoices, tenants, dashboard]
tech_stack:
  added: [resend (via fetch), convex-scheduler]
  patterns: [internalAction, internalQuery, internalMutation, ctx.scheduler.runAt, ctx.scheduler.cancel]
key_files:
  created:
    - convex/reminders.ts
    - convex/tenants.ts
    - src/app/(dashboard)/settings/page.tsx
    - src/app/(dashboard)/settings/_components/SettingsContent.tsx
  modified:
    - convex/invoices.ts
    - src/app/(dashboard)/dashboard/_components/DashboardContent.tsx
    - package.json
decisions:
  - Used native fetch in Convex action instead of resend npm SDK — no SDK import needed, simpler dependency
  - scheduler.cancel() wrapped in try/catch per job — already-executed jobs throw, safe to ignore
  - Default reminder config [7,3,1] before and [1,3,7] after applied when no tenant config exists
metrics:
  duration: ~5 min
  completed: "2026-03-16"
  tasks_completed: 1
  files_created: 4
  files_modified: 3
---

# Phase 3 Plan 1: Automated Email Reminders and Settings Page Summary

**One-liner:** Convex scheduler triggers Resend email reminders before/after due dates with per-tenant configurable schedule and cancellation on paid.

## What Was Built

**Reminder engine (`convex/reminders.ts`):**
- `sendReminder` internalAction: fetches invoice, skips if paid/deleted, builds HTML email, posts to Resend API via `fetch`, logs result to `reminderLog` table
- `logReminder` internalMutation: writes sent/failed record with `resendMessageId` or `errorMessage`
- Email template generates subject + full HTML for three states: N days before, on due date, N days after (color-coded blue/amber/red)

**Tenant config (`convex/tenants.ts`):**
- `get` query: returns current tenant record for settings page
- `updateReminderConfig` mutation: patches `reminderConfig.daysBefore` / `daysAfter`
- `getByOwner` internalQuery: for internal use by other actions

**Invoice scheduling (`convex/invoices.ts` — full replacement):**
- `create`: after inserting, reads tenant reminderConfig (defaults to `[7,3,1]`/`[1,3,7]`), schedules one job per configured day via `ctx.scheduler.runAt`, stores all job IDs in `scheduledReminderIds`
- `markPaid`: cancels all scheduled jobs before patching status to paid
- `remove`: cancels all scheduled jobs before deleting
- `getById` internalQuery: added for use by `sendReminder` action

**Settings page (`/settings`):**
- Server page with Clerk auth guard
- `SettingsContent` client component: loads tenant config via `useQuery(api.tenants.get)`, lets user add/remove days-before and days-after tags, saves via `useMutation(api.tenants.updateReminderConfig)`
- Dashboard header updated with gear icon link to `/settings`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed invalid semver in package.json**
- **Found during:** Step 1 (npm install resend)
- **Issue:** `react` and `react-dom` were pinned as `"19.2.3"` without `^`, causing npm v11's arborist to throw `Invalid Version` when resolving the lock file
- **Fix:** Changed to `"^19.2.3"` and `"^19.2.3"` in package.json; added `resend` entry manually since `npm install` was still blocked by a pre-existing lock file integrity quirk with `@tailwindcss/oxide-freebsd-x64`
- **Files modified:** `package.json`
- **Note:** `reminders.ts` uses native `fetch` (not the resend npm SDK), so the resend package is a soft dependency only

**2. [Rule 1 - Bug] Fixed Tailwind class typo in SettingsContent**
- **Found during:** Step 6 (writing SettingsContent.tsx)
- **Issue:** `focus:ring-gray/900` written instead of `focus:ring-gray-900`
- **Fix:** Corrected inline before commit
- **Files modified:** `src/app/(dashboard)/settings/_components/SettingsContent.tsx`

## Post-Deployment Steps Required

The user must complete these steps before reminders will send:

1. Sign up at [resend.com](https://resend.com) and create an API key
2. In Convex Dashboard → Settings → Environment Variables, set:
   - `RESEND_API_KEY` = your Resend API key
   - `RESEND_FROM_EMAIL` = your verified sender email (optional — defaults to `onboarding@resend.dev` for testing)

## Self-Check: PASSED

- convex/reminders.ts: FOUND
- convex/tenants.ts: FOUND
- src/app/(dashboard)/settings/page.tsx: FOUND
- src/app/(dashboard)/settings/_components/SettingsContent.tsx: FOUND
- Commit 7af70e8: FOUND
- Build: PASSED (7 routes, 0 errors)
- Tests: PASSED (12/12)
