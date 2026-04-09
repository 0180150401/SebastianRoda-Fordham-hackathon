import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not load billing profile." }, { status: 500 });
  }

  const customerId = profile?.stripe_customer_id;
  if (!customerId || typeof customerId !== "string") {
    return NextResponse.json(
      { error: "No active subscription found for this account." },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL ?? "https://6degree.noemtech.com";

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/tool`,
  });

  return NextResponse.json({ url: session.url });
}
