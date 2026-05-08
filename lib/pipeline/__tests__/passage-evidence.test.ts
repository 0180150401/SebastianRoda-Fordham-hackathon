import { describe, expect, it } from "vitest";

import { buildPassageEvidence, buildSourceDocuments, formatEvidenceForSynthesis } from "../passage-evidence";
import type { SourceItem } from "../models";

const source = (overrides: Partial<SourceItem> = {}): SourceItem => ({
  sourceId: "src-custom",
  query: "Acme quiet luxury competitors",
  title: "Acme source",
  url: "https://example.test/acme",
  snippet: "Acme appears alongside tailored minimalism in discovery prompts.",
  provider: "exa",
  ...overrides,
});

describe("passage evidence", () => {
  it("builds source documents with stable source IDs", () => {
    expect(buildSourceDocuments([source()])[0]).toMatchObject({
      id: "src-custom",
      rank: 1,
      provider: "exa",
    });
    expect(buildSourceDocuments([source({ sourceId: undefined })])[0]?.id).toBe("src-01");
  });

  it("turns Exa highlights into deterministic passage evidence", () => {
    const evidence = buildPassageEvidence([
      source({
        passages: [
          { kind: "highlight", text: "Acme is frequently discussed with tailored minimalism and quiet luxury." },
          { kind: "text", text: "Longer Exa text says Acme overlaps with capsule wardrobe searches." },
        ],
      }),
    ]);

    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toMatchObject({
      id: "ev-01-01",
      sourceId: "src-custom",
      excerpt: "Acme is frequently discussed with tailored minimalism and quiet luxury.",
      aiResponse: "Acme is frequently discussed with tailored minimalism and quiet luxury.",
      provider: "exa",
    });
  });

  it("uses Tavily chunks and removes duplicate passages", () => {
    const evidence = buildPassageEvidence([
      source({
        provider: "tavily",
        passages: [
          { kind: "chunk", text: "Acme appears in capsule wardrobe and workwear searches." },
          { kind: "chunk", text: "Acme appears in capsule wardrobe and workwear searches." },
          { kind: "chunk", text: "Short" },
        ],
      }),
    ]);

    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.id).toBe("ev-01-01");
    expect(evidence[0]?.provider).toBe("tavily");
  });

  it("falls back to SourceItem snippet when no passages exist", () => {
    const evidence = buildPassageEvidence([
      source({
        passages: undefined,
        snippet: "Snippet fallback says Acme is compared with minimalist premium brands.",
      }),
    ]);

    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.excerpt).toBe("Snippet fallback says Acme is compared with minimalist premium brands.");
  });

  it("caps passage count and excerpt length", () => {
    const evidence = buildPassageEvidence([
      source({
        passages: [
          { kind: "highlight", text: "First sufficiently long Acme passage about quiet luxury overlap." },
          { kind: "highlight", text: "Second sufficiently long Acme passage about minimalist intent." },
        ],
      }),
    ], { maxPassages: 1, maxExcerptChars: 38 });

    expect(evidence).toHaveLength(1);
    const first = evidence[0];
    expect(first?.excerpt?.length).toBeLessThanOrEqual(38);
    expect(first?.excerpt?.endsWith("…")).toBe(true);
  });

  it("formats evidence for synthesis with passage and source IDs", () => {
    const text = formatEvidenceForSynthesis(buildPassageEvidence([
      source({ passages: [{ kind: "highlight", text: "Acme overlaps with quiet luxury and tailoring searches." }] }),
    ]));

    expect(text).toContain("[ev-01-01]");
    expect(text).toContain("sourceId: src-custom");
    expect(text).toContain("excerpt:");
  });
});
