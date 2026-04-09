import { createClient } from "@/lib/supabase/server";
import { isSubscriptionActive } from "@/lib/tool-access";
import { NextResponse } from "next/server";

function hasDemoCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return /(?:^|;\s*)semantic_demo_used=1(?:;|$)/.test(cookie);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("free_demo_used_at, stripe_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[tool/access]", error);
    return NextResponse.json({ error: "Could not load profile." }, { status: 500 });
  }

  const subscriptionActive = isSubscriptionActive(profile?.stripe_status);
  const demoUsed = Boolean(profile?.free_demo_used_at) || hasDemoCookie(request);

  return NextResponse.json({
    subscriptionActive,
    demoUsed,
    /** Always true: dashboard is reachable; paywall only after a blocked analysis (402). */
    canAccessTool: true,
    /** True when user may run one free analysis (not subscribed, demo not yet used). */
    hasFreeDemoRemaining: !subscriptionActive && !demoUsed,
  });
}
