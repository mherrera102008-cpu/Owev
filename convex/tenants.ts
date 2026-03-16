// @ts-nocheck
import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { getCurrentUserId } from "./users";

// Get current tenant's config
export const get = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await getCurrentUserId(ctx);
    return await ctx.db
      .query("tenants")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
  },
});

// Update reminder schedule config
export const updateReminderConfig = mutation({
  args: {
    daysBefore: v.array(v.number()),
    daysAfter: v.array(v.number()),
  },
  handler: async (ctx, { daysBefore, daysAfter }) => {
    const ownerId = await getCurrentUserId(ctx);
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
    if (!tenant) throw new Error("Tenant not found");
    await ctx.db.patch(tenant._id, {
      reminderConfig: { daysBefore, daysAfter },
    });
  },
});

// Internal — used by reminder action to get tenant info
export const getByOwner = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    return await ctx.db
      .query("tenants")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
  },
});
