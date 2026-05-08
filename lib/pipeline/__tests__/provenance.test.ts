import { describe, expect, it } from "vitest";

import type { Evidence, GraphLink, GraphNode, SemanticUniversePayload } from "../models";
import { validateGraphProvenance } from "../provenance";

const evidence: Evidence[] = [
  {
    id: "ev-01-01",
    sourceId: "src-01",
    query: "Acme quiet luxury",
    aiResponse: "Acme is mentioned with quiet luxury tailoring.",
    excerpt: "Acme is mentioned with quiet luxury tailoring.",
    sourceTitle: "Quiet source",
    sourceUrl: "https://example.test/quiet",
    coOccurrence: 70,
    timestamp: "2026-05-01",
  },
  {
    id: "ev-02-01",
    sourceId: "src-02",
    query: "Acme capsule wardrobe",
    aiResponse: "Capsule wardrobe searches include Acme and minimalist basics.",
    excerpt: "Capsule wardrobe searches include Acme and minimalist basics.",
    sourceTitle: "Capsule source",
    sourceUrl: "https://example.test/capsule",
    coOccurrence: 64,
    timestamp: "2026-05-01",
  },
  {
    id: "ev-03-01",
    sourceId: "src-03",
    query: "Acme competitor gap",
    aiResponse: "Streetwear intent is dominated by competitor brands.",
    excerpt: "Streetwear intent is dominated by competitor brands.",
    sourceTitle: "Gap source",
    sourceUrl: "https://example.test/gap",
    coOccurrence: 50,
    timestamp: "2026-05-01",
  },
];

const nodes: GraphNode[] = [
  { id: "brand-core", label: "Acme", category: "brand", x: 0, y: 0, vx: 0, vy: 0, size: 20, anchorX: 0, anchorY: 0 },
  { id: "quiet-luxury", label: "Quiet luxury", category: "aesthetic", x: 1, y: 0, vx: 0, vy: 0, size: 10, anchorX: 1, anchorY: 0 },
  { id: "capsule", label: "Capsule wardrobe", category: "query", x: 2, y: 0, vx: 0, vy: 0, size: 10, anchorX: 2, anchorY: 0 },
  { id: "gap", label: "Streetwear gap", category: "gap", x: 3, y: 0, vx: 0, vy: 0, size: 10, anchorX: 3, anchorY: 0 },
];

function link(overrides: Partial<GraphLink>): GraphLink {
  return {
    id: "l-test",
    source: "brand-core",
    target: "quiet-luxury",
    weight: 0.7,
    sourceIds: [],
    evidenceIds: ["ev-01-01"],
    ...overrides,
  };
}

function payload(overrides: Partial<SemanticUniversePayload> = {}): SemanticUniversePayload {
  return {
    nodes,
    links: [
      link({ id: "l-quiet", target: "quiet-luxury", evidenceIds: ["ev-01-01"], sourceIds: [] }),
      link({ id: "l-capsule", target: "capsule", evidenceIds: ["ev-02-01"], sourceIds: [] }),
      link({ id: "l-gap", target: "gap", evidenceIds: ["ev-03-01"], sourceIds: [] }),
    ],
    evidence,
    semanticDiscourse: [],
    visualCorrelations: [],
    modelStrength: { score: 0, strong: 0, observed: 0, models: [] },
    ...overrides,
  };
}

describe("validateGraphProvenance", () => {
  it("passes grounded links and derives sourceIds from evidence", () => {
    const result = validateGraphProvenance(payload());

    expect(result.resultType).toBe("success");
    expect(result.groundedEdgeCount).toBe(3);
    expect(result.payload.links.map((item) => item.sourceIds)).toEqual([
      ["src-01"],
      ["src-02"],
      ["src-03"],
    ]);
    expect(result.payload.nodes.find((node) => node.id === "quiet-luxury")?.evidenceIds).toEqual(["ev-01-01"]);
  });

  it("repairs an unsupported link once using lexical overlap", () => {
    const result = validateGraphProvenance(payload({
      links: [
        link({ id: "l-quiet", target: "quiet-luxury", evidenceIds: [], sourceIds: [] }),
        link({ id: "l-capsule", target: "capsule", evidenceIds: ["ev-02-01"], sourceIds: [] }),
        link({ id: "l-gap", target: "gap", evidenceIds: ["ev-03-01"], sourceIds: [] }),
      ],
    }));

    expect(result.resultType).toBe("degraded");
    expect(result.reason).toBe("unsupported_relationships_repaired");
    expect(result.repairedLinks).toBe(1);
    expect(result.payload.links.find((item) => item.id === "l-quiet")?.evidenceIds).toEqual(["ev-01-01"]);
  });

  it("rejects unsupported links that cannot be repaired", () => {
    const result = validateGraphProvenance(payload({
      nodes: [...nodes, { id: "avant", label: "Avant garde", category: "aesthetic", x: 4, y: 0, vx: 0, vy: 0, size: 10, anchorX: 4, anchorY: 0 }],
      links: [
        link({ id: "l-unsupported", target: "avant", dominantCompetitor: "zzzz", evidenceIds: [], sourceIds: [] }),
      ],
    }), { minimumNodes: 1, minimumGroundedEdges: 0, minimumEvidence: 1 });

    expect(result.resultType).toBe("degraded");
    expect(result.reason).toBe("unsupported_relationships_removed");
    expect(result.rejectedLinks).toBeGreaterThan(0);
    expect(result.payload.links).toHaveLength(0);
  });

  it("rejects unsupported non-brand nodes and attached links", () => {
    const result = validateGraphProvenance(payload({
      nodes: [...nodes, { id: "orphan", label: "Orphan", category: "aesthetic", x: 4, y: 0, vx: 0, vy: 0, size: 10, anchorX: 4, anchorY: 0 }],
    }));

    expect(result.resultType).toBe("degraded");
    expect(result.rejectedNodes).toBe(1);
    expect(result.payload.nodes.some((node) => node.id === "orphan")).toBe(false);
  });

  it("falls back below the grounded graph floor", () => {
    const result = validateGraphProvenance(payload({
      links: [link({ id: "l-quiet", target: "quiet-luxury", evidenceIds: ["ev-01-01"], sourceIds: [] })],
      evidence: evidence.slice(0, 1),
    }));

    expect(result.resultType).toBe("fallback");
    expect(result.reason).toBe("below_grounded_graph_floor");
  });
});
