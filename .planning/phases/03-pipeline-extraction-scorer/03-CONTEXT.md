# Phase 3: Pipeline Extraction & Scorer - Context

**Gathered:** 2026-05-06  
**Status:** Ready for planning  
**Note:** Generated for `/gsd-plan-phase 3` without a prior discuss-session — locked decisions taken from `.planning/ROADMAP.md`, `.planning/research/ARCHITECTURE.md`, and `.planning/research/STACK.md`.

<domain>
## Phase Boundary

Decompose `app/api/semantic-universe/route.ts` into **`lib/pipeline/`** stage modules (**retriever**, **scorer**, **structurer**, **enricher**) with a **voyageai** reranking step **before** OpenAI synthesis; preserve NDJSON stream semantics and Phase 1 **`PipelineEvent`** contract (including **`run_meta`**). Post-refactor user-visible graph/output must remain equivalent — **Vitest contract suite** is the regression gate.

**Out of scope:** Multi-query planner / `query_plan` stream events (Phase 4), graph renderer migration (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Module layout (PIPE-01)
- **D-01:** Target files under `lib/pipeline/`: **`models.ts`** (shared domain types + constants such as `SourceItem`, graph/evidence types, `TRACKED_MODELS`), **`retriever.ts`** (Tavily + Exa + URL dedupe), **`scorer.ts`** (Voyage rerank + top-N cap before synthesis), **`structurer.ts`** (OpenAI synthesis, JSON repair, `buildFallback`, model normalization helpers), **`enricher.ts`** (image resolution / visual correlation enrichment), **`orchestrate.ts`** (ordered stage calls returning telemetry fields needed by route inserts). **Route** keeps auth, paywall, kill-switch, budget guards, stream envelope, `emitLine`, DB telemetry — **no business logic** for retrieval/scoring/synthesis/images.

### Voyage rerank (PIPE-02)
- **D-02:** Use npm package **`voyageai`** (research-approved) with model **`rerank-2.5`** (or current SDK default constant documented in code). Query text for reranking is the **brand string** plus minimal suffix matching today’s retrieval intent — planner picks exact `query` string; must be **deterministic** for tests.

### Degraded modes
- **D-03:** When **`VOYAGE_API_KEY`** is unset or rerank throws / exceeds timeout (**≤ 8s** wall-clock per call), **fall back** to current behavior: **dedupe-by-URL then slice first 18** sources in existing merge order — zero user-visible failure mode.

### Route size gate (roadmap SC1)
- **D-04:** **`export async function POST`** body (the async function only, excluding imports/other exports) must be **≤ 65 lines** including blanks — enforced by executor line-count script or manual checklist in verification.

### Testing (roadmap SC2 / SC4)
- **D-05:** Each new stage module gets **Vitest** coverage with **mocked `fetch` / mocked Voyage client** — no live keys in CI.

### Claude's Discretion
- Exact helper placement when split across files (internal `export function` vs `private`); whether **`cleanEnvValue`** moves to `lib/env.ts`; incremental vs single-shot extraction order inside a plan wave if conflicts arise.
- Optional adoption of **`exa-js`** SDK instead of raw Exa HTTP — **defer** unless trivial during retriever extraction.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning & requirements
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria PIPE-01/02
- `.planning/REQUIREMENTS.md` — PIPE-01, PIPE-02
- `.planning/research/ARCHITECTURE.md` — layer boundaries, recommended `lib/pipeline/*` layout
- `.planning/research/STACK.md` — `voyageai`, rerank-2.5 notes
- `.planning/phases/01-stream-contract-foundation-types/01-CONTEXT.md` — stream contract immutability expectations

### Implementation anchors
- `app/api/semantic-universe/route.ts` — current monolith to carve up
- `lib/pipeline/types.ts` — wire-format **`PipelineEvent`** (do not break discriminated union without updating client + tests)
- `lib/pipeline/__tests__/pipeline.contract.test.ts` — regression oracle

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1 **`pipelineEventSchema`** / hook consume loop — first streamed event may remain **`run_meta`** from route.

### Integration Points
- Telemetry inserts (`semantic_pipeline_runs`, `applyOpenAiUsage`) remain in route after stages return token counts + durations.

</code_context>

<specifics>
## Specific Ideas

Mirror ARCHITECTURE.md naming (`retriever`, `scorer`, `structurer`, `enricher`) even though roadmap SC lists three nouns — satisfies PIPE-01 “or equivalent” modularization.

</specifics>

<deferred>
## Deferred Ideas

- **`query_plan`** NDJSON event — Phase 4
- **exa-js** SDK migration — backlog unless free during Plan 03-01

</deferred>

---

*Phase: 03-pipeline-extraction-scorer*  
*Context gathered: 2026-05-06*
