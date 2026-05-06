import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { applyOpenAiUsage } from "@/lib/usage/daily-token-budget";
import type { PipelineEvent } from "@/lib/pipeline/types";
import type { SemanticUniversePayload } from "@/lib/pipeline/models";
import { enrichVisualCorrelationsWithImages } from "@/lib/pipeline/enricher";
import { retrieveSourcesForBrand } from "@/lib/pipeline/retriever";
import { scoreSourcesForSynthesis } from "@/lib/pipeline/scorer";
import {
  buildFallback,
  extractCompetitorNamesFromSources,
  synthesizeWithOpenAI,
} from "@/lib/pipeline/structurer";

const encoder = new TextEncoder();

type StreamArgs = {
  controller: ReadableStreamDefaultController;
  runId: string;
  brand: string;
  userId: string;
  supabase: SupabaseClient;
  openai: OpenAI;
  tavilyKey: string;
  exaKey: string;
  voyageKey?: string;
  subscriptionActive: boolean;
  demoAlreadyUsed: boolean;
  markFreeDemoUsed: (userId: string) => Promise<void>;
};

export function emitLine(controller: ReadableStreamDefaultController, event: PipelineEvent) {
  controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
}

export async function runSemanticUniverseAnalysisStream({
  controller,
  runId,
  brand,
  userId,
  supabase,
  openai,
  tavilyKey,
  exaKey,
  voyageKey,
  subscriptionActive,
  demoAlreadyUsed,
  markFreeDemoUsed,
}: StreamArgs) {
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
      detail: sources.length + " sources collected, " + rankedSources.length + " reranked for synthesis",
    });

    emitLine(controller, { type: "step", id: "synthesis", status: "running" });
    const verifiedCompetitors = extractCompetitorNamesFromSources(brand, rankedSources);
    let payload: SemanticUniversePayload;
    let result_type: "success" | "fallback" = "success";
    let openaiInput = 0;
    let openaiOutput = 0;
    const tSynthStart = Date.now();
    try {
      const syn = await synthesizeWithOpenAI(brand, rankedSources, openai, verifiedCompetitors);
      payload = syn.payload;
      openaiInput = syn.usage.inputTokens;
      openaiOutput = syn.usage.outputTokens;
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
      await markFreeDemoUsed(userId);
    }

    const { error: insErr } = await supabase.from("semantic_pipeline_runs").insert({
      run_id: runId,
      user_id: userId,
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

    await applyOpenAiUsage(supabase, userId, { input: openaiInput, output: openaiOutput }, 1);
    emitLine(controller, { type: "done", payload: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    emitLine(controller, { type: "error", message });
  } finally {
    controller.close();
  }
}
