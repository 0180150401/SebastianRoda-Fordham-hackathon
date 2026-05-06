import { afterEach, describe, expect, it, vi } from "vitest";

import type { SourceItem } from "@/lib/pipeline/models";
import { dedupeByUrl, retrieveSourcesForBrand } from "@/lib/pipeline/retriever";

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
    expect(results.slice(0, 12).every((item) => item.provider === "tavily")).toBe(true);
    expect(results.slice(12).every((item) => item.provider === "exa")).toBe(true);
  });
});
