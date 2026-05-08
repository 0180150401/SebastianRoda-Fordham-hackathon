# Phase 5 Pattern Map: Graph Synthesis Quality & Provenance

**Generated:** 2026-05-08
**Status:** Planner input

## Data Contract Anchors

- `lib/pipeline/models.ts` owns graph, evidence, source, and final payload types. Phase 5 should evolve these types additively so existing UI reads of `evidenceIds` and `aiResponse` continue working.
- `lib/pipeline/types.ts` owns zod-validated NDJSON event contracts. Phase 5 should extend `done` payload validation only if it can remain generic-safe; otherwise contract tests should validate the server payload literals.
- `app/tool/page.tsx` currently mirrors the server payload types locally. Any server model additions that the UI consumes need matching local type updates.

## Retrieval And Passage Anchors

- `lib/pipeline/retriever.ts` already requests Exa `contents.highlights` and `contents.text`, but collapses them into `SourceItem.snippet`.
- Tavily results currently map `content` into `SourceItem.snippet` and use `search_depth: "advanced"`. Phase 5 can add `chunks_per_source` and preserve `content` as passage candidates without adding a new page-fetch pass.
- `lib/pipeline/source-quality.ts` filters before ranking; passage extraction should use the ranked usable sources after Phase 4's retrieval quality gate.

## Synthesis And Validation Anchors

- `lib/pipeline/structurer.ts` already contains `sanitizeEvidenceUrl`, `buildFallback`, `normalizeModelPayload`, competitor mining, fallback graph generation, and prompt construction.
- Existing normalization filters unknown `evidenceIds` and does limited fallback repair for missing link evidence. Phase 5 should move stricter grounding rules into a dedicated `lib/pipeline/provenance.ts` helper rather than growing `structurer.ts` further.
- `lib/pipeline/__tests__/structurer.test.ts` has lightweight fallback coverage; Phase 5 should add focused provenance fixtures instead of live OpenAI tests.

## Stream And UI Anchors

- `lib/pipeline/stream-handler.ts` already tracks `result_type: "success" | "fallback"` and persists it to `semantic_pipeline_runs`.
- Supabase migration `20260506200000_observability_tables.sql` constrains `result_type` to `success`, `fallback`, or `error`; Phase 5 needs a migration before telemetry can write `degraded`.
- `app/tool/page.tsx` already has trace/progress surfaces and an evidence explorer. Phase 5 should add a compact run status indicator, not a new evidence panel.

## Test Anchors

- `lib/pipeline/__tests__/pipeline.contract.test.ts` is the strict NDJSON contract oracle.
- `lib/pipeline/__tests__/stream-handler.test.ts` mocks retrieval, synthesis, enrichment, telemetry, and usage. It is the right place to verify result type propagation and degraded telemetry.
- `lib/pipeline/__tests__/structurer.test.ts` or a new `provenance.test.ts` should cover passage extraction, repair, rejection, and fallback floor behavior.

