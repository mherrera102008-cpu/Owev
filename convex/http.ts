// @ts-nocheck
// NOTE: This file imports from ./_generated/server and ./_generated/api which are created
// by `npx convex dev`. The _generated/ directory does not exist until you run
// `npx convex dev` against a real Convex deployment.
// TypeScript checking is disabled here temporarily.
// Remove @ts-nocheck after running `npx convex dev` in Phase 2 setup.
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET not set in Convex environment variables");
      return new Response("Server configuration error", { status: 500 });
    }

    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing required Svix headers", { status: 400 });
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
    } catch (err) {
      console.error("Svix signature verification failed:", err);
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
      default:
        break;
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
