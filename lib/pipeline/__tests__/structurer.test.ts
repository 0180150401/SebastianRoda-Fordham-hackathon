import { describe, expect, it } from "vitest";

import { buildFallback, extractJsonObject } from "../structurer";
import type { SourceItem } from "../models";

describe("structurer", () => {
  it("extracts a JSON object from model text with surrounding prose", () => {
    expect(extractJsonObject('prefix {"nodes":[],"links":[]} suffix')).toBe(
      '{"nodes":[],"links":[]}',
    );
  });

  it("builds a grounded fallback payload from sources", () => {
    const sources: SourceItem[] = [
      {
        query: "Acme quiet luxury competitors",
        title: "Acme gains traction",
        url: "https://example.org/acme",
        snippet: "Acme appears alongside luxury basics and tailored minimalism.",
        published: "2026-05-01",
        provider: "tavily",
      },
    ];

    const payload = buildFallback("Acme", sources);

    expect(payload.nodes.find((node) => node.id === "brand-core")?.label).toBe("Acme");
    expect(payload.evidence[0]).toMatchObject({
      query: sources[0].query,
      sourceTitle: sources[0].title,
      sourceUrl: sources[0].url,
    });
    expect(payload.links.length).toBeGreaterThan(0);
    expect(payload.modelStrength.observed).toBeGreaterThan(0);
  });
});
