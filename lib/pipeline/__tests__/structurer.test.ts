import { describe, expect, it } from "vitest";

import { buildFallback, extractJsonObject, synthesizeWithOpenAI } from "../structurer";
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
    expect(payload.links.every((link) => link.evidenceIds.length > 0)).toBe(true);
    expect(payload.links.every((link) => link.sourceIds.length > 0)).toBe(true);
    expect(payload.evidence[0]?.sourceId).toBeTruthy();
    expect(payload.evidence[0]?.excerpt).toBeTruthy();
    expect(payload.modelStrength.observed).toBeGreaterThan(0);
  });

  it("preserves trusted passage evidence IDs during synthesis normalization", async () => {
    const sources: SourceItem[] = [
      {
        sourceId: "src-acme",
        query: "Acme quiet luxury competitors",
        title: "Acme gains traction",
        url: "https://example.org/acme",
        snippet: "Acme appears alongside quiet luxury and capsule wardrobe searches.",
        provider: "exa",
        passages: [
          { kind: "highlight", text: "Acme appears alongside quiet luxury and capsule wardrobe searches." },
          { kind: "highlight", text: "Capsule wardrobe searches mention Acme as a minimalist option." },
          { kind: "highlight", text: "Streetwear intent is a gap where competitors dominate Acme." },
        ],
      },
    ];
    const openai = {
      chat: {
        completions: {
          create: async () => ({
            usage: { prompt_tokens: 10, completion_tokens: 20 },
            choices: [{
              message: {
                content: JSON.stringify({
                  nodes: [
                    { id: "brand-core", label: "Acme", category: "brand" },
                    { id: "quiet-luxury", label: "Quiet luxury", category: "aesthetic", evidenceIds: ["ev-01-01"] },
                    { id: "capsule", label: "Capsule wardrobe", category: "query", evidenceIds: ["ev-01-02"] },
                    { id: "gap", label: "Streetwear gap", category: "gap", evidenceIds: ["ev-01-03"] },
                  ],
                  links: [
                    { id: "l-quiet", source: "brand-core", target: "quiet-luxury", weight: 0.8, sourceIds: ["src-acme"], evidenceIds: ["ev-01-01"] },
                    { id: "l-capsule", source: "brand-core", target: "capsule", weight: 0.7, sourceIds: ["src-acme"], evidenceIds: ["ev-01-02"] },
                    { id: "l-gap", source: "brand-core", target: "gap", weight: 0.3, sourceIds: ["src-acme"], evidenceIds: ["ev-01-03"], missing: true },
                  ],
                  evidence: [{ id: "invented", aiResponse: "ignore me" }],
                  semanticDiscourse: [],
                  visualCorrelations: [],
                }),
              },
            }],
          }),
        },
      },
    };

    const result = await synthesizeWithOpenAI("Acme", sources, openai as never, []);

    expect(result.provenance.resultType).toBe("success");
    expect(result.payload.evidence.map((entry) => entry.id)).toEqual(["ev-01-01", "ev-01-02", "ev-01-03"]);
    expect(result.payload.links.every((link) => link.sourceIds.includes("src-acme"))).toBe(true);
  });
});
