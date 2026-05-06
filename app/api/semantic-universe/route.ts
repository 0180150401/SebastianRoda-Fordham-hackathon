import { NextResponse } from "next/server";

import { createTracedOpenAI } from "@/lib/openai/traced-client";
import { isSemanticPipelineDisabled } from "@/lib/observability/kill-switch";
import { runSemanticUniverseAnalysisStream } from "@/lib/pipeline/stream-handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseSemanticTool, isSubscriptionActive } from "@/lib/tool-access";
import { assertDailyBudgetAllows, DailyCapError } from "@/lib/usage/daily-token-budget";

export const maxDuration = 300;

function hasDemoCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return /(?:^|;\s*)semantic_demo_used=1(?:;|$)/.test(cookie);
}

async function markFreeDemoUsed(userId: string) {
  const iso = new Date().toISOString();
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      await admin.from("profiles").update({ free_demo_used_at: iso }).eq("id", userId);
      return;
    } catch (e) {
      console.error("[semantic-universe] mark demo (admin)", e);
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ free_demo_used_at: iso }).eq("id", userId);
  if (error) console.error("[semantic-universe] mark demo (user)", error);
}

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^[ '"]|['"]$/g, "").trim();
}

export async function POST(request: Request) {
  if (isSemanticPipelineDisabled()) return NextResponse.json({ error: "Semantic pipeline temporarily disabled.", code: "PIPELINE_DISABLED" }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("free_demo_used_at, stripe_status").eq("id", user.id).maybeSingle();
  const subscriptionActive = isSubscriptionActive(profile?.stripe_status);
  const demoAlreadyUsed = Boolean(profile?.free_demo_used_at) || hasDemoCookie(request);
  if (!canUseSemanticTool(subscriptionActive, demoAlreadyUsed ? "1" : null)) return NextResponse.json({ error: "Subscription required.", code: "PAYWALL" }, { status: 402 });

  try {
    await assertDailyBudgetAllows(supabase, user.id);
  } catch (err) {
    if (err instanceof DailyCapError) return NextResponse.json({ error: "Daily analysis budget exceeded. Try again tomorrow.", code: "DAILY_CAP" }, { status: 429 });
    throw err;
  }

  const body = (await request.json().catch(() => ({}))) as { brand?: string };
  const brand = body.brand?.trim();
  if (!brand) return NextResponse.json({ error: "Brand is required." }, { status: 400 });

  const openAiKey = cleanEnvValue(process.env.OPENAI_API_KEY ?? process.env.OPENAI_API);
  const tavilyKey = cleanEnvValue(process.env.TAVILY_API_KEY ?? process.env.TAVILY_API);
  const exaKey = cleanEnvValue(process.env.EXA_API_KEY);
  const voyageKey = cleanEnvValue(process.env.VOYAGE_API_KEY);
  if (!openAiKey || !tavilyKey || !exaKey) return NextResponse.json({ error: "Missing one or more required environment variables: OPENAI_API_KEY, TAVILY_API_KEY, EXA_API_KEY." }, { status: 500 });

  const openai = createTracedOpenAI(openAiKey, { userId: user.id, traceName: "semantic-universe" });
  const runId = crypto.randomUUID();
  const stream = new ReadableStream({
    async start(controller) {
      await runSemanticUniverseAnalysisStream({ controller, runId, brand, userId: user.id, supabase, openai, tavilyKey, exaKey, voyageKey, subscriptionActive, demoAlreadyUsed, markFreeDemoUsed });
    },
  });

  const response = new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform", "X-Content-Type-Options": "nosniff" } });
  if (!subscriptionActive && !demoAlreadyUsed) response.headers.append("Set-Cookie", "semantic_demo_used=1; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly");
  return response;
}
