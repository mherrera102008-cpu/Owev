// @ts-nocheck
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCurrentUserId } from "./users";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Create a new invoice and schedule all reminder emails
export const create = mutation({
  args: {
    clientName: v.string(),
    clientEmail: v.string(),
    amount: v.number(),
    dueDate: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await getCurrentUserId(ctx);

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
      dueDate: args.dueDate,
      status,
      description: args.description,
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

    // Schedule before-due reminders
    for (const days of config.daysBefore) {
      const sendAt = args.dueDate - days * ONE_DAY_MS;
      if (sendAt > now) {
        const jobId = await ctx.scheduler.runAt(
          sendAt,
          internal.reminders.sendReminder,
          { invoiceId, reminderType: `${days}_days_before` }
        );
        scheduledIds.push(jobId);
      }
    }

    // On-due-date reminder (if due date is in the future)
    if (args.dueDate > now) {
      const jobId = await ctx.scheduler.runAt(
        args.dueDate,
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
