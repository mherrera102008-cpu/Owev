// @ts-nocheck
import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

export const isProcessed = internalQuery({
  args: { stripeEventId: v.string() },
  handler: async (ctx, { stripeEventId }) => {
    const existing = await ctx.db
      .query("processedWebhooks")
      .withIndex("by_stripe_event_id", (q) =>
        q.eq("stripeEventId", stripeEventId)
      )
      .first();
    return !!existing;
  },
});

export const markProcessed = internalMutation({
  args: { stripeEventId: v.string() },
  handler: async (ctx, { stripeEventId }) => {
    await ctx.db.insert("processedWebhooks", {
      stripeEventId,
      processedAt: Date.now(),
    });
  },
});
