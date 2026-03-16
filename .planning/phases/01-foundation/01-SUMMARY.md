---
phase: 01
plan: "01-01 + 01-02 + 01-03"
subsystem: foundation
tags: [nextjs, convex, clerk, shadcn, vitest, auth, webhook]
dependency_graph:
  requires: []
  provides: [next-scaffold, convex-schema, clerk-auth, route-protection, webhook-handler]
  affects: [phase-02-invoices, phase-03-reminders, phase-04-billing]
tech_stack:
  added:
    - Next.js 16.1.6 (App Router, TypeScript, Tailwind v4, ESLint)
    - Convex 1.33.1
    - "@clerk/nextjs (Clerk auth)"
    - svix (webhook signature verification)
    - lucide-react, zod, date-fns
    - shadcn/ui v4 (button, card, input, label)
    - vitest 4.1.0 with @vitejs/plugin-react, @testing-library/react, jsdom
  patterns:
    - proxy.ts (not middleware.ts) for Next.js 16 route protection
    - ConvexProviderWithClerk wrapping auth providers in layout.tsx
    - internalMutation for Convex functions only callable server-side
    - "@ts-nocheck on convex/*.ts files until `npx convex dev` generates _generated/"
key_files:
  created:
    - src/proxy.ts
    - src/components/providers/ConvexClientProvider.tsx
    - src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
    - src/app/(dashboard)/dashboard/page.tsx
    - convex/schema.ts
    - convex/auth.config.ts
    - convex/users.ts
    - convex/http.ts
    - vitest.config.ts
    - tests/setup.ts
    - tests/schema.test.ts
    - tests/auth.test.ts
  modified:
    - src/app/layout.tsx
    - src/app/page.tsx
    - tsconfig.json
    - package.json
decisions:
  - "Used proxy.ts not middleware.ts for Next.js 16 Clerk route protection"
  - "Added @ts-nocheck to convex/*.ts files — _generated/ types require `npx convex dev` to generate"
  - "Excluded tests/, convex/, vitest.config.ts from Next.js tsconfig to prevent build failures from vitest globals"
  - "Used cp workaround to scaffold Next.js into capitalized InvoiceTracker/ dir (npm forbids uppercase names)"
metrics:
  duration: "29 minutes"
  completed_date: "2026-03-16"
  tasks_completed: 3
  files_created: 13
  files_modified: 4
  tests_passing: 12
---

# Phase 1 Plans 01-01 + 01-02 + 01-03: Foundation Summary

**One-liner:** Next.js 16 scaffold with Convex schema (tenants/invoices/reminderLog), Clerk auth via clerkMiddleware in proxy.ts, Svix-verified webhook handler auto-provisioning tenant rows on user.created events.

## What Was Built

### Plan 01-01: Next.js 16 Scaffold + Dependencies

- Scaffolded Next.js 16.1.6 with TypeScript, Tailwind v4, ESLint, App Router, src/ directory
- Installed all production and dev dependencies in a single pass
- Initialized shadcn/ui v4 with button, card, input, label components
- Created vitest 4.1.0 config with jsdom environment, globals, and @/ alias
- Created test stubs (schema.test.ts, auth.test.ts) that validate subsequent plans' outputs

### Plan 01-02: Convex Schema + Auth Helpers

- `convex/schema.ts`: Four tables — tenants, invoices, reminderLog, processedWebhooks — with composite indexes (by_owner, by_owner_status, by_stripe_event_id)
- `convex/auth.config.ts`: Clerk JWT provider config using CLERK_JWT_ISSUER_DOMAIN env var
- `convex/users.ts`: `getCurrentUserId` throws on null identity (no degraded unauthenticated access); `upsertFromClerk` as `internalMutation` (not publicly callable via HTTP)

### Plan 01-03: Route Protection + Auth Pages + Webhook Handler

- `src/proxy.ts`: clerkMiddleware protecting all routes except /, /sign-in, /sign-up, /api/webhooks
- ConvexClientProvider wraps children with ConvexProviderWithClerk + Clerk's useAuth
- layout.tsx: ClerkProvider > ConvexClientProvider provider chain
- Auth pages at (auth)/sign-in/[[...sign-in]] and (auth)/sign-up/[[...sign-up]] using Clerk components
- Dashboard stub at (dashboard)/dashboard/page.tsx (server-side auth guard)
- `convex/http.ts`: Svix-verified Clerk webhook at /clerk-users-webhook, handles user.created and user.updated, calls upsertFromClerk as internalMutation

## Verification Results

- All 12 vitest tests pass (schema.test.ts: 4/4, auth.test.ts: 8/8)
- `npm run build` succeeds — 5 routes compiled (/, /dashboard, /sign-in, /sign-up, /_not-found)
- Route table shows ƒ (dynamic) for all auth-protected routes and Proxy (Middleware) for proxy.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next.js binary broken after cp from temp directory**
- **Found during:** Plan 01-03 (npm run build)
- **Issue:** `cp -r` copied the temp `create-next-app` directory including a non-symlink `.bin/next` script with relative path references that resolved to non-existent `node_modules/server/` — causing "Cannot find module '../server/require-hook'" at runtime
- **Fix:** Deleted the broken `.bin/next` file, ran `npm install next@16.1.6` which recreated it as a proper symlink to `../next/dist/bin/next`
- **Files modified:** node_modules/.bin/next (symlink restored)

**2. [Rule 3 - Blocking] Next.js TypeScript build failing on vitest globals in tests/**
- **Found during:** Plan 01-03 (npm run build)
- **Issue:** `tsconfig.json` included `**/*.ts` which pulled in `tests/setup.ts` — `beforeAll`/`afterAll` globals from vitest are not in scope for Next.js TypeScript compilation
- **Fix:** Added `"tests"`, `"convex"`, `"vitest.config.ts"` to `tsconfig.json` exclude array. The convex/ directory uses `_generated/` types that don't exist pre-`npx convex dev`, so excluding it prevents spurious type errors.
- **Files modified:** tsconfig.json

**3. [Rule 1 - Workaround] create-next-app rejected capitalized directory name**
- **Found during:** Plan 01-01 (scaffolding)
- **Issue:** `npx create-next-app@latest .` fails when the directory is named "InvoiceTracker" — npm naming restrictions forbid uppercase. The plan assumed scaffolding directly into the dir would work.
- **Fix:** Scaffolded into a temp `invoice-tracker-temp` directory, copied all files into `InvoiceTracker/`, deleted temp dir, renamed package.json `name` field to `invoice-tracker`.
- **Files modified:** package.json (name field)

## What's Needed Before Phase 2

1. **`npx convex dev`** — must be run to generate `convex/_generated/` types; remove `@ts-nocheck` from `convex/users.ts` and `convex/http.ts` after
2. **Convex environment variables** — set `CLERK_JWT_ISSUER_DOMAIN` and `CLERK_WEBHOOK_SECRET` in Convex dashboard
3. **`.env.local`** — replace `NEXT_PUBLIC_CONVEX_URL=https://placeholder.convex.cloud` with real deployment URL from `npx convex dev`
4. **Clerk webhook** — register `https://<deployment>.convex.site/clerk-users-webhook` in Clerk dashboard, subscribe to user.created and user.updated

## Self-Check: PASSED

All key files confirmed present. All three task commits verified in git log (5d6cebf, 402057c, fd7dd44).
