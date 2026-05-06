import { describe, expect, it, vi } from "vitest";

import type { SourceItem } from "@/lib/pipeline/models";
import {
  rerankSourcesWithVoyage,
  scoreSourcesForSynthesis,
} from "@/lib/pipeline/scorer";

const source = (index: number, overrides: Partial<SourceItem> = {}): SourceItem => ({
  query: `query ${index}`,
  title: `Source ${index}`,
  url: `https://example.test/source-${index}`,
  snippet: `Snippet ${index}`,
  provider: index % 2 === 0 ? "tavily" : "exa",
  ...overrides,
});

describe("scoreSourcesForSynthesis", () => {
  it("returns the existing source order truncated to topN when no API key is provided", async () => {
    const sources = [source(1), source(2), source(3)];

    await expect(
      scoreSourcesForSynthesis(sources, "Acme", { topN: 2 }),
    ).resolves.toEqual([sources[0], sources[1]]);

    expect(sources).toEqual([source(1), source(2), source(3)]);
  });
});

describe("rerankSourcesWithVoyage", () => {
  it("maps Voyage result indices back to sources and preserves input order for ties", async () => {
    const sources = [source(1), source(2), source(3), source(4)];
    const rerank = vi.fn(async () => ({
      data: [
        { index: 2, relevanceScore: 0.92 },
        { index: 1, relevanceScore: 0.75 },
        { index: 0, relevanceScore: 0.75 },
      ],
    }));

    const ranked = await rerankSourcesWithVoyage(sources, "Acme", { rerank }, { topN: 3 });

    expect(ranked).toEqual([sources[2], sources[0], sources[1]]);
    expect(rerank).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "Acme semantic brand universe competitive intent",
        model: "rerank-2.5",
        topK: 3,
        documents: expect.arrayContaining([
          expect.stringContaining("Source 1"),
          expect.stringContaining("Snippet 4"),
        ]),
      }),
      expect.objectContaining({
        timeoutInSeconds: 8,
        maxRetries: 0,
      }),
    );
  });
});
