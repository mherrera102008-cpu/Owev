// @ts-nocheck
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";
import Stripe from "stripe";

const http = httpRouter();

// ── Clerk user webhook ────────────────────────────────────────────────────────
http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response("Server configuration error", { status: 500 });
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
      return new Response("Invalid webhook signature", { status: 400 });
    }

    switch (event.type) {
      case "user.created":
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          clerkId: event.data.id,
          email: event.data.email_addresses[0]?.email_address,
        });
        break;
    }

    return new Response(null, { status: 200 });
  }),
});

// ── Stripe billing webhook ────────────────────────────────────────────────────
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response("STRIPE_WEBHOOK_SECRET not set", { status: 500 });
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const payloadString = await request.text();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        payloadString,
        signature,
        webhookSecret
      );
    } catch {
      return new Response("Invalid Stripe signature", { status: 400 });
    }

    // Idempotency check — skip already-processed events
    const existing = await ctx.runQuery(internal.webhooks.isProcessed, {
      stripeEventId: event.id,
    });
    if (existing) return new Response(null, { status: 200 });

    // Mark as processed immediately
    await ctx.runMutation(internal.webhooks.markProcessed, {
      stripeEventId: event.id,
    });

    // Handle the five subscription lifecycle events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.customer) {
          await ctx.runMutation(internal.stripe.updateSubscription, {
            stripeCustomerId: session.customer as string,
            subscriptionId: session.subscription as string,
            status: "active",
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = mapStripeStatus(sub.status);
        await ctx.runMutation(internal.stripe.updateSubscription, {
          stripeCustomerId: sub.customer as string,
          subscriptionId: sub.id,
          status,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await ctx.runMutation(internal.stripe.updateSubscription, {
          stripeCustomerId: sub.customer as string,
          subscriptionId: undefined,
          status: "canceled",
        });
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.customer) {
          await ctx.runMutation(internal.stripe.updateSubscription, {
            stripeCustomerId: inv.customer as string,
            status: "past_due",
          });
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.customer && inv.subscription) {
          await ctx.runMutation(internal.stripe.updateSubscription, {
            stripeCustomerId: inv.customer as string,
            subscriptionId: inv.subscription as string,
            status: "active",
          });
        }
        break;
      }
    }

    return new Response(null, { status: 200 });
  }),
});

function mapStripeStatus(
  status: Stripe.Subscription.Status
): "active" | "trialing" | "past_due" | "canceled" | "none" {
  switch (status) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due":
    case "unpaid": return "past_due";
    case "canceled":
    case "incomplete_expired": return "canceled";
    default: return "none";
  }
}

export default http;
