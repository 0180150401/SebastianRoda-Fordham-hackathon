# Phase 4 Research — Multi-stage retrieval & query planner

**Phase:** 04  
**Date:** 2026-05-06  
**Scope:** Research needed to plan structured query generation, multi-sub-query Tavily/Exa fanout, source quality filtering, `query_plan` stream contract, and safe degradation.

---

## Summary

| Topic | Finding |
|-------|---------|
| Query decomposition | Use an LLM to produce structured sub-queries, then retrieve per sub-query, merge candidates, and rerank. This is a practical drop-in pattern with evidence from question-decomposition RAG research. |
| Breadth-first anchoring | Phase 4 should emulate the **coverage-first** half of PAR2-RAG: build a broad evidence frontier before committing to synthesis. Do not implement PAR2-RAG's iterative depth/refinement loop in this phase because CONTEXT.md explicitly defers adaptive rescue loops. |
| Adaptive caps | Use adaptive breadth inside hard caps. Adaptive-RAG supports the general design principle that retrieval strategy should vary with query complexity, but Phase 4 can implement this as a deterministic count heuristic rather than training a classifier. |
| Provider usage | Tavily supports `topic`, `time_range`, `days`, `max_results`, `search_depth`, and raw content controls; Exa supports `contents.highlights` and warns that current search API content fields must be nested under `contents`. Use provider-specific request builders behind a shared query object schema. |
| Rerank placement | Keep Phase 3's Voyage rerank after merge/dedupe and Phase 4 quality filtering. Voyage `rerank-2.5` accepts up to 1,000 docs and has large token limits, but Phase 4 should stay far below that with existing `topN: 18`. |
| Stream contract | Extend `PipelineEvent` with `query_plan`, zod schema, contract tests, and hook/client handling. Use OpenAI structured outputs or strict JSON schema parsing for the planner object so server emits stable typed events. |
| Safety | Add timeouts at each provider request. Phase 3 review already found provider calls can hang; Phase 4 fanout multiplies that risk if not fixed first. |

---

## Recommended Architecture

```text
brand
  -> planRetrievalQueries(brand, context)
       returns QueryPlan { queries[], display }
  -> emit query_plan
  -> executePlannedRetrieval(queryPlan, providerKeys, limits)
       Tavily/Exa per query with per-request timeout + isolated failures
  -> merge/dedupe candidates
  -> filterSourcesForQuality(candidates)
       returns usableSources + rejectedCounts + safe reason samples
  -> scoreSourcesForSynthesis(usableSources, brand)
  -> synthesizeWithOpenAI(...)
```

### Suggested files

| File | Purpose |
|------|---------|
| `lib/pipeline/query-planner.ts` | Structured query object schema, planner prompt, OpenAI structured output parsing, adaptive query-count heuristic. |
| `lib/pipeline/source-quality.ts` | Deterministic quality filter with reason codes and counters. |
| `lib/pipeline/retriever.ts` | Refactor existing provider helpers to accept planned query objects and per-request timeout signals. Keep `dedupeByUrl`. |
| `lib/pipeline/stream-handler.ts` | Emit `query_plan`, call planner/fanout/filter/scorer, write aggregate `sources` detail and telemetry fields. |
| `lib/pipeline/types.ts` | Add typed `query_plan` event and extend contract tests. |
| `hooks/use-semantic-universe-stream.ts` / `app/tool/page.tsx` | Preserve friendly query-plan summary in existing trace/progress UI. |

---

## Query Object Shape

Planner should produce objects like:

```ts
type RetrievalQueryObject = {
  id: string; // stable within run, e.g. q1_competitors
  label: string; // user-facing, safe: "Competitive set"
  intent: string; // planner-readable objective
  searchPhrase: string; // provider query, not primary UI copy
  category:
    | "competitors"
    | "adjacent_categories"
    | "partners_ecosystem"
    | "customer_segments"
    | "claims_positioning"
    | "risks_controversies"
    | "recent_signals"
    | "category_language";
  recency: "none" | "bounded";
  providers: Array<"tavily" | "exa">;
  successCriteria: string;
};
```

The `query_plan` event should include both internal objects and sanitized display fields:

```ts
type QueryPlanEvent = {
  type: "query_plan";
  plan_id: string;
  display: {
    title: string;
    summary: string;
    items: Array<{ id: string; label: string; intent: string }>;
  };
  queries: RetrievalQueryObject[];
};
```

Keep `display.items[].intent` friendly and non-technical. Raw `searchPhrase` is useful for tests/debugging but should not be the main UI text.

---

## Source Findings

### Query decomposition + reranking

The ACL SRW 2025 question-decomposition paper proposes a simple RAG sequence: decompose the original query into sub-questions, retrieve per sub-question, then rerank the merged candidate pool. That maps closely to Phase 4 plus Phase 3's Voyage scorer. Reported gains are on QA benchmarks, not brand-graph generation, so treat them as directional evidence rather than a product metric guarantee.

**Planning implication:** Create an explicit planner module and keep reranking downstream of merge/filter. Do not let synthesis invent search coverage from a single broad retrieval pass.

Source: https://arxiv.org/abs/2507.00355

### PAR2-RAG and breadth-first anchoring

PAR2-RAG separates broad evidence coverage from later reasoning commitment: first build a high-recall evidence frontier, then refine depth-first with sufficiency checks. Phase 4 should adopt only the first idea: broad, planned coverage before synthesis. Its iterative refinement loop conflicts with the locked Phase 4 decision to avoid adaptive rescue/expansion loops.

**Planning implication:** Use the competitive-universe category spread as a coverage frontier. Emit the plan before retrieval so the user can see this breadth.

Source: https://arxiv.org/abs/2603.29085

### Adaptive retrieval

Adaptive-RAG argues that one-size-fits-all retrieval is inefficient: simple queries do not need multi-step retrieval, while complex queries may need more retrieval. Phase 4 can implement this without a trained classifier: use deterministic heuristics to choose 5-12 query objects based on brand string ambiguity, category breadth, and whether recency is needed.

**Planning implication:** Keep adaptive query count inside the locked caps. Planner should document why it chose fewer or more objects in internal metadata.

Source: https://aclanthology.org/2024.naacl-long.389/

### Tavily provider behavior

Tavily Search supports `topic` (`general`, `news`, `finance`), `search_depth`, `chunks_per_source`, `max_results`, time filters, raw content, images, domain include/exclude lists, and `auto_parameters`. Tavily notes that raw content can increase latency and advanced search can cost more credits.

**Planning implication:** Use `topic: "news"` and date/time settings only for bounded recency query objects. Keep raw content off unless a later plan explicitly needs it; rely on snippets/chunks for Phase 4 quality filtering.

Source: https://docs.tavily.com/documentation/api-reference/endpoint/search

### Exa provider behavior

Exa's docs emphasize `contents.highlights` for token-efficient result excerpts, and current Search API guidance says `text`, `highlights`, and `summary` must be nested under `contents`. The docs also warn that `useAutoprompt` is deprecated in coding-agent guidance.

**Planning implication:** Phase 4 should remove the current `useAutoprompt: true` from `retriever.ts` and request `contents.highlights` or bounded `contents.text` instead. Avoid deprecated parameters while refactoring the provider layer.

Sources:
- https://exa.ai/docs/reference/search-api-guide
- https://exa.ai/docs/reference/search-api-guide-for-coding-agents

### Voyage rerank constraints

Voyage's rerank endpoint accepts a query and document list and returns ranked indices/scores. `rerank-2.5` is a recommended model and supports up to 1,000 documents, but Phase 4 should continue feeding a compact usable-source set into Phase 3's existing `topN: 18` scorer path.

**Planning implication:** Do not expand the post-filter source set just because Voyage allows more documents. The locked product goal is higher-signal evidence, not raw volume.

Source: https://docs.voyageai.com/reference/reranker-api

### OpenAI structured outputs

OpenAI's structured output documentation supports Zod-backed parsing in JavaScript. Phase 4 already uses zod for stream validation, so the planner should produce a zod-backed object and reject/repair invalid plans before retrieval.

**Planning implication:** Build planner output around a strict schema. If planner parsing fails, produce an error or fallback fixed plan rather than emitting malformed `query_plan`.

Source: https://developers.openai.com/api/docs/guides/structured-outputs

---

## Implementation Guidance for Planner

1. **Start with contract work.** Add `query_plan` to `lib/pipeline/types.ts`, `pipeline.contract.test.ts`, and `useSemanticUniverseStream` before changing retrieval behavior.
2. **Extract provider helpers carefully.** Existing `fetchTavily` and `fetchExa` are private and run three hard-coded queries each. Refactor them to accept query objects while preserving `SourceItem` output shape.
3. **Fix provider timeouts while adding fanout.** Current provider requests have no per-request timeout. Fanout without timeouts would multiply the Phase 3 review warning.
4. **Make quality filtering deterministic.** Implement reason-code tests for `too_short`, `bot_blocked`, `access_denied`, `missing_url`, `missing_title`, and `boilerplate_noise`.
5. **Use aggregate user feedback.** Emit one `query_plan` event, then `sources` details with planned/succeeded/failed/filtered/usable counts. Avoid per-query progress UI.
6. **Keep telemetry additive.** Existing `semantic_pipeline_runs` may not yet have columns for query counts and rejection reasons. Planner should decide whether Phase 4 writes JSON metadata to existing columns, adds migration columns, or records details in logs only. If schema changes are planned, include a Supabase migration and schema-push note.

---

## Risks & Mitigations

| Risk | Why it matters | Mitigation |
|------|----------------|------------|
| Topic drift from generated queries | LLM planners may broaden into generic category search that loses the brand. | Require every query object to include the brand and category-specific success criteria; unit-test planner fallback. |
| Cost/latency blow-up | 5-12 queries times 2 providers can create many requests. | Enforce env-configurable caps, per-request timeout, total retrieval budget, and no rescue loop. |
| Weak graph from thin evidence | Partial retrieval may pass too little evidence to synthesis. | Minimum viable evidence threshold, degraded result reason, fallback path, telemetry counts. |
| Bot-blocked/noisy content reaches LLM | Low-quality snippets can pollute graph edges. | Deterministic source-quality filter before scoring/synthesis. |
| Stream contract breakage | Client is fail-fast after Phase 1. | Add `query_plan` fixtures before server emission; keep zod schema and hook aligned. |
| Deprecated Exa request shape persists | Current code uses `useAutoprompt: true`; docs now warn against deprecated search parameters. | Update Exa request builder during retrieval refactor. |

---

## Validation Architecture

| Dimension | Approach |
|-----------|----------|
| Contract | Add `query_plan` fixture coverage to `lib/pipeline/__tests__/pipeline.contract.test.ts`; validate strict zod parsing. |
| Unit — planner | Test adaptive query count, required category spread, bounded recency count, fallback fixed plan, and schema rejection. |
| Unit — retriever | Mock `fetch`; verify per-query isolated failures, timeout behavior, aggregate counts, and provider request shapes. |
| Unit — quality filter | Table-driven reason-code tests for malformed, thin, bot-blocked, access-denied, and valid examples. |
| Unit — stream handler | Mock planner/retriever/scorer/structurer; assert event order: `run_meta` -> `query_plan` -> `sources running/done` -> `synthesis` -> `images` -> `done/error`. |
| Integration | `npm test` and `npx tsc --noEmit`; no live provider calls in CI. |
| Manual smoke | Run `/tool` with a known brand and confirm trace panel preserves friendly query plan and aggregate source counts. |

---

## Open Questions for Planning

1. What exact telemetry storage shape should hold query-plan counts and filtered reason summaries? Existing `semantic_pipeline_runs` may need migration columns or a JSON metadata column.
2. Should the planner call OpenAI using the existing traced client from Phase 2, or should planner usage be accounted separately in daily budget telemetry?
3. What exact minimum viable evidence floor should trigger degraded mode? Recommended starting point: at least 6 usable sources after filtering, with at least 2 provider/category buckets represented when possible.
4. Should Exa use `contents.highlights` only, or bounded `contents.text.maxCharacters` for quality filtering? Research leans highlights for token-efficient excerpts, but filter tests may be simpler with text.

---

## RESEARCH COMPLETE
