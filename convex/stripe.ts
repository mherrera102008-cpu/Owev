// @ts-nocheck
import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCurrentUserId } from "./users";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

// Create a Stripe Checkout session for subscription
export const createCheckoutSession = action({
  args: {
    priceId: v.string(),
    returnUrl: v.string(),
  },
  handler: async (ctx, { priceId, returnUrl }) => {
    const ownerId = await getCurrentUserId(ctx);
    const tenant = await ctx.runQuery(internal.stripe.getTenantByOwner, { ownerId });
    if (!tenant) throw new Error("Tenant not found");

    const stripe = getStripe();

    // Reuse existing Stripe customer or create one
    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        metadata: { ownerId },
      });
      customerId = customer.id;
      await ctx.runMutation(internal.stripe.setStripeCustomer, {
        ownerId,
        stripeCustomerId: customerId,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl,
    });

    return { url: session.url };
  },
});

// Create a Stripe Customer Portal session (to manage billing)
export const createPortalSession = action({
  args: { returnUrl: v.string() },
  handler: async (ctx, { returnUrl }) => {
    const ownerId = await getCurrentUserId(ctx);
    const tenant = await ctx.runQuery(internal.stripe.getTenantByOwner, { ownerId });
    if (!tenant?.stripeCustomerId) throw new Error("No Stripe customer found");

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  },
});

// Internal query — get tenant for Stripe actions
export const getTenantByOwner = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    return await ctx.db
      .query("tenants")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
  },
});

// Internal mutation — set Stripe customer ID
export const setStripeCustomer = internalMutation({
  args: { ownerId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, { ownerId, stripeCustomerId }) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
    if (tenant) await ctx.db.patch(tenant._id, { stripeCustomerId });
  },
});

// Internal mutation — update subscription status from webhook
export const updateSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    subscriptionId: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("trialing"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("none")
    ),
  },
  handler: async (ctx, { stripeCustomerId, subscriptionId, status }) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", stripeCustomerId)
      )
      .first();
    if (!tenant) return;
    await ctx.db.patch(tenant._id, {
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: status,
    });
  },
});
