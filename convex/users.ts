// @ts-nocheck
// NOTE: This file imports from ./_generated/server which is created by `npx convex dev`.
// The _generated/ directory does not exist until you run `npx convex dev` against a
// real Convex deployment. TypeScript checking is disabled here temporarily.
// Remove @ts-nocheck after running `npx convex dev` in Phase 2 setup.
import { MutationCtx, QueryCtx, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: valid Clerk session required");
  }
  return identity.subject;
}

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
