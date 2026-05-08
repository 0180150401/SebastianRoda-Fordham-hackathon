import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SemanticUniversePayload, SourceItem } from "@/lib/pipeline/models";
import type { QueryPlanEvent } from "@/lib/pipeline/types";

const longSnippet = Array.from({ length: 170 }, (_, index) => `token${index}`).join(" ");

const queryPlan: QueryPlanEvent = {
  type: "query_plan",
  plan_id: "run-1:retrieval-plan",
  display: {
    title: "Retrieval plan",
    summary: "Friendly retrieval plan.",
    items: [{ id: "q1", label: "Competitors", intent: "Find comparable brands." }],
  },
  queries: [{
    id: "q1",
    label: "Competitors",
    intent: "Find comparable brands.",
    searchPhrase: "Acme competitors",
    category: "competitors",
    recency: "none",
    providers: ["tavily", "exa"],
    successCriteria: "Mentions Acme and comparable brands.",
  }],
};

const source = (overrides: Partial<SourceItem> = {}): SourceItem => ({
  query: "Acme competitors",
  title: "Useful source",
  url: "https://example.test/source",
  snippet: longSnippet,
  provider: "tavily",
  ...overrides,
});

const payload: SemanticUniversePayload = {
  nodes: [],
  links: [],
  evidence: [],
  semanticDiscourse: [],
  visualCorrelations: [],
  modelStrength: { score: 0, strong: 0, observed: 0, models: [] },
};

const planRetrievalQueriesMock = vi.fn();
const retrieveSourcesForBrandMock = vi.fn();
const scoreSourcesForSynthesisMock = vi.fn();
const synthesizeWithOpenAIMock = vi.fn();
const enrichVisualCorrelationsWithImagesMock = vi.fn();
const applyOpenAiUsageMock = vi.fn();

vi.mock("@/lib/pipeline/query-planner", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline/query-planner")>(
    "@/lib/pipeline/query-planner",
  );
  return {
    ...actual,
    getRetrievalLimits: () => ({
      minQueries: 5,
      maxQueries: 12,
      maxProviderSearchesPerProvider: 8,
      providerTimeoutMs: 8000,
      totalRetrievalBudgetMs: 45000,
      minimumUsableSources: 2,
    }),
    planRetrievalQueries: planRetrievalQueriesMock,
  };
});

vi.mock("@/lib/pipeline/retriever", () => ({
  retrieveSourcesForBrand: retrieveSourcesForBrandMock,
}));

vi.mock("@/lib/pipeline/scorer", () => ({
  scoreSourcesForSynthesis: scoreSourcesForSynthesisMock,
}));

vi.mock("@/lib/pipeline/structurer", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline/structurer")>(
    "@/lib/pipeline/structurer",
  );
  return {
    ...actual,
    extractCompetitorNamesFromSources: () => ["Competitor"],
    synthesizeWithOpenAI: synthesizeWithOpenAIMock,
  };
});

vi.mock("@/lib/pipeline/enricher", () => ({
  enrichVisualCorrelationsWithImages: enrichVisualCorrelationsWithImagesMock,
}));

vi.mock("@/lib/usage/daily-token-budget", () => ({
  applyOpenAiUsage: applyOpenAiUsageMock,
}));

async function runAndCollect() {
  const { runSemanticUniverseAnalysisStream } = await import("@/lib/pipeline/stream-handler");
  const chunks: string[] = [];
  const controller = {
    enqueue(value: Uint8Array) {
      chunks.push(new TextDecoder().decode(value));
    },
    close: vi.fn(),
  } as unknown as ReadableStreamDefaultController;
  const insert = vi.fn(async () => ({ error: null }));
  const supabase = {
    from: vi.fn(() => ({ insert })),
  };

  await runSemanticUniverseAnalysisStream({
    controller,
    runId: "550e8400-e29b-41d4-a716-446655440000",
    brand: "Acme",
    userId: "user-1",
    supabase: supabase as never,
    openai: {} as never,
    tavilyKey: "tavily",
    exaKey: "exa",
    voyageKey: undefined,
    subscriptionActive: true,
    demoAlreadyUsed: true,
    markFreeDemoUsed: vi.fn(),
  });

  return {
    events: chunks.join("").trim().split("\n").map((line) => JSON.parse(line) as {
      type: string;
      id?: string;
      status?: string;
      detail?: string;
      payload?: SemanticUniversePayload;
    }),
    insert,
  };
}

describe("runSemanticUniverseAnalysisStream Phase 4 orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planRetrievalQueriesMock.mockResolvedValue(queryPlan);
    retrieveSourcesForBrandMock.mockResolvedValue({
      sources: [source(), source({ url: "https://example.test/two" })],
      stats: {
        plannedQueries: 1,
        providerSearchesPlanned: 2,
        providerSearchesSucceeded: 2,
        providerSearchesFailed: 0,
        failures: [],
      },
    });
    scoreSourcesForSynthesisMock.mockImplementation(async (sources: SourceItem[]) => sources);
    synthesizeWithOpenAIMock.mockResolvedValue({
      payload,
      usage: { inputTokens: 11, outputTokens: 22 },
      provenance: {
        payload,
        resultType: "success",
        rejectedLinks: 0,
        rejectedNodes: 0,
        repairedLinks: 0,
        groundedEdgeCount: 0,
        passageEvidenceCount: 0,
      },
    });
    enrichVisualCorrelationsWithImagesMock.mockImplementation(async (nextPayload: SemanticUniversePayload) => nextPayload);
    applyOpenAiUsageMock.mockResolvedValue(undefined);
  });

  it("emits query_plan before sources and persists aggregate retrieval stats", async () => {
    const { events, insert } = await runAndCollect();
    expect(events.map((event) => event.type)).toEqual([
      "run_meta",
      "query_plan",
      "step",
      "step",
      "step",
      "step",
      "step",
      "step",
      "done",
    ]);
    expect(events[2]).toMatchObject({ type: "step", id: "sources", status: "running" });
    expect(events[3].detail).toContain("1 planned queries");

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      retrieval_query_count: 1,
      retrieval_provider_success_count: 2,
      retrieval_provider_failure_count: 0,
      retrieval_filtered_count: 0,
      retrieval_degraded_reason: null,
      synthesis_result_reason: null,
    }));
    expect(events.at(-1)?.payload?.resultType).toBe("success");
    expect(applyOpenAiUsageMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      { input: 11, output: 22 },
      2,
    );
  });

  it("continues through partial retrieval failure", async () => {
    retrieveSourcesForBrandMock.mockResolvedValueOnce({
      sources: [source(), source({ url: "https://example.test/two" })],
      stats: {
        plannedQueries: 2,
        providerSearchesPlanned: 4,
        providerSearchesSucceeded: 3,
        providerSearchesFailed: 1,
        failures: [{ queryId: "q2", provider: "exa", reason: "exa_503" }],
      },
    });

    const { events } = await runAndCollect();
    expect(events.at(-1)).toMatchObject({ type: "done" });
    expect(events.find((event) => event.id === "sources" && event.status === "done")?.detail)
      .toContain("1 failed");
  });

  it("marks thin evidence as degraded in stream detail and telemetry", async () => {
    retrieveSourcesForBrandMock.mockResolvedValueOnce({
      sources: [source({ snippet: "thin" })],
      stats: {
        plannedQueries: 1,
        providerSearchesPlanned: 2,
        providerSearchesSucceeded: 1,
        providerSearchesFailed: 1,
        failures: [],
      },
    });

    const { events, insert } = await runAndCollect();
    expect(events.find((event) => event.id === "sources" && event.status === "done")?.detail)
      .toContain("thin_retrieval_evidence");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      retrieval_filtered_count: 1,
      retrieval_degraded_reason: "thin_retrieval_evidence",
    }));
  });

  it("carries degraded synthesis result through stream detail, payload, and telemetry", async () => {
    synthesizeWithOpenAIMock.mockResolvedValueOnce({
      payload,
      usage: { inputTokens: 33, outputTokens: 44 },
      provenance: {
        payload,
        resultType: "degraded",
        reason: "unsupported_relationships_removed",
        rejectedLinks: 2,
        rejectedNodes: 1,
        repairedLinks: 0,
        groundedEdgeCount: 3,
        passageEvidenceCount: 4,
      },
    });

    const { events, insert } = await runAndCollect();
    expect(events.find((event) => event.id === "synthesis" && event.status === "done")?.detail)
      .toContain("result: degraded (unsupported_relationships_removed)");
    expect(events.at(-1)?.payload?.resultType).toBe("degraded");
    expect(events.at(-1)?.payload?.resultReason).toBe("unsupported_relationships_removed");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      result_type: "degraded",
      synthesis_result_reason: "unsupported_relationships_removed",
      synthesis_rejected_links: 2,
      synthesis_rejected_nodes: 1,
      synthesis_grounded_edge_count: 3,
      synthesis_passage_evidence_count: 4,
    }));
  });

  it("falls back visibly when synthesis cannot produce a grounded graph", async () => {
    synthesizeWithOpenAIMock.mockRejectedValueOnce(new Error("below_grounded_graph_floor"));

    const { events, insert } = await runAndCollect();
    expect(events.find((event) => event.id === "synthesis" && event.status === "done")?.detail)
      .toContain("result: fallback (below_grounded_graph_floor)");
    expect(events.at(-1)?.payload?.resultType).toBe("fallback");
    expect(events.at(-1)?.payload?.resultReason).toBe("below_grounded_graph_floor");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      result_type: "fallback",
      synthesis_result_reason: "below_grounded_graph_floor",
    }));
  });
});
