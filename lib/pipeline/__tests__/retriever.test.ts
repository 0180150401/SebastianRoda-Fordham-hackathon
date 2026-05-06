import { afterEach, describe, expect, it, vi } from "vitest";

import type { SourceItem } from "@/lib/pipeline/models";
import { dedupeByUrl, retrieveSourcesForBrand } from "@/lib/pipeline/retriever";
import { buildFallbackQueryPlan, getRetrievalLimits } from "@/lib/pipeline/query-planner";

const source = (overrides: Partial<SourceItem>): SourceItem => ({
  query: "query",
  title: "title",
  url: "https://example.test/source",
  snippet: "snippet",
  provider: "tavily",
  ...overrides,
});

describe("dedupeByUrl", () => {
  it("collapses duplicate URLs while preserving first-seen order", () => {
    const items = [
      source({ title: "first", url: "https://example.test/a" }),
      source({ title: "duplicate", url: "https://example.test/a", provider: "exa" }),
      source({ title: "second", url: "https://example.test/b", provider: "exa" }),
    ];

    expect(dedupeByUrl(items)).toEqual([items[0], items[2]]);
  });
});

describe("retrieveSourcesForBrand", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges Tavily and Exa results, dedupes by URL, and caps output at 18", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "https://api.tavily.com/search") {
          return Response.json({
            results: Array.from({ length: 4 }, (_, index) => ({
              title: `Tavily ${index}`,
              url: `https://example.test/tavily-${crypto.randomUUID()}`,
              content: `Tavily snippet ${index}`,
              published_date: "2026-05-06",
            })),
          });
        }
        if (url === "https://api.exa.ai/search") {
          return Response.json({
            results: Array.from({ length: 4 }, (_, index) => ({
              title: `Exa ${index}`,
              url: `https://example.test/exa-${crypto.randomUUID()}`,
              text: `Exa snippet ${index}`,
              publishedDate: "2026-05-06",
            })),
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const results = await retrieveSourcesForBrand("Acme", {
      tavilyKey: "tavily-test-key",
      exaKey: "exa-test-key",
    });

    expect(results).toHaveLength(18);
    expect(results.some((item) => item.provider === "tavily")).toBe(true);
    expect(results.some((item) => item.provider === "exa")).toBe(true);
  });

  it("returns partial planned results when one provider query fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://api.tavily.com/search") {
        return new Response(null, { status: 503 });
      }
      if (url === "https://api.exa.ai/search") {
        return Response.json({
          results: [{
            title: "Exa success",
            url: "https://example.test/exa-success",
            contents: { text: "Exa useful text" },
            publishedDate: "2026-05-06",
          }],
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const plan = buildFallbackQueryPlan("Acme", { limits: getRetrievalLimits({}) });

    const result = await retrieveSourcesForBrand("Acme", {
      tavilyKey: "tavily-test-key",
      exaKey: "exa-test-key",
      queryPlan: plan,
      limits: { ...getRetrievalLimits({}), maxProviderSearchesPerProvider: 1 },
    });

    expect(result.sources).toHaveLength(1);
    expect(result.stats.providerSearchesPlanned).toBe(2);
    expect(result.stats.providerSearchesSucceeded).toBe(1);
    expect(result.stats.providerSearchesFailed).toBe(1);
    expect(result.stats.failures[0]).toMatchObject({ provider: "tavily" });
  });

  it("enforces provider search caps and uses current Exa contents shape", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.tavily.com/search") {
        return Response.json({ results: [] });
      }
      if (url === "https://api.exa.ai/search") {
        expect(JSON.stringify(init?.body)).toContain("contents");
        expect(JSON.stringify(init?.body)).not.toContain("useAuto" + "prompt");
        return Response.json({ results: [] });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const plan = buildFallbackQueryPlan("Acme", { limits: getRetrievalLimits({}) });

    await retrieveSourcesForBrand("Acme", {
      tavilyKey: "tavily-test-key",
      exaKey: "exa-test-key",
      queryPlan: plan,
      limits: { ...getRetrievalLimits({}), maxProviderSearchesPerProvider: 1 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("records timeout failures without throwing the whole retrieval stage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }));
    const plan = buildFallbackQueryPlan("Acme", { limits: getRetrievalLimits({}) });

    const result = await retrieveSourcesForBrand("Acme", {
      tavilyKey: "tavily-test-key",
      exaKey: "exa-test-key",
      queryPlan: plan,
      limits: { ...getRetrievalLimits({}), maxProviderSearchesPerProvider: 1 },
    });

    expect(result.sources).toEqual([]);
    expect(result.stats.providerSearchesFailed).toBe(2);
    expect(result.stats.failures.every((failure) => failure.reason === "timeout")).toBe(true);
  });
});
