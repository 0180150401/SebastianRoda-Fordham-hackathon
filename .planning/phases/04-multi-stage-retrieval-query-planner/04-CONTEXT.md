# Phase 4: Multi-Stage Retrieval & Query Planner - Context

**Gathered:** 2026-05-06
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Phase 4 adds a deliberate query-planning layer before retrieval: the system generates an adaptive set of structured search intents, runs multiple targeted retrieval sub-queries, filters low-quality candidates, and emits a `query_plan` stream event so users can see what the system looked for. It builds on the Phase 3 modular pipeline and must preserve the existing auth, budget, telemetry, typed NDJSON, scorer, synthesis, enrichment, and route-shell boundaries.

**In scope:** query planner output schema, `query_plan` event contract, multi-sub-query Tavily/Exa fanout, partial-failure handling, source quality filtering before Voyage scoring, aggregate stream/telemetry reporting.

**Out of scope:** adaptive multi-pass rescue loops, graph provenance schema changes (Phase 5), graph renderer/UI redesign (Phase 6), evidence panel UX (Phase 7), new providers beyond existing OpenAI/Tavily/Exa/Voyage.

</domain>

<decisions>
## Implementation Decisions

### Query Plan Shape
- **D-01:** The planner must generate **structured query objects**, not plain strings. Each object should have enough fields for planning, retrieval, debugging, tests, and sanitized display. Expected fields include a stable id, user-facing label, intent, search phrase(s), coverage category, recency flag, provider hints if useful, and success criteria.
- **D-02:** The planner targets an **adaptive 5-12 query objects per run**, with a normal target around 8. Narrow/simple brands may use fewer; ambiguous or broad brands may use more, but must stay inside the hard caps.
- **D-03:** Query objects should intentionally cover the **competitive universe**: competitors, adjacent categories, partners/ecosystem, customer segments, claims/positioning, risks or controversies, recent signals, and category language.
- **D-04:** Include **1-2 bounded recency-sensitive query objects** for recent launches, funding, partnerships, controversies, market moves, or category shifts. Recency is part of Phase 4, but it is bounded to avoid over-searching.

### Stream Visibility
- **D-05:** Add a typed **`query_plan`** stream event before retrieval begins. It should expose a **friendly plan summary** to users, not raw search syntax as the main UI copy.
- **D-06:** The client should **preserve the query plan in the trace panel** after the run finishes so users can inspect what the system intended to search.
- **D-07:** The event payload should contain **full internal query objects plus sanitized display fields**. Internal fields support tests/debugging/downstream phases; display fields keep UI copy readable and safe.
- **D-08:** Do **not** stream per-query progress in Phase 4. Keep the UI calm: emit one `query_plan` event, then update the existing `sources` step with aggregate counts such as planned searches, succeeded searches, failed searches, candidates collected, candidates filtered, and usable sources.

### Failure Behavior
- **D-09:** A single sub-query failure must **not abort the run**. Isolate failed sub-queries, log/count them, and continue with partial results.
- **D-10:** The overall retrieval stage should degrade only if results fall below a **minimum viable evidence threshold** after all successful sub-queries and quality filtering.
- **D-11:** If usable evidence is too thin, continue as a **degraded run with a visible reason** where possible rather than silently producing a weak graph. The stream detail should say retrieval was thin; telemetry should record the degraded reason.
- **D-12:** Failure visibility belongs in **telemetry plus concise stream detail**. Do not add a separate warning panel in Phase 4.

### Source Quality Gates
- **D-13:** Add a deterministic source-quality filter for **thin, bot-blocked, access-denied, noisy, malformed, or missing URL/title** sources before synthesis.
- **D-14:** Filtering runs **after raw retrieval merge/dedupe and before Voyage scoring** so the scorer only ranks usable evidence.
- **D-15:** Filtered-out sources should not go to synthesis. Record **counts by reason plus a small safe sample of reasons** for telemetry/debugging, not full junk records.
- **D-16:** The filter should be a **deterministic helper with reason codes and tests**, e.g. `too_short`, `bot_blocked`, `access_denied`, `missing_url`, `missing_title`, `boilerplate_noise`.

### Control Limits
- **D-17:** Use conservative production caps: **5-12 query objects**, **max 8 provider searches per run per provider**, **8s per provider request**, and **45s total retrieval budget** unless research/planning discovers a safer equivalent.
- **D-18:** Limits should be **environment-configurable with safe defaults**. Defaults must live in code/tests; env overrides may tune max query count, provider timeout, and retrieval budget without changing code.
- **D-19:** Do **not** add an adaptive expansion/rescue loop in Phase 4. Run one planned fanout pass, then degrade visibly if evidence remains thin.

### the agent's Discretion
- Exact TypeScript names for the query-plan module and event payload fields, as long as the schema is typed, zod-validated, contract-tested, and readable by downstream phases.
- Exact minimum viable evidence threshold, as long as it is deterministic, documented, and covered by tests.
- Whether provider hints are advisory metadata or directly affect provider fanout, provided hard caps and partial-failure behavior hold.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and requirements
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, and research flag for ACQO/PAR2-RAG-style query decomposition.
- `.planning/REQUIREMENTS.md` — RTRY-01 and RTRY-02 acceptance language.
- `.planning/STATE.md` — Current milestone state, Phase 4 research flag, and carried-forward Phase 3 review warnings.
- `.planning/PROJECT.md` — Core value: trustworthy explorable graph grounded in fresh web evidence.

### Prior phase decisions
- `.planning/phases/01-stream-contract-foundation-types/01-CONTEXT.md` — Strict typed NDJSON contract and client validation expectations.
- `.planning/phases/02-observability-security-cost-controls/02-CONTEXT.md` — Telemetry, run_id, budget, kill switch, and auth posture decisions.
- `.planning/phases/03-pipeline-extraction-scorer/03-CONTEXT.md` — Pipeline module boundaries and deferred `query_plan` event.
- `.planning/phases/03-pipeline-extraction-scorer/03-VERIFICATION.md` — Verified Phase 3 implementation and residual warnings to account for.

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — Next.js route-handler pipeline and streaming data flow.
- `.planning/codebase/INTEGRATIONS.md` — Tavily, Exa, OpenAI, Voyage, Supabase, and arbitrary URL-fetch integration boundaries.
- `.planning/codebase/STACK.md` — Next.js/TypeScript/npm stack and dependency context.

### Implementation anchors
- `lib/pipeline/types.ts` — `PipelineEvent` schema must be extended for `query_plan`.
- `lib/pipeline/ndjson.ts` — strict NDJSON parsing/validation behavior.
- `lib/pipeline/__tests__/pipeline.contract.test.ts` — contract oracle for stream event variants.
- `lib/pipeline/retriever.ts` — current Tavily/Exa retrieval and merge/dedupe behavior.
- `lib/pipeline/scorer.ts` — Voyage reranking stage; quality filtering should feed this.
- `lib/pipeline/stream-handler.ts` — stream orchestration point for planner, retrieval fanout, aggregate counts, telemetry, scoring, synthesis, and enrichment.
- `app/api/semantic-universe/route.ts` — thin route shell; Phase 4 should keep POST slim and avoid moving auth/budget work into planner logic.
- `hooks/use-semantic-universe-stream.ts` — client stream event dispatcher; must handle `query_plan`.
- `app/tool/page.tsx` — trace panel/progress UI integration point for preserving the friendly plan summary.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PipelineEvent` + zod schema in `lib/pipeline/types.ts` can extend the stream contract with a new `query_plan` discriminant.
- `parseNdjsonEvents` and the contract tests already enforce strict stream compatibility; add `query_plan` fixtures rather than bypassing validation.
- `retrieveSourcesForBrand` in `lib/pipeline/retriever.ts` is the current retrieval boundary; Phase 4 likely introduces a planner/fanout layer that uses provider-specific retrieval helpers or refactors this function into plan-aware retrieval.
- `scoreSourcesForSynthesis` in `lib/pipeline/scorer.ts` should remain after quality filtering.
- `runSemanticUniverseAnalysisStream` in `lib/pipeline/stream-handler.ts` is the right orchestration surface for emitting `query_plan` and aggregate `sources` details.

### Established Patterns
- Server pipeline code lives under `lib/pipeline/` and is directly unit-tested without route instantiation.
- Stream details are user-readable strings, while telemetry carries developer/debug data.
- Auth, daily budget, kill switch, paywall, and route max-duration stay in the route shell or existing support modules.
- Tests use mocked fetch/clients; no live Tavily/Exa/OpenAI/Voyage calls in CI.

### Integration Points
- Query planner should run after request validation and before retrieval fanout.
- Retrieval fanout still uses Tavily and Exa with provider failure isolation.
- Quality filtering should produce reason-code counts for telemetry and concise stream detail.
- The tool client should preserve the friendly `query_plan` summary in the existing run trace/progress surface.

</code_context>

<specifics>
## Specific Ideas

Research must happen before planning. Specifically investigate practical patterns for LLM query decomposition, avoiding over-expansion/topic drift, and breadth-first anchoring strategies such as ACQO and PAR2-RAG before locking planner prompts or schema details.

The intended user experience is calm and legible: users see what categories of searches are planned and how retrieval performed, without being flooded by every raw query or per-query progress update.

</specifics>

<deferred>
## Deferred Ideas

- Adaptive rescue/expansion loops when evidence is thin — defer until retrieval quality can be measured safely.
- Full provenance schema, edge `source_ids[]`, and node `evidence[]` arrays — Phase 5.
- UI warning panel for degraded retrieval — defer unless later UX work decides it is needed.
- New retrieval providers or domain credibility ranking — backlog unless research proves it is essential.

</deferred>

---

*Phase: 04-multi-stage-retrieval-query-planner*
*Context gathered: 2026-05-06*
