import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

async function findProfileIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await admin.from("profiles").select("id").ilike("email", normalized).maybeSingle();
  if (error) {
    console.error("[stripe webhook] profile by email", error);
    return null;
  }
  return data?.id ?? null;
}

async function findProfileIdByStripeCustomer(customerId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) {
    console.error("[stripe webhook] profile by customer", error);
    return null;
  }
  return data?.id ?? null;
}

async function updateProfile(
  id: string,
  patch: Record<string, string | null | undefined>,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[stripe webhook] update profile", error);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[stripe webhook] SUPABASE_SERVICE_ROLE_KEY not set; skipping profile updates");
    return NextResponse.json({ received: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;

      const email = session.customer_email;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const planId = session.metadata?.planId ?? "";
      const billingCycle = session.metadata?.billingCycle ?? "monthly";

      const fromMeta = session.metadata?.userId;
      let profileId: string | null =
        typeof fromMeta === "string" && fromMeta.length > 0 ? fromMeta : null;
      if (!profileId && email) {
        profileId = await findProfileIdByEmail(email);
      }
      if (profileId) {
        await updateProfile(profileId, {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_plan_id: `${planId}_${billingCycle}`,
          stripe_status: "active",
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = await findProfileIdByStripeCustomer(sub.customer as string);
      if (profileId) {
        await updateProfile(profileId, {
          stripe_subscription_id: sub.id,
          stripe_status: sub.status,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = await findProfileIdByStripeCustomer(sub.customer as string);
      if (profileId) {
        await updateProfile(profileId, {
          stripe_subscription_id: null,
          stripe_plan_id: null,
          stripe_status: "canceled",
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
