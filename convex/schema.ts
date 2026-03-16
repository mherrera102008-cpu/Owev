import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tenants: defineTable({
    ownerId: v.string(),
    clerkId: v.string(),
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
      daysBefore: v.array(v.number()),
      daysAfter: v.array(v.number()),
    }),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  invoices: defineTable({
    ownerId: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    amount: v.number(),
    dueDate: v.number(),
    status: v.union(
      v.literal("upcoming"),
      v.literal("due"),
      v.literal("overdue"),
      v.literal("paid")
    ),
    description: v.optional(v.string()),
    invoiceNumber: v.optional(v.number()),
    scheduledReminderIds: v.optional(
      v.array(v.id("_scheduled_functions"))
    ),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_status", ["ownerId", "status"]),

  reminderLog: defineTable({
    invoiceId: v.id("invoices"),
    ownerId: v.string(),
    sentAt: v.number(),
    reminderType: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("failed")
    ),
    resendMessageId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_invoice", ["invoiceId"])
    .index("by_owner", ["ownerId"]),

  processedWebhooks: defineTable({
    stripeEventId: v.string(),
    processedAt: v.number(),
  })
    .index("by_stripe_event_id", ["stripeEventId"]),
});
