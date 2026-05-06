import { describe, expect, it } from "vitest";

import type { SourceItem } from "@/lib/pipeline/models";
import { filterSourcesForQuality, SOURCE_REJECTION_REASONS } from "@/lib/pipeline/source-quality";

const longSnippet = Array.from({ length: 160 }, (_, index) => `token${index}`).join(" ");

const source = (overrides: Partial<SourceItem> = {}): SourceItem => ({
  query: "query",
  title: "Useful source",
  url: "https://example.test/source",
  snippet: longSnippet,
  provider: "tavily",
  ...overrides,
});

describe("filterSourcesForQuality", () => {
  it("keeps valid sources", () => {
    const result = filterSourcesForQuality([source()]);
    expect(result.usableSources).toHaveLength(1);
    expect(result.rejectedCounts.too_short).toBe(0);
  });

  it.each([
    ["missing_url", source({ url: "" })],
    ["missing_title", source({ title: "" })],
    ["bot_blocked", source({ snippet: `${longSnippet} verify you are human captcha` })],
    ["access_denied", source({ snippet: `${longSnippet} access denied` })],
    ["boilerplate_noise", source({ snippet: `${longSnippet} enable javascript accept cookies` })],
    ["too_short", source({ snippet: "thin snippet" })],
  ] as const)("rejects %s sources", (reason, item) => {
    const result = filterSourcesForQuality([item]);
    expect(result.usableSources).toHaveLength(0);
    expect(result.rejectedCounts[reason]).toBe(1);
    expect(result.safeSamples[0]).toMatchObject({ reason });
  });

  it("initializes every reason count", () => {
    const result = filterSourcesForQuality([]);
    expect(Object.keys(result.rejectedCounts).sort()).toEqual([...SOURCE_REJECTION_REASONS].sort());
  });
});
