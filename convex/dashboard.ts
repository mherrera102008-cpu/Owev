// @ts-nocheck
import { query } from "./_generated/server";
import { getCurrentUserId } from "./users";

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await getCurrentUserId(ctx);

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();

    const total = invoices.length;
    const overdue = invoices.filter((i) => i.status === "overdue").length;
    const due = invoices.filter((i) => i.status === "due").length;
    const upcoming = invoices.filter((i) => i.status === "upcoming").length;
    const unpaidAmount = invoices
      .filter((i) => i.status !== "paid")
      .reduce((sum, i) => sum + i.amount, 0);

    // Paid this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const paidThisMonth = invoices.filter(
      (i) => i.status === "paid" && i.createdAt >= startOfMonth.getTime()
    ).length;

    return { total, overdue, due, upcoming, unpaidAmount, paidThisMonth };
  },
});
