import { describe, expect, it } from "vitest";
import { createNdjsonParser, NdjsonParseError, parseNdjsonEvents } from "@/lib/pipeline/ndjson";
import { MAX_NDJSON_LINE_BYTES, pipelineEventSchema, STEP_IDS, STEP_STATUSES } from "@/lib/pipeline/types";

const j = (o: unknown) => JSON.stringify(o);

describe("PipelineEvent contract — variant coverage", () => {
  for (const id of STEP_IDS) {
    for (const status of STEP_STATUSES) {
      it(`parses step id=${id} status=${status}`, () => {
        const line = j({ type: "step", id, status }) + "\n";
        const ev = parseNdjsonEvents([line]);
        expect(ev).toEqual([{ type: "step", id, status }]);
      });
    }
  }

  it("preserves detail on step", () => {
    const ev = parseNdjsonEvents([j({ type: "step", id: "sources", status: "running", detail: "ok" }) + "\n"]);
    expect(ev[0]).toEqual({ type: "step", id: "sources", status: "running", detail: "ok" });
  });

  it("parses done with payload", () => {
    const ev = parseNdjsonEvents([
      j({ type: "done", payload: { nodes: [], links: [] } }) + "\n",
    ]);
    expect(ev[0]?.type).toBe("done");
    if (ev[0]?.type === "done") {
      expect(ev[0].payload).toEqual({ nodes: [], links: [] });
    }
  });

  it("parses error", () => {
    const ev = parseNdjsonEvents([j({ type: "error", message: "boom" }) + "\n"]);
    expect(ev[0]).toEqual({ type: "error", message: "boom" });
  });

  it("parses run_meta with uuid run_id", () => {
    const runId = "550e8400-e29b-41d4-a716-446655440000";
    const ev = parseNdjsonEvents([j({ type: "run_meta", run_id: runId }) + "\n"]);
    expect(ev[0]).toEqual({ type: "run_meta", run_id: runId });
    expect(pipelineEventSchema.safeParse(ev[0]).success).toBe(true);
  });
});

describe("Chunk-splitting invariance (STREAM-02)", () => {
  const e1 = { type: "step" as const, id: "sources" as const, status: "running" as const };
  const e2 = { type: "step" as const, id: "synthesis" as const, status: "done" as const };
  const e3 = { type: "error" as const, message: "z" };
  const s = `${j(e1)}\n${j(e2)}\n\n${j(e3)}\n`;

  const full = parseNdjsonEvents([s]);

  const splitIndices = [0, 1, 5, Math.floor(s.length / 2), s.length - 1].filter(
    (i) => i >= 0 && i <= s.length,
  );

  for (const i of splitIndices) {
    it(`split at ${i} matches single chunk`, () => {
      const split = parseNdjsonEvents([s.slice(0, i), s.slice(i)]);
      expect(split).toEqual(full);
    });
  }
});

describe("Fail-fast (D-01)", () => {
  it("throws on invalid JSON between valid lines", () => {
    const a = j({ type: "step", id: "sources", status: "running" }) + "\n";
    const bad = "{this is not json\n";
    const c = j({ type: "step", id: "sources", status: "done" }) + "\n";
    expect(() => parseNdjsonEvents([a + bad + c])).toThrow(NdjsonParseError);
  });

  it("throws on schema mismatch (missing status)", () => {
    const line = '{"type":"step","id":"sources"}\n';
    expect(() => parseNdjsonEvents([line])).toThrow(NdjsonParseError);
  });

  it("throws on unknown discriminator", () => {
    const line = '{"type":"unknown_kind"}\n';
    expect(() => parseNdjsonEvents([line])).toThrow(NdjsonParseError);
  });

  it("throws on oversize line", () => {
    const big = `${"a".repeat(MAX_NDJSON_LINE_BYTES + 1)}\n`;
    expect(() => parseNdjsonEvents([big])).toThrow(NdjsonParseError);
  });

  it("throws on trailing non-empty buffer at end()", () => {
    const p = createNdjsonParser();
    p.pushChunk(j({ type: "step", id: "sources", status: "running" }));
    expect(() => p.end()).toThrow(NdjsonParseError);
  });

  it("tolerates blank lines between events", () => {
    const a = j({ type: "step", id: "sources", status: "running" });
    const b = j({ type: "step", id: "sources", status: "done" });
    const ev = parseNdjsonEvents([`${a}\n\n\n${b}\n`]);
    expect(ev).toHaveLength(2);
  });
});

describe("Server-shape parity", () => {
  const literals = [
    { type: "step" as const, id: "sources" as const, status: "running" as const },
    { type: "step" as const, id: "sources" as const, status: "done" as const, detail: "3 sources collected" },
    { type: "step" as const, id: "synthesis" as const, status: "running" as const },
    { type: "step" as const, id: "synthesis" as const, status: "done" as const },
    { type: "step" as const, id: "images" as const, status: "running" as const },
    { type: "step" as const, id: "images" as const, status: "done" as const },
    { type: "done" as const, payload: {} },
    { type: "error" as const, message: "x" },
  ] as const;

  for (const lit of literals) {
    it(`schema accepts literal: ${lit.type} ${"id" in lit ? lit.id : ""}`.trim(), () => {
      expect(pipelineEventSchema.safeParse(JSON.parse(j(lit))).success).toBe(true);
    });
  }
});
