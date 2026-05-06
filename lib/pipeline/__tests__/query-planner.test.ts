import { describe, expect, it } from "vitest";

import {
  buildFallbackQueryPlan,
  getRetrievalLimits,
  planRetrievalQueries,
} from "@/lib/pipeline/query-planner";

describe("getRetrievalLimits", () => {
  it("uses the locked Phase 4 defaults", () => {
    expect(getRetrievalLimits({})).toEqual({
      minQueries: 5,
      maxQueries: 12,
      maxProviderSearchesPerProvider: 8,
      providerTimeoutMs: 8000,
      totalRetrievalBudgetMs: 45000,
      minimumUsableSources: 6,
    });
  });

  it("clamps unsafe env overrides", () => {
    expect(getRetrievalLimits({
      SEMANTIC_RETRIEVAL_MIN_QUERIES: "1",
      SEMANTIC_RETRIEVAL_MAX_QUERIES: "99",
      SEMANTIC_RETRIEVAL_MAX_PROVIDER_SEARCHES: "50",
      SEMANTIC_RETRIEVAL_PROVIDER_TIMEOUT_MS: "999999",
      SEMANTIC_RETRIEVAL_TOTAL_BUDGET_MS: "999999",
      SEMANTIC_RETRIEVAL_MIN_USABLE_SOURCES: "-2",
    })).toEqual({
      minQueries: 5,
      maxQueries: 12,
      maxProviderSearchesPerProvider: 8,
      providerTimeoutMs: 8000,
      totalRetrievalBudgetMs: 45000,
      minimumUsableSources: 6,
    });
  });
});

describe("buildFallbackQueryPlan", () => {
  it("returns adaptive bounded queries with coverage and recency", () => {
    const plan = buildFallbackQueryPlan("Acme", {
      runId: "run-1",
      limits: getRetrievalLimits({}),
    });

    expect(plan.type).toBe("query_plan");
    expect(plan.queries.length).toBeGreaterThanOrEqual(5);
    expect(plan.queries.length).toBeLessThanOrEqual(12);
    expect(plan.queries.every((query) => query.searchPhrase.includes("Acme"))).toBe(true);
    expect(new Set(plan.queries.map((query) => query.category))).toEqual(new Set([
      "competitors",
      "adjacent_categories",
      "partners_ecosystem",
      "customer_segments",
      "claims_positioning",
      "risks_controversies",
      "recent_signals",
      "category_language",
    ]));
    const bounded = plan.queries.filter((query) => query.recency === "bounded");
    expect(bounded.length).toBeGreaterThanOrEqual(1);
    expect(bounded.length).toBeLessThanOrEqual(2);
  });
});

describe("planRetrievalQueries", () => {
  it("falls back when OpenAI output is malformed", async () => {
    const plan = await planRetrievalQueries("Acme", {
      runId: "run-2",
      openai: {
        chat: {
          completions: {
            create: async () => ({ choices: [{ message: { content: "{\"type\":\"query_plan\"}" } }] }),
          },
        },
      } as never,
      limits: getRetrievalLimits({}),
    });

    expect(plan.queries).toHaveLength(8);
    expect(plan.display.summary).toContain("8");
  });
});
