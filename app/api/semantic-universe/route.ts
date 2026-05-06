import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseSemanticTool, isSubscriptionActive } from "@/lib/tool-access";
import { createTracedOpenAI } from "@/lib/openai/traced-client";
import { isSemanticPipelineDisabled } from "@/lib/observability/kill-switch";
import {
  applyOpenAiUsage,
  assertDailyBudgetAllows,
  DailyCapError,
} from "@/lib/usage/daily-token-budget";
import { NextResponse } from "next/server";
import type { PipelineEvent } from "@/lib/pipeline/types";
import type { SemanticUniversePayload } from "@/lib/pipeline/models";
import { retrieveSourcesForBrand } from "@/lib/pipeline/retriever";
import { scoreSourcesForSynthesis } from "@/lib/pipeline/scorer";
import { enrichVisualCorrelationsWithImages } from "@/lib/pipeline/enricher";
import { buildFallback, extractCompetitorNamesFromSources, synthesizeWithOpenAI } from "@/lib/pipeline/structurer";

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
  return value.replace(/^['"]|['"]$/g, "").trim();
}

const encoder = new TextEncoder();

function emitLine(controller: ReadableStreamDefaultController, event: PipelineEvent) {
  controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
}

export async function POST(request: Request) {
  if (isSemanticPipelineDisabled()) {
    return NextResponse.json(
      { error: "Semantic pipeline temporarily disabled.", code: "PIPELINE_DISABLED" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("free_demo_used_at, stripe_status")
    .eq("id", user.id)
    .maybeSingle();

  const subscriptionActive = isSubscriptionActive(profile?.stripe_status);
  const demoAlreadyUsed =
    Boolean(profile?.free_demo_used_at) || hasDemoCookie(request);
  if (!canUseSemanticTool(subscriptionActive, demoAlreadyUsed ? "1" : null)) {
    return NextResponse.json(
      { error: "Subscription required.", code: "PAYWALL" },
      { status: 402 },
    );
  }

  try {
    await assertDailyBudgetAllows(supabase, user.id);
  } catch (err) {
    if (err instanceof DailyCapError) {
      return NextResponse.json(
        { error: "Daily analysis budget exceeded. Try again tomorrow.", code: "DAILY_CAP" },
        { status: 429 },
      );
    }
    throw err;
  }

  const body = (await request.json().catch(() => ({}))) as { brand?: string };
  const brand = body.brand?.trim();
  if (!brand) {
    return NextResponse.json({ error: "Brand is required." }, { status: 400 });
  }

  const openAiKey = cleanEnvValue(process.env.OPENAI_API_KEY ?? process.env.OPENAI_API);
  const tavilyKey = cleanEnvValue(process.env.TAVILY_API_KEY ?? process.env.TAVILY_API);
  const exaKey = cleanEnvValue(process.env.EXA_API_KEY);
  const voyageKey = cleanEnvValue(process.env.VOYAGE_API_KEY);

  if (!openAiKey || !tavilyKey || !exaKey) {
    return NextResponse.json(
      {
        error:
          "Missing one or more required environment variables: OPENAI_API_KEY, TAVILY_API_KEY, EXA_API_KEY.",
      },
      { status: 500 },
    );
  }

  const openai = createTracedOpenAI(openAiKey, {
    userId: user.id,
    traceName: "semantic-universe",
  });
  const runId = crypto.randomUUID();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        emitLine(controller, { type: "run_meta", run_id: runId });

        emitLine(controller, { type: "step", id: "sources", status: "running" });
        const tSourcesStart = Date.now();
        const sources = await retrieveSourcesForBrand(brand, { tavilyKey, exaKey });
        const rankedSources = await scoreSourcesForSynthesis(sources, brand, {
          voyageApiKey: voyageKey,
          timeoutMs: 8000,
          topN: 18,
        });
        const duration_ms_sources = Date.now() - tSourcesStart;
        emitLine(controller, {
          type: "step",
          id: "sources",
          status: "done",
          detail: `${sources.length} sources collected, ${rankedSources.length} reranked for synthesis`,
        });

        emitLine(controller, { type: "step", id: "synthesis", status: "running" });
        const verifiedCompetitors = extractCompetitorNamesFromSources(brand, rankedSources);
        let payload: SemanticUniversePayload;
        let result_type: "success" | "fallback" | "error" = "success";
        let openaiInput = 0;
        let openaiOutput = 0;
        const tSynthStart = Date.now();
        try {
          const syn = await synthesizeWithOpenAI(brand, rankedSources, openai, verifiedCompetitors);
          payload = syn.payload;
          openaiInput = syn.usage.inputTokens;
          openaiOutput = syn.usage.outputTokens;
          result_type = "success";
        } catch {
          payload = buildFallback(brand, rankedSources);
          result_type = "fallback";
        }
        const duration_ms_synthesis = Date.now() - tSynthStart;
        emitLine(controller, { type: "step", id: "synthesis", status: "done" });

        emitLine(controller, { type: "step", id: "images", status: "running" });
        const tImgStart = Date.now();
        const enriched = await enrichVisualCorrelationsWithImages(payload, rankedSources);
        const duration_ms_images = Date.now() - tImgStart;
        emitLine(controller, { type: "step", id: "images", status: "done" });

        if (!subscriptionActive && !demoAlreadyUsed) {
          await markFreeDemoUsed(user.id);
        }

        const { error: insErr } = await supabase.from("semantic_pipeline_runs").insert({
          run_id: runId,
          user_id: user.id,
          brand,
          completed_at: new Date().toISOString(),
          duration_ms_sources,
          duration_ms_synthesis,
          duration_ms_images,
          openai_input_tokens: openaiInput,
          openai_output_tokens: openaiOutput,
          retrieval_units: 1,
          node_count: enriched.nodes.length,
          edge_count: enriched.links.length,
          source_count: rankedSources.length,
          result_type,
          langfuse_trace_id: null,
        });
        if (insErr) console.error("[semantic-universe] telemetry insert", insErr);

        await applyOpenAiUsage(supabase, user.id, { input: openaiInput, output: openaiOutput }, 1);

        emitLine(controller, { type: "done", payload: enriched });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected server error.";
        emitLine(controller, { type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  const response = new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });

  // Fallback guard: enforce one free run even when profile writes fail.
  if (!subscriptionActive && !demoAlreadyUsed) {
    response.headers.append(
      "Set-Cookie",
      "semantic_demo_used=1; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly",
    );
  }

  return response;
}
