import { createClient } from "@/lib/supabase/server";
import { normalizeSiteOrigin } from "@/lib/site-url";
import { stripe, PRICE_IDS } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as { planId?: string; billingCycle?: string; quantity?: number };
    const { planId, billingCycle = "monthly", quantity = 1 } = body;

    if (!planId || !PRICE_IDS[planId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId = PRICE_IDS[planId][billingCycle];
    if (!priceId) {
      return NextResponse.json({ error: "Missing Stripe price configuration for this plan." }, { status: 500 });
    }

    const baseUrl =
      normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
      normalizeSiteOrigin(process.env.AUTH_URL) ??
      "https://6degree.noemtech.com";
    const normalizedQuantity =
      planId === "teams"
        ? Math.max(1, Math.min(3, quantity))
        : 1;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: normalizedQuantity }],
      success_url: `${baseUrl}/tool?checkout=success`,
      cancel_url: `${baseUrl}/#trusted-by`,
      metadata: {
        userId: user.id,
        planId,
        billingCycle,
        quantity: String(normalizedQuantity),
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planId,
          billingCycle,
          quantity: String(normalizedQuantity),
        },
      },
    });

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Stripe checkout URL was not created." }, { status: 500 });
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create checkout session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
