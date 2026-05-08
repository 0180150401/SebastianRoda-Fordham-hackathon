import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { applyOpenAiUsage } from "@/lib/usage/daily-token-budget";
import type { PipelineEvent } from "@/lib/pipeline/types";
import type { ResultType, SemanticUniversePayload } from "@/lib/pipeline/models";
import { enrichVisualCorrelationsWithImages } from "@/lib/pipeline/enricher";
import { getRetrievalLimits, planRetrievalQueries } from "@/lib/pipeline/query-planner";
import { retrieveSourcesForBrand } from "@/lib/pipeline/retriever";
import { scoreSourcesForSynthesis } from "@/lib/pipeline/scorer";
import { filterSourcesForQuality } from "@/lib/pipeline/source-quality";
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

function fallbackReason(error: unknown): string {
  if (error instanceof Error && error.message === "below_grounded_graph_floor") {
    return "below_grounded_graph_floor";
  }
  return "fallback_synthesis";
}

function provenanceCounts(payload: SemanticUniversePayload) {
  return {
    repairedLinks: 0,
    rejectedLinks: 0,
    rejectedNodes: 0,
    groundedEdgeCount: payload.links.filter((link) => link.evidenceIds.length > 0).length,
    passageEvidenceCount: payload.evidence.length,
  };
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
    const limits = getRetrievalLimits();
    const queryPlan = await planRetrievalQueries(brand, { openai, runId, limits });
    emitLine(controller, queryPlan);

    emitLine(controller, { type: "step", id: "sources", status: "running" });
    const tSourcesStart = Date.now();
    const retrieval = await retrieveSourcesForBrand(brand, { tavilyKey, exaKey, queryPlan, limits });
    const quality = filterSourcesForQuality(retrieval.sources);
    const filteredCount = retrieval.sources.length - quality.usableSources.length;
    const degradedReason =
      quality.usableSources.length < limits.minimumUsableSources
        ? "thin_retrieval_evidence"
        : null;
    const rankedSources = await scoreSourcesForSynthesis(quality.usableSources, brand, {
      voyageApiKey: voyageKey,
      timeoutMs: limits.providerTimeoutMs,
      topN: 18,
    });
    const duration_ms_sources = Date.now() - tSourcesStart;
    const sourceDetailParts = [
      `${retrieval.stats.plannedQueries} planned queries`,
      `${retrieval.stats.providerSearchesSucceeded} searches succeeded`,
      `${retrieval.stats.providerSearchesFailed} failed`,
      `${retrieval.sources.length} candidates`,
      `${filteredCount} filtered`,
      `${rankedSources.length} usable`,
    ];
    if (degradedReason) sourceDetailParts.push(`degraded: ${degradedReason}`);
    emitLine(controller, {
      type: "step",
      id: "sources",
      status: "done",
      detail: sourceDetailParts.join(", "),
    });

    emitLine(controller, { type: "step", id: "synthesis", status: "running" });
    const verifiedCompetitors = extractCompetitorNamesFromSources(brand, rankedSources);
    let payload: SemanticUniversePayload;
    let result_type: ResultType = "success";
    let resultReason: string | null = null;
    let synthesisRepairedLinks = 0;
    let synthesisRejectedLinks = 0;
    let synthesisRejectedNodes = 0;
    let synthesisGroundedEdgeCount = 0;
    let synthesisPassageEvidenceCount = 0;
    let openaiInput = 0;
    let openaiOutput = 0;
    const tSynthStart = Date.now();
    try {
      const syn = await synthesizeWithOpenAI(brand, rankedSources, openai, verifiedCompetitors);
      openaiInput = syn.usage.inputTokens;
      openaiOutput = syn.usage.outputTokens;
      if (syn.provenance.resultType === "fallback") {
        payload = buildFallback(brand, rankedSources);
        const counts = provenanceCounts(payload);
        result_type = "fallback";
        resultReason = syn.provenance.reason ?? "below_grounded_graph_floor";
        synthesisRepairedLinks = counts.repairedLinks;
        synthesisRejectedLinks = counts.rejectedLinks;
        synthesisRejectedNodes = counts.rejectedNodes;
        synthesisGroundedEdgeCount = counts.groundedEdgeCount;
        synthesisPassageEvidenceCount = counts.passageEvidenceCount;
      } else {
        payload = syn.payload;
        result_type = syn.provenance.resultType;
        resultReason = syn.provenance.reason ?? null;
        synthesisRepairedLinks = syn.provenance.repairedLinks;
        synthesisRejectedLinks = syn.provenance.rejectedLinks;
        synthesisRejectedNodes = syn.provenance.rejectedNodes;
        synthesisGroundedEdgeCount = syn.provenance.groundedEdgeCount;
        synthesisPassageEvidenceCount = syn.provenance.passageEvidenceCount;
      }
    } catch (error) {
      payload = buildFallback(brand, rankedSources);
      const counts = provenanceCounts(payload);
      result_type = "fallback";
      resultReason = fallbackReason(error);
      synthesisRepairedLinks = counts.repairedLinks;
      synthesisRejectedLinks = counts.rejectedLinks;
      synthesisRejectedNodes = counts.rejectedNodes;
      synthesisGroundedEdgeCount = counts.groundedEdgeCount;
      synthesisPassageEvidenceCount = counts.passageEvidenceCount;
    }
    payload = { ...payload, resultType: result_type, resultReason: resultReason ?? undefined };
    const duration_ms_synthesis = Date.now() - tSynthStart;
    const synthesisDetail = resultReason
      ? `result: ${result_type} (${resultReason})`
      : `result: ${result_type}`;
    emitLine(controller, { type: "step", id: "synthesis", status: "done", detail: synthesisDetail });

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
      retrieval_query_count: retrieval.stats.plannedQueries,
      retrieval_provider_success_count: retrieval.stats.providerSearchesSucceeded,
      retrieval_provider_failure_count: retrieval.stats.providerSearchesFailed,
      retrieval_filtered_count: filteredCount,
      retrieval_degraded_reason: degradedReason,
      retrieval_filter_reasons: quality.rejectedCounts,
      synthesis_result_reason: resultReason,
      synthesis_repaired_links: synthesisRepairedLinks,
      synthesis_rejected_links: synthesisRejectedLinks,
      synthesis_rejected_nodes: synthesisRejectedNodes,
      synthesis_grounded_edge_count: synthesisGroundedEdgeCount,
      synthesis_passage_evidence_count: synthesisPassageEvidenceCount,
    });
    if (insErr) console.error("[semantic-universe] telemetry insert", insErr);

    await applyOpenAiUsage(
      supabase,
      userId,
      { input: openaiInput, output: openaiOutput },
      retrieval.stats.providerSearchesPlanned,
    );
    emitLine(controller, { type: "done", payload: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    emitLine(controller, { type: "error", message });
  } finally {
    controller.close();
  }
}
