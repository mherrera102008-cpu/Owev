# Phase 1: Foundation - Research

**Researched:** 2026-03-16
**Domain:** Next.js 16 + Convex + Clerk integration, multi-tenant schema, route protection
**Confidence:** HIGH — key questions verified against official Next.js docs, Clerk docs, Convex docs, and npm registry

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign up with email and password via Clerk | Clerk sign-up flow, ClerkProvider setup, proxy.ts route protection, Clerk JWT template for Convex |
| AUTH-02 | User session persists across browser refresh | ConvexProviderWithClerk handles token refresh automatically; Clerk session cookies persist across refresh |
</phase_requirements>

---

## Summary

Phase 1 establishes everything that every subsequent phase depends on: the Next.js 16 scaffold with App Router, Convex backend with full schema and indexes, Clerk authentication wired to Convex JWT validation, and the canonical `getCurrentUserId` helper that enforces multi-tenant isolation. There is no output the user can see except a working sign-up/sign-in flow and a protected dashboard page — but all four later phases run on the foundation laid here.

The most critical question flagged in STACK.md — "does Next.js 16 use `proxy.ts` or `middleware.ts`?" — is now definitively answered. Official Next.js 16 docs confirm `middleware.ts` is deprecated and renamed to `proxy.ts`; the exported function is renamed from `middleware` to `proxy`. Clerk's `clerkMiddleware()` works identically in `proxy.ts` — only the filename and function name change. This is a clean, verified answer with zero ambiguity.

The Convex + Clerk integration pattern is stable and well-documented. Configuration requires: (1) a JWT Template named exactly `convex` in the Clerk dashboard, (2) `convex/auth.config.ts` pointing at the Clerk issuer domain, (3) `CLERK_JWT_ISSUER_DOMAIN` env var on the Convex dashboard. The `ConvexProviderWithClerk` component from `convex/react-clerk` handles token refresh automatically, satisfying AUTH-02 without any custom session management code.

The tenant isolation model uses `identity.subject` (the Clerk user ID) as `ownerId` on every tenant-scoped table. This must be established in `convex/schema.ts` before any data is written — retrofitting indexes onto a populated collection requires a migration. The `getCurrentUserId` helper is a one-file, reusable guard that prevents the most severe security pitfall in this stack.

**Primary recommendation:** Scaffold fresh with `create-next-app@latest`, run `npx convex dev` and `npx shadcn@latest init` immediately after — these three commands wire up 90% of the configuration automatically. Do not configure Tailwind, Convex URL, or shadcn manually.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | App Router, RSC, Turbopack, proxy.ts | Latest stable; `create-next-app` targets it by default |
| react / react-dom | 19.2.4 | UI rendering | Required peer dep of Next.js 16 |
| convex | 1.33.1 | Database, server functions, scheduler, real-time | Ships `convex/react-clerk` and `convex/nextjs` exports; no adapter needed |
| @clerk/nextjs | 7.0.4 | Auth, session, JWT issuance | Verified peer dep: `next@^16.1.0-0`; `clerkMiddleware()` works in proxy.ts unchanged |
| tailwindcss | 4.2.1 | CSS utility layer | Installed by `create-next-app`; CSS-first config, no `tailwind.config.js` |
| typescript | 5.9.3 | Type safety | Next.js 16 default |

### Supporting (Phase 1 only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| svix | 1.88.0 | Clerk webhook signature verification | Required in `convex/http.ts` to verify `user.created` events |
| lucide-react | 0.577.0 | Icons | Used in any shadcn/ui component you add (Button, etc.) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `proxy.ts` | `middleware.ts` | `middleware.ts` is deprecated in Next.js 16; `proxy.ts` is the only correct choice |
| `identity.subject` as ownerId | `identity.tokenIdentifier` | `tokenIdentifier` is `subject + issuer` (globally unique across providers); use `subject` for single-provider v1, upgrade to `tokenIdentifier` if adding OAuth providers later |
| Clerk webhook for user sync | Client-side upsert in `ConvexClientProvider` | Webhook is the more reliable pattern; client-side upsert can miss edge cases (SSO, admin-created accounts) |

**Installation:**

```bash
# Step 1: Scaffold (handles Next.js, TypeScript, Tailwind v4, ESLint, App Router)
npx create-next-app@latest invoicetracker --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd invoicetracker

# Step 2: Initialize Convex (creates convex/ dir, writes NEXT_PUBLIC_CONVEX_URL to .env.local)
npm install convex
npx convex dev  # runs interactively; log in with GitHub

# Step 3: Add Clerk
npm install @clerk/nextjs svix

# Step 4: Initialize shadcn/ui (run AFTER convex dev has written .env.local)
npx shadcn@latest init
# Accept defaults: style = new-york, base color = neutral, CSS variables = yes

# Step 5: Add any Phase 1 UI components needed
npx shadcn@latest add button card input label
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/               # Clerk auth pages (sign-in, sign-up)
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx
│   │   └── sign-up/
│   │       └── [[...sign-up]]/
│   │           └── page.tsx
│   ├── (dashboard)/          # Protected tenant routes
│   │   └── dashboard/
│   │       └── page.tsx
│   ├── layout.tsx            # ClerkProvider > ConvexClientProvider
│   └── page.tsx              # Root redirect (to /dashboard or /sign-in)
│
├── components/
│   ├── providers/
│   │   └── ConvexClientProvider.tsx   # 'use client' wrapper for ConvexProviderWithClerk
│   └── ui/                   # shadcn/ui components (copied in by CLI)
│
└── lib/
    └── utils.ts              # shadcn cn() helper (auto-generated by init)

convex/                       # At project ROOT, not inside src/
├── schema.ts                 # All tables + indexes (must exist before any data write)
├── auth.config.ts            # Clerk JWT issuer domain configuration
├── http.ts                   # Clerk user.created webhook handler
├── users.ts                  # upsertFromClerk / getCurrentUserOrThrow helpers
└── _generated/               # Auto-generated (do not edit)

proxy.ts                      # At src/ root (or project root if no src/)
                              # Exports: clerkMiddleware() as default + config matcher
```

### Pattern 1: proxy.ts with clerkMiddleware

**What:** Route protection via Clerk's middleware-equivalent. All dashboard routes require authentication; all auth routes are public. In Next.js 16, the file is `proxy.ts` and the config exports match the proxy convention.

**When to use:** All route-level auth gating. Every request to a protected route goes through this before rendering.

```typescript
// src/proxy.ts
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
//         https://clerk.com/docs/nextjs/getting-started/quickstart
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',   // Webhook routes must be public
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();   // Redirects to /sign-in if unauthenticated
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

### Pattern 2: ConvexClientProvider (client wrapper)

**What:** `ConvexProviderWithClerk` must be in a Client Component because it uses `useAuth()`. `app/layout.tsx` is a Server Component and cannot import it directly. A thin wrapper solves this.

**When to use:** Always — this is the mandatory pattern for Next.js App Router + Convex + Clerk.

```typescript
// src/components/providers/ConvexClientProvider.tsx
// Source: https://clerk.com/docs/guides/development/integrations/databases/convex
'use client';
import { ReactNode } from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/nextjs';

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error('Missing NEXT_PUBLIC_CONVEX_URL in .env.local');
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
```

```typescript
// src/app/layout.tsx (Server Component)
import { ClerkProvider } from '@clerk/nextjs';
import ConvexClientProvider from '@/components/providers/ConvexClientProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
// CRITICAL: ClerkProvider WRAPS ConvexClientProvider, never the reverse.
// Convex needs access to Clerk context; reversing breaks auth token delivery.
```

### Pattern 3: convex/auth.config.ts — Clerk JWT configuration

**What:** Tells Convex which JWT issuer to trust. Convex validates every request's JWT against this config.

**When to use:** Required before any authenticated Convex function works. Written once per project.

```typescript
// convex/auth.config.ts
// Source: https://docs.convex.dev/auth/clerk
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",  // MUST match JWT template name in Clerk dashboard
    },
  ],
} satisfies AuthConfig;
```

### Pattern 4: Convex schema with by_owner indexes

**What:** All tenant-scoped tables define `ownerId: v.string()` (Clerk user ID) and a `.index("by_owner", ["ownerId"])`. The `tenants` table also gets `by_stripe_customer` for Phase 4 webhooks. Indexes must exist before any data is written.

**When to use:** Every table that holds per-tenant data. No exceptions.

```typescript
// convex/schema.ts
// Source: https://docs.convex.dev/database/reading-data/indexes (verified pattern)
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tenant profile — one row per user, created on first login via webhook
  tenants: defineTable({
    ownerId: v.string(),                  // Clerk userId (identity.subject)
    clerkId: v.string(),                  // Same as ownerId; alias for clarity
    email: v.optional(v.string()),
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
      daysBefore: v.array(v.number()),    // e.g. [7, 3, 1]
      daysAfter: v.array(v.number()),     // e.g. [1, 3, 7, 14]
    }),
    createdAt: v.number(),                // Unix timestamp
  })
    .index("by_owner", ["ownerId"])
    .index("by_stripe_customer", ["stripeCustomerId"]), // Phase 4: webhook → tenant lookup

  // Invoices — defined in schema now, data written in Phase 2
  invoices: defineTable({
    ownerId: v.string(),                  // Clerk userId — tenant key
    clientName: v.string(),
    clientEmail: v.string(),
    amount: v.number(),
    dueDate: v.number(),                  // Unix timestamp
    status: v.union(
      v.literal("upcoming"),
      v.literal("due"),
      v.literal("overdue"),
      v.literal("paid")
    ),
    description: v.optional(v.string()),
    scheduledReminderIds: v.optional(v.array(v.id("_scheduled_functions"))),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_status", ["ownerId", "status"]),   // Phase 3: reminder dispatch filter
});
```

### Pattern 5: getCurrentUserId helper

**What:** A single canonical function that extracts and validates `ctx.auth.getUserIdentity()`. Every query and mutation that touches tenant data calls this. Never inline identity extraction.

**When to use:** At the top of every Convex query/mutation that reads or writes tenant-scoped data. Must be the first thing called.

```typescript
// convex/users.ts
// Source: https://docs.convex.dev/auth/functions-auth (pattern from official docs)
import { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Returns the Clerk userId (identity.subject) for the authenticated caller.
 * Throws if no valid Clerk JWT is present on the request.
 * Use this as the first line of every tenant-scoped query/mutation.
 */
export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: valid Clerk session required");
  }
  return identity.subject;  // Clerk userId — the tenant key
}
```

Usage in a query:

```typescript
// convex/invoices.ts (Phase 2 — schema defined now, queries written in Phase 2)
import { query } from "./_generated/server";
import { getCurrentUserId } from "./users";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await getCurrentUserId(ctx);
    return ctx.db
      .query("invoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
  },
});
```

### Pattern 6: Clerk webhook — user.created → Convex HTTP action

**What:** When a user signs up in Clerk, Clerk sends a `user.created` webhook to a Convex HTTP endpoint. The handler verifies the Svix signature and upserts a tenant document.

**When to use:** Required so every authenticated Convex call can find a tenant document. Without this, `getCurrentUserId` returns a userId but the `tenants` table has no corresponding row.

```typescript
// convex/http.ts
// Source: https://clerk.com/blog/webhooks-data-sync-convex (verified pattern)
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("CLERK_WEBHOOK_SECRET not set in Convex env vars");
    }

    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing Svix headers", { status: 400 });
    }

    const payloadString = await request.text();
    const wh = new Webhook(webhookSecret);
    let event: WebhookEvent;

    try {
      event = wh.verify(payloadString, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as WebhookEvent;
    } catch {
      return new Response("Invalid Svix signature", { status: 400 });
    }

    switch (event.type) {
      case "user.created":
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          clerkId: event.data.id,
          email: event.data.email_addresses[0]?.email_address,
        });
        break;
      default:
        // Ignore other event types
        break;
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
```

```typescript
// convex/users.ts — upsert mutation (internal — not callable from client)
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, email }) => {
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_owner", (q) => q.eq("ownerId", clerkId))
      .first();

    if (!existing) {
      await ctx.db.insert("tenants", {
        ownerId: clerkId,
        clerkId,
        email,
        subscriptionStatus: "none",
        reminderConfig: {
          daysBefore: [7, 3, 1],
          daysAfter: [1, 3, 7],
        },
        createdAt: Date.now(),
      });
    } else if (email && existing.email !== email) {
      await ctx.db.patch(existing._id, { email });
    }
  },
});
```

### Anti-Patterns to Avoid

- **Exporting `middleware` from `proxy.ts`:** The function name must be `proxy` (or a default export). Exporting `middleware` may still work with backward-compat shims but is not the Next.js 16 convention.
- **Putting `ClerkProvider` inside `ConvexClientProvider`:** Convex needs Clerk context; reversing the nesting silently breaks JWT delivery.
- **Placing `convex/` folder inside `src/`:** The Convex CLI expects the `convex/` directory at the project root level. Nesting it breaks CLI commands and code generation.
- **Importing `convex/react-clerk` in a Server Component:** `ConvexProviderWithClerk` uses `useAuth()` which is a client hook. Always wrap it in a `'use client'` component.
- **Setting `CLERK_JWT_ISSUER_DOMAIN` in Next.js `.env.local` only:** This var must be set in the Convex dashboard for your deployment — Convex functions read it from Convex env vars, not from Next.js env.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session management | Custom JWT cookies, session store | Clerk + `ConvexProviderWithClerk` | Token refresh, expiry, multi-tab sync — handled automatically |
| Route protection | Custom redirect logic in every layout | `clerkMiddleware()` + `createRouteMatcher()` in `proxy.ts` | Edge-deployed, runs before rendering, handles all cases |
| Webhook signature verification | Manual HMAC implementation | `svix` npm package (`Webhook.verify()`) | Clerk signs webhooks via Svix; their library handles replay attacks, timestamp validation |
| Convex URL injection | Manually setting `NEXT_PUBLIC_CONVEX_URL` | `npx convex dev` | CLI auto-writes to `.env.local` with the correct dev deployment URL |
| shadcn/ui CSS variable setup | Manually writing CSS tokens | `npx shadcn@latest init` | Sets up `globals.css`, `@theme inline` block, and `components.json` correctly for Tailwind v4 |

**Key insight:** The three CLI commands (`npx convex dev`, `npx shadcn@latest init`, `clerkMiddleware()`) each automate a full integration that would otherwise take hours to configure manually. Let them do the work.

---

## Common Pitfalls

### Pitfall 1: JWT Template Name Must Be "convex" (Exactly)

**What goes wrong:** Developer creates a Clerk JWT template with a name like "Convex" (capital C) or "convex-jwt". The `ConvexProviderWithClerk` component fetches the token by calling `getToken({ template: "convex" })` hardcoded. Any mismatch results in silent auth failure — all `useQuery` calls return `undefined`, no errors thrown.

**Why it happens:** The Clerk dashboard lets you name templates freely. The requirement for lowercase `"convex"` is buried in Convex's integration guide.

**How to avoid:** In Clerk Dashboard → JWT Templates, create a template named exactly `convex` (lowercase, no spaces). Copy the Issuer URL from this template screen — it is distinct from your regular Clerk domain.

**Warning signs:** `useQuery` hooks return undefined; `ctx.auth.getUserIdentity()` returns null despite user being logged in.

### Pitfall 2: CLERK_JWT_ISSUER_DOMAIN Set in Wrong Place

**What goes wrong:** Developer puts `CLERK_JWT_ISSUER_DOMAIN` in `.env.local` only. Next.js reads it in the browser bundle but Convex functions do not have access to Next.js environment variables. Convex's `auth.config.ts` reads `process.env.CLERK_JWT_ISSUER_DOMAIN` at deploy time from the Convex dashboard environment variable settings — not from the Next.js project.

**Why it happens:** Developers expect all env vars to come from `.env.local`.

**How to avoid:** Set `CLERK_JWT_ISSUER_DOMAIN` in two places: `.env.local` (for local dev reference) AND in the Convex dashboard under Settings → Environment Variables for both dev and prod deployments. Run `npx convex dev` after setting it.

### Pitfall 3: Missing by_owner Index on tenants Table

**What goes wrong:** The `upsertFromClerk` webhook handler queries `tenants` by `ownerId` to check for duplicates. Without the `.index("by_owner", ["ownerId"])` in the schema, this is a full collection scan on every user.created event and on every authenticated request.

**Why it happens:** Easy to add the table definition and forget the index.

**How to avoid:** Define the index in `schema.ts` before running `npx convex dev` for the first time. The schema is deployed when `convex dev` starts.

### Pitfall 4: Webhook Endpoint URL Uses Wrong Domain (.cloud vs .site)

**What goes wrong:** Developer copies the Convex deployment URL (ends in `.convex.cloud`) and uses it as the Clerk webhook endpoint. HTTP actions are served on the `.convex.site` domain, not `.convex.cloud`. Clerk's webhook deliveries fail silently or return 404.

**Why it happens:** The Convex dashboard shows the `.cloud` URL prominently for client connections. The `.site` URL for HTTP actions is a distinct subdomain.

**How to avoid:** In the Clerk dashboard webhook endpoint URL, use `https://<your-deployment>.convex.site/clerk-users-webhook` — note `.site` not `.cloud`. The deployment name is the same.

### Pitfall 5: proxy.ts Not at the Correct Level

**What goes wrong:** Developer creates `src/app/proxy.ts` instead of `src/proxy.ts`. Next.js does not pick up the file as route protection middleware. All routes become publicly accessible.

**Why it happens:** The file needs to be at the same level as the `app/` or `pages/` directory, not inside it.

**How to avoid:** With `src/` structure: place `proxy.ts` at `src/proxy.ts`. Without `src/`: place it at project root `proxy.ts`. Verify by checking `npx next build` output for proxy compilation messages.

### Pitfall 6: shadcn/ui Init Validation Failure on Tailwind v4

**What goes wrong:** Running `npx shadcn@latest init` on a fresh `create-next-app` scaffold (which uses Tailwind v4) may throw a validation error because shadcn's init detects missing `tailwind.config.js` (removed in v4's CSS-first approach).

**Why it happens:** A shadcn CLI validation bug that checks for the v3 config file.

**How to avoid:** If validation fails, run `npx shadcn@latest init` with `--legacy-peer-deps` if on npm, or use `npx shadcn@latest init -d` (default answers) to bypass interactive prompts. The init still completes successfully and generates correct Tailwind v4-compatible output. Alternatively, check shadcn GitHub issues for the current recommended workaround as this is an active area.

---

## Code Examples

### Full proxy.ts for Phase 1

```typescript
// src/proxy.ts
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy (official)
//         https://clerk.com/docs/nextjs/getting-started/quickstart (official)
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',                          // Landing page (if exists)
  '/sign-in(.*)',               // Clerk hosted sign-in
  '/sign-up(.*)',               // Clerk hosted sign-up
  '/api/webhooks(.*)',          // Stripe + Clerk webhooks — must be public
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

### Clerk sign-in/sign-up pages (catch-all routes)

```typescript
// src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
// Source: Clerk Next.js quickstart
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

```typescript
// src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

### Dashboard page — authenticated access gate

```typescript
// src/app/(dashboard)/dashboard/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');   // Belt-and-suspenders; proxy.ts handles this too

  return (
    <main>
      <h1>Dashboard</h1>
      {/* Invoice UI — Phase 2 */}
    </main>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` + `export function middleware()` | `proxy.ts` + `export function proxy()` or `export default clerkMiddleware()` | Next.js v16.0.0 | File rename required; codemod available (`npx @next/codemod@canary middleware-to-proxy .`) |
| `tailwind.config.js` with content paths | CSS-first `@theme` in `globals.css`, no config file | Tailwind v4 (2025) | No config file; `npx shadcn@latest init` handles setup |
| `tailwindcss-animate` plugin | `tw-animate-css` package | shadcn/ui Tailwind v4 support (2025) | Replace `@plugin 'tailwindcss-animate'` with `@import "tw-animate-css"` |
| `@clerk/nextjs` v5/v6 peer dep `next@^14 \|\| ^15` | `@clerk/nextjs` v7.0.4 peer dep `next@^16.1.0-0` | Clerk v7 (2025/2026) | v7 is required for Next.js 16; do not use v6 |

**Deprecated/outdated:**
- `middleware.ts`: deprecated in Next.js 16. Do not create this file in a new Next.js 16 project.
- `middleware` named export: renamed to `proxy` (or use `export default clerkMiddleware()`).
- `tailwind.config.js`: not needed in Tailwind v4. `create-next-app` with Tailwind v4 does not generate one.
- `npx shadcn-ui@latest`: old CLI name. Use `npx shadcn@latest` (without the `-ui` suffix).

---

## Open Questions

1. **Clerk `clerkMiddleware()` export style in proxy.ts**
   - What we know: Clerk docs show `export default clerkMiddleware()`. Next.js proxy.ts docs show `export function proxy()` as the named export pattern.
   - What's unclear: Does Clerk's default export work exactly as before in proxy.ts, or does it need to be wrapped as `export function proxy() { return clerkMiddleware()(...) }`?
   - Recommendation: Use `export default clerkMiddleware()` — this is what Clerk's quickstart shows and it is compatible with proxy.ts's support for default exports. The Next.js proxy.ts docs explicitly support default exports. Verify first run works; if auth fails, wrap in a named `proxy` export.

2. **`identity.subject` vs `identity.tokenIdentifier` for ownerId**
   - What we know: `subject` is the Clerk userId string. `tokenIdentifier` is `subject + ":" + issuer` (globally unique across providers). Convex docs recommend `tokenIdentifier` for uniqueness.
   - What's unclear: Using `tokenIdentifier` as `ownerId` changes the field value format. If we switch to OAuth in Phase 5, migration is simpler with `tokenIdentifier`.
   - Recommendation: Use `identity.subject` for v1 (it equals the Clerk userId, making debugging easier). Document in code that migration to `tokenIdentifier` is needed if multi-provider auth is added.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — Wave 0 must install |
| Config file | None — Wave 0 creates `jest.config.ts` or equivalent |
| Quick run command | `npx jest --testPathPattern="auth"` (after Wave 0 setup) |
| Full suite command | `npx jest` |

Note: Phase 1 is a scaffold phase. Most verification is manual (browser-based) because the testable behaviors (sign-up, session persistence, route protection, tenant isolation) require a running Clerk + Convex environment. Unit tests can cover `getCurrentUserId` helper and schema validation logic.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | User can sign up with email/password via Clerk | smoke | Manual: browser sign-up flow | N/A |
| AUTH-01 | `clerkMiddleware()` redirects unauthenticated requests | unit | `npx jest tests/proxy.test.ts -x` | Wave 0 |
| AUTH-02 | Session persists across browser refresh | smoke | Manual: refresh browser after login | N/A |
| AUTH-02 | `ConvexProviderWithClerk` re-fetches token on expiry | integration | Covered by Clerk SDK — no custom test needed | N/A |
| (implicit) | Cross-tenant query isolation | integration | `npx jest tests/tenantIsolation.test.ts -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** Manual browser smoke test (sign-up, dashboard access, unauthenticated redirect)
- **Per wave merge:** Full jest suite green + browser smoke
- **Phase gate:** All 4 success criteria verified manually before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/proxy.test.ts` — covers AUTH-01 redirect behavior using `unstable_doesProxyMatch` from `next/experimental/testing/server`
- [ ] `tests/tenantIsolation.test.ts` — covers cross-tenant query isolation (create two users, query as one, assert other's data not visible)
- [ ] `jest.config.ts` and `jest.setup.ts` — test infrastructure
- [ ] Framework install: `npm install -D jest @types/jest ts-jest jest-environment-node`

---

## Environment Variables Reference

### Next.js `.env.local` (frontend + server components)

| Variable | Set By | Purpose |
|----------|--------|---------|
| `CONVEX_DEPLOYMENT` | `npx convex dev` (automatic) | Identifies dev deployment |
| `NEXT_PUBLIC_CONVEX_URL` | `npx convex dev` (automatic) | Convex WebSocket endpoint for `ConvexReactClient` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Manual — Clerk Dashboard → API Keys | Clerk public key for browser SDK |
| `CLERK_SECRET_KEY` | Manual — Clerk Dashboard → API Keys | Clerk secret key for server-side calls |

### Convex Dashboard Environment Variables (Convex functions read these)

| Variable | Set By | Purpose |
|----------|--------|---------|
| `CLERK_JWT_ISSUER_DOMAIN` | Manual — Clerk Dashboard → JWT Templates → Convex → Issuer URL | `auth.config.ts` provider domain for JWT validation |
| `CLERK_WEBHOOK_SECRET` | Manual — Clerk Dashboard → Webhooks → Signing Secret | Svix signature verification in `convex/http.ts` |

Note: Variables prefixed `NEXT_PUBLIC_` are NOT available in Convex functions. Convex has its own environment variable store separate from Next.js.

---

## Sources

### Primary (HIGH confidence)

- [https://nextjs.org/docs/app/api-reference/file-conventions/proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — `proxy.ts` convention, export function name, matcher config, migration from middleware.ts (fetched directly, version: Next.js 16.1.6, updated 2026-02-27)
- npm registry `@clerk/nextjs@7.0.4` — peer deps include `next@^16.1.0-0`; version confirmed
- npm registry `convex@1.33.1` — exports `convex/react-clerk`, `convex/nextjs`; confirmed
- [https://clerk.com/docs/nextjs/getting-started/quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart) — `clerkMiddleware()` for proxy.ts, env vars, ClerkProvider placement (fetched)
- [https://ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — Tailwind v4 CSS-first config, `npx shadcn@latest init` (referenced in search results)

### Secondary (MEDIUM confidence)

- [https://docs.convex.dev/auth/clerk](https://docs.convex.dev/auth/clerk) — `auth.config.ts` pattern, `CLERK_JWT_ISSUER_DOMAIN`, `ConvexProviderWithClerk` setup (referenced in multiple verified sources; timeout prevented direct fetch but pattern cross-confirmed)
- [https://clerk.com/blog/webhooks-data-sync-convex](https://clerk.com/blog/webhooks-data-sync-convex) — Clerk webhook → Convex HTTP action pattern with Svix (official Clerk blog)
- [https://docs.convex.dev/auth/functions-auth](https://docs.convex.dev/auth/functions-auth) — `ctx.auth.getUserIdentity()`, `identity.subject`, `getCurrentUser` helper pattern
- [https://docs.convex.dev/database/reading-data/indexes](https://docs.convex.dev/database/reading-data/indexes) — `defineTable().index()` syntax, `withIndex()` usage
- WebSearch aggregated results for Convex + Clerk setup (multiple independent sources corroborating)

### Tertiary (LOW confidence — verify before use)

- `unstable_doesProxyMatch` test utility from `next/experimental/testing/server` — referenced in official Next.js docs but marked experimental; API may change

---

## Metadata

**Confidence breakdown:**
- proxy.ts / middleware rename: HIGH — fetched directly from official Next.js 16 docs
- Clerk + Convex integration: HIGH — cross-confirmed by Clerk official docs, Convex docs, and 4+ independent tutorials
- Schema patterns (defineTable, indexes): HIGH — cross-confirmed by Convex official API docs and multiple usage examples
- Tailwind v4 + shadcn setup: HIGH — official shadcn docs and Next.js scaffold behavior confirmed
- Webhook handler pattern: MEDIUM — official Clerk blog post; svix library usage confirmed
- Test infrastructure: LOW — no existing test files in project; Wave 0 gaps identified

**Research date:** 2026-03-16
**Valid until:** 2026-06-16 (stable libraries; 90-day validity)
