// @ts-nocheck
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getCurrentUserId } from "./users";

// Create a new invoice
export const create = mutation({
  args: {
    clientName: v.string(),
    clientEmail: v.string(),
    amount: v.number(), // stored in cents
    dueDate: v.number(), // unix timestamp ms (start of day)
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await getCurrentUserId(ctx);

    // Auto-increment invoice number per tenant
    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const invoiceNumber = existing.length + 1;

    // Determine initial status based on dueDate vs today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(args.dueDate);
    dueDay.setHours(0, 0, 0, 0);

    let status: "upcoming" | "due" | "overdue";
    if (dueDay.getTime() > today.getTime()) {
      status = "upcoming";
    } else if (dueDay.getTime() === today.getTime()) {
      status = "due";
    } else {
      status = "overdue";
    }

    return await ctx.db.insert("invoices", {
      ownerId,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      amount: args.amount,
      dueDate: args.dueDate,
      status,
      description: args.description,
      invoiceNumber,
      createdAt: Date.now(),
    });
  },
});

// List invoices — optionally filter by status
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("upcoming"),
        v.literal("due"),
        v.literal("overdue"),
        v.literal("paid")
      )
    ),
  },
  handler: async (ctx, { status }) => {
    const ownerId = await getCurrentUserId(ctx);

    if (status) {
      return await ctx.db
        .query("invoices")
        .withIndex("by_owner_status", (q) =>
          q.eq("ownerId", ownerId).eq("status", status)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("invoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();
  },
});

// Mark invoice as paid
export const markPaid = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, { id }) => {
    const ownerId = await getCurrentUserId(ctx);
    const invoice = await ctx.db.get(id);
    if (!invoice || invoice.ownerId !== ownerId) {
      throw new Error("Invoice not found");
    }
    await ctx.db.patch(id, { status: "paid" });
  },
});

// Delete invoice (any status)
export const remove = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, { id }) => {
    const ownerId = await getCurrentUserId(ctx);
    const invoice = await ctx.db.get(id);
    if (!invoice || invoice.ownerId !== ownerId) {
      throw new Error("Invoice not found");
    }
    await ctx.db.delete(id);
  },
});

// Internal: daily cron sweeps all unpaid invoices and transitions status
// upcoming → due (when dueDate == today)
// due/upcoming → overdue (when dueDate < today)
export const updateStatuses = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    // Get all non-paid invoices across all tenants
    const upcoming = await ctx.db
      .query("invoices")
      .filter((q) => q.neq(q.field("status"), "paid"))
      .collect();

    for (const invoice of upcoming) {
      const dueDay = new Date(invoice.dueDate);
      dueDay.setHours(0, 0, 0, 0);
      const dueDayMs = dueDay.getTime();

      if (dueDayMs < todayMs && invoice.status !== "overdue") {
        await ctx.db.patch(invoice._id, { status: "overdue" });
      } else if (dueDayMs === todayMs && invoice.status === "upcoming") {
        await ctx.db.patch(invoice._id, { status: "due" });
      }
    }
  },
});
