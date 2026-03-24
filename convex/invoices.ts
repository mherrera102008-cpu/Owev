// @ts-nocheck
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCurrentUserId } from "./users";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_ACCENT_COLORS = new Set(["black", "blue", "violet", "green", "rose"]);
const ALLOWED_CURRENCIES = new Set([
  "USD", "EUR", "GBP", "INR", "JPY", "CNY",
  "CAD", "AUD", "CHF", "BRL", "MXN", "SGD", "AED", "KRW",
]);

// Create a new invoice and schedule all reminder emails
export const create = mutation({
  args: {
    clientName: v.string(),
    clientEmail: v.string(),
    amount: v.number(),
    dueDate: v.number(),
    currency: v.optional(v.string()),
    description: v.optional(v.string()),
    accentColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await getCurrentUserId(ctx);

    // Input validation
    if (args.clientName.trim().length === 0 || args.clientName.length > 200) {
      throw new Error("Client name must be between 1 and 200 characters");
    }
    if (args.clientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.clientEmail)) {
      throw new Error("Invalid client email address");
    }
    if (args.description && args.description.length > 1000) {
      throw new Error("Description must be 1000 characters or fewer");
    }
    if (args.amount <= 0 || args.amount > 100_000_000_00) {
      throw new Error("Amount must be between $0.01 and $100,000,000");
    }
    if (args.accentColor !== undefined && !ALLOWED_ACCENT_COLORS.has(args.accentColor)) {
      throw new Error("Invalid accent color");
    }
    if (args.currency !== undefined && !ALLOWED_CURRENCIES.has(args.currency)) {
      throw new Error("Invalid currency");
    }

    // TODO Phase 4: uncomment to gate invoice creation on active subscription
    // const tenant = await ctx.db.query("tenants").withIndex("by_owner", q => q.eq("ownerId", ownerId)).first();
    // if (!["active","trialing"].includes(tenant?.subscriptionStatus ?? "none")) throw new Error("SUBSCRIPTION_REQUIRED");

    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    const invoiceNumber = existing.length + 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(args.dueDate);
    dueDay.setHours(0, 0, 0, 0);

    let status: "upcoming" | "due" | "overdue";
    if (dueDay.getTime() > today.getTime()) status = "upcoming";
    else if (dueDay.getTime() === today.getTime()) status = "due";
    else status = "overdue";

    const invoiceId = await ctx.db.insert("invoices", {
      ownerId,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      amount: args.amount,
      currency: args.currency ?? "USD",
      dueDate: args.dueDate,
      status,
      description: args.description,
      accentColor: args.accentColor,
      invoiceNumber,
      createdAt: Date.now(),
    });

    // Fetch tenant reminder config
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
    const config = tenant?.reminderConfig ?? {
      daysBefore: [7, 3, 1],
      daysAfter: [1, 3, 7],
    };

    const now = Date.now();
    const scheduledIds: any[] = [];

    // Schedule before-due reminders — skip if more than 1 day past due
    for (const days of config.daysBefore) {
      const sendAt = args.dueDate - days * ONE_DAY_MS;
      if (sendAt > now - ONE_DAY_MS) {
        const jobId = await ctx.scheduler.runAt(
          Math.max(sendAt, now + 2000),
          internal.reminders.sendReminder,
          { invoiceId, reminderType: `${days}_days_before` }
        );
        scheduledIds.push(jobId);
      }
    }

    // On-due-date reminder — if already past, send immediately
    {
      const sendAt = Math.max(args.dueDate, now + 2000);
      const jobId = await ctx.scheduler.runAt(
        sendAt,
        internal.reminders.sendReminder,
        { invoiceId, reminderType: "on_due_date" }
      );
      scheduledIds.push(jobId);
    }

    // Schedule after-due reminders
    for (const days of config.daysAfter) {
      const sendAt = args.dueDate + days * ONE_DAY_MS;
      const jobId = await ctx.scheduler.runAt(
        sendAt,
        internal.reminders.sendReminder,
        { invoiceId, reminderType: `${days}_days_after` }
      );
      scheduledIds.push(jobId);
    }

    if (scheduledIds.length > 0) {
      await ctx.db.patch(invoiceId, { scheduledReminderIds: scheduledIds });
    }

    return invoiceId;
  },
});

// List invoices with optional status filter
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

// Mark invoice as paid — cancel all scheduled reminders
export const markPaid = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, { id }) => {
    const ownerId = await getCurrentUserId(ctx);
    const invoice = await ctx.db.get(id);
    if (!invoice || invoice.ownerId !== ownerId) throw new Error("Invoice not found");

    // Cancel all pending reminder jobs
    if (invoice.scheduledReminderIds?.length) {
      for (const jobId of invoice.scheduledReminderIds) {
        try {
          await ctx.scheduler.cancel(jobId);
        } catch {
          // Job may have already run — ignore
        }
      }
    }

    await ctx.db.patch(id, { status: "paid", scheduledReminderIds: [] });
  },
});

// Delete invoice
export const remove = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, { id }) => {
    const ownerId = await getCurrentUserId(ctx);
    const invoice = await ctx.db.get(id);
    if (!invoice || invoice.ownerId !== ownerId) throw new Error("Invoice not found");

    // Cancel scheduled reminders before deleting
    if (invoice.scheduledReminderIds?.length) {
      for (const jobId of invoice.scheduledReminderIds) {
        try {
          await ctx.scheduler.cancel(jobId);
        } catch {
          // Already ran — ignore
        }
      }
    }

    await ctx.db.delete(id);
  },
});

// Internal: daily status sweep
export const updateStatuses = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const unpaid = await ctx.db
      .query("invoices")
      .filter((q) => q.neq(q.field("status"), "paid"))
      .collect();

    for (const invoice of unpaid) {
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

// Internal query — used by reminder action
export const getById = internalQuery({
  args: { id: v.id("invoices") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});
