# Phase 5: Graph Synthesis Quality & Provenance - Context

**Gathered:** 2026-05-08
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Phase 5 makes the semantic graph trustworthy after Phase 4's planned retrieval pass. The system must turn ranked source material into passage-level evidence, require graph edges and generated non-brand nodes to be grounded in that evidence, repair or reject unsupported relationships, and make fallback/degraded synthesis visible to users.

**In scope:** passage-level evidence schema, source/passage provenance split, synthesis prompt/schema updates, post-synthesis provenance validation, bounded repair for unsupported edges, degraded/fallback result typing, small visible `/tool` status indicator, telemetry/stream detail for degradation.

**Out of scope:** graph renderer migration/performance (Phase 6), full evidence panel UX (Phase 7), adaptive retrieval rescue loops, new retrieval providers, arbitrary page-fetch passage extraction, and broad UI redesign.

</domain>

<decisions>
## Implementation Decisions

### Evidence Shape
- **D-01:** Evidence items represent **passage-level evidence**, not whole-source summaries. Each evidence item should be a short excerpt/snippet tied to source URL/title metadata.
- **D-02:** Keep enough current `Evidence` fields for UI compatibility, but treat the passage as the grounding unit downstream agents validate against.

### Source and Passage IDs
- **D-03:** Add explicit **`sourceIds` plus passage-level `evidenceIds`**. `evidenceIds` point to passage evidence; `sourceIds` identify source URLs/documents.
- **D-04:** Existing UI may continue reading `evidenceIds`, but Phase 5 should make the source/passage split clear for Phase 7 evidence UI.

### Unsupported Edge Handling
- **D-05:** If synthesis creates an edge without valid passage evidence, attempt **one bounded repair** to attach the best matching passage.
- **D-06:** If the edge remains unsupported after the repair attempt, reject/remove it before the graph is shown as authoritative structure.

### Fallback and Degraded Visibility
- **D-07:** Fallback/degraded synthesis must be visibly surfaced in Phase 5, not telemetry-only.
- **D-08:** Add a small `/tool` status indicator for fallback/degraded runs. Keep it status-like and compact; do not build the Phase 7 evidence panel now.
- **D-09:** Payload and stream should carry `result_type` and a concise degraded/fallback reason so UI, telemetry, and future phases agree.

### Grounding Strictness
- **D-10:** Every graph **edge** must have at least one valid passage `evidenceId`.
- **D-11:** Every generated **non-brand node** must be traceable to passage evidence. `brand-core` is exempt.
- **D-12:** Discourse items, visual cards, and model-strength rows should use evidence when available, but they are not the hard blocking gate for Phase 5.

### Passage Extraction Source
- **D-13:** Prefer provider-native highlights/text where available, especially Exa highlights/text and Tavily content/chunks when exposed by retrieval.
- **D-14:** Fall back to existing ranked `SourceItem.snippet` when provider-native passages are unavailable.
- **D-15:** Do not add a new arbitrary page-fetch extraction pass in Phase 5; avoid new latency and SSRF exposure.

### Minimum Usable Graph
- **D-16:** If many edges are rejected after repair, return a **degraded partial graph** rather than silently presenting overconfident output.
- **D-17:** Below the small usable structure floor, fall back instead of presenting the graph as useful.
- **D-18:** Minimum usable structure after provenance validation is: at least **4 nodes**, **3 grounded edges**, and **3 passage evidence items**.

### the agent's Discretion
- Exact TypeScript names for new provenance fields and validation helpers, as long as `sourceIds` and passage-level `evidenceIds` are explicit and contract-tested.
- Exact matching heuristic for the one repair attempt, provided it is deterministic/bounded and covered by tests.
- Exact degraded reason strings, provided they are typed or centralized, user-readable in stream/UI, and recorded in telemetry where feasible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and requirements
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, and research flag for passage extraction/provenance schema.
- `.planning/REQUIREMENTS.md` — SYN-01 and SYN-02 acceptance language.
- `.planning/STATE.md` — Current milestone state and prior phase warnings.
- `.planning/PROJECT.md` — Core value: trustworthy, explorable graph grounded in fresh web evidence.

### Prior phase decisions
- `.planning/phases/04-multi-stage-retrieval-query-planner/04-CONTEXT.md` — Phase 4 locked decisions; provenance schema was intentionally deferred to Phase 5.
- `.planning/phases/04-multi-stage-retrieval-query-planner/04-VERIFICATION.md` — Confirms planned retrieval, source-quality filter, degraded retrieval detail, and telemetry are in place.
- `.planning/phases/03-pipeline-extraction-scorer/03-VERIFICATION.md` — Confirms pipeline modules and scorer boundary.
- `.planning/phases/01-stream-contract-foundation-types/01-CONTEXT.md` — Strict typed NDJSON contract and fail-fast client parsing expectations.
- `.planning/phases/02-observability-security-cost-controls/02-CONTEXT.md` — Telemetry, run id, cost guard, and auth posture.

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — Next.js route-handler pipeline and streaming semantic universe data flow.
- `.planning/codebase/INTEGRATIONS.md` — Tavily, Exa, OpenAI, Voyage, Supabase, and arbitrary URL-fetch boundaries.
- `.planning/codebase/STACK.md` — Next.js/TypeScript/npm stack and test/build context.

### Implementation anchors
- `lib/pipeline/models.ts` — Current graph, evidence, source, and payload types to evolve.
- `lib/pipeline/structurer.ts` — OpenAI synthesis prompt, fallback builder, normalization, evidence ID repair/fallback logic, and payload validation target.
- `lib/pipeline/stream-handler.ts` — Integration point for result type/degraded reason stream detail and telemetry.
- `lib/pipeline/retriever.ts` — Planned retrieval output and provider parsing; passage extraction should use provider-native material here when possible.
- `lib/pipeline/source-quality.ts` — Pre-synthesis quality gate; provenance validation should happen after synthesis.
- `lib/pipeline/types.ts` — Typed stream event schemas if result/degraded metadata needs stream contract expansion.
- `hooks/use-semantic-universe-stream.ts` — Client stream dispatcher if new status events/metadata are added.
- `app/tool/page.tsx` — Existing graph/evidence UI and the small fallback/degraded indicator location.
- `lib/pipeline/__tests__/pipeline.contract.test.ts` — Contract oracle for new stream payload shape.
- `lib/pipeline/__tests__/structurer.test.ts` — Existing synthesis/normalization tests to extend.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/pipeline/models.ts`: Current `Evidence`, `GraphNode`, `GraphLink`, `SemanticUniversePayload`, and `SourceItem` types provide the schema surface Phase 5 must evolve.
- `lib/pipeline/structurer.ts`: Already normalizes model output, sanitizes evidence URLs, filters unknown evidence IDs, builds fallback graphs, and repairs missing edge evidence in limited ways.
- `lib/pipeline/retriever.ts`: Phase 4 now requests Exa `contents` and planned Tavily/Exa queries; this is the best place to preserve provider-native highlights/text for passage extraction.
- `lib/pipeline/stream-handler.ts`: Already tracks `result_type: "success" | "fallback"` and retrieval degraded reasons; extend this rather than adding another orchestration layer.
- `app/tool/page.tsx`: Already has agent trace, load error, selected evidence, and graph state; add a small status indicator rather than a new evidence panel.

### Established Patterns
- Server pipeline code lives in `lib/pipeline/` and is directly unit-tested with Vitest.
- Stream details are user-readable strings; telemetry carries richer structured data.
- Client stream parsing is fail-fast and zod-validated; any new stream shape needs contract coverage.
- Synthesis falls back deterministically when OpenAI output cannot normalize.
- Existing UI uses `evidenceIds` for selected links/nodes; keep this compatible while making IDs passage-level.

### Integration Points
- Passage extraction should happen before or during synthesis context construction, using ranked source material.
- Provenance validation should happen after model normalization and before image enrichment/telemetry/done emission.
- Degraded/fallback result type needs to flow through `stream-handler.ts` into payload and `/tool` state.
- Telemetry may need additive columns or existing result fields depending on planning/research findings.

</code_context>

<specifics>
## Specific Ideas

Research must happen before planning. Specifically investigate provider-native passage/highlight extraction and a clean provenance schema that separates source documents from passage evidence without overhauling the whole graph UI.

The desired user experience is honest and calm: a smaller grounded graph is better than a larger shaky one, and degraded/fallback status should be visible without becoming a full evidence panel.

</specifics>

<deferred>
## Deferred Ideas

- Full evidence panel with ranked excerpts per node/edge — Phase 7.
- WebGL graph renderer, clusters, and richer visual encoding — Phase 6.
- New arbitrary page-fetch extraction pass — deferred due to latency and SSRF risk.
- Adaptive retrieval rescue loop for thin provenance — defer until retrieval quality can be measured safely.

</deferred>

---

*Phase: 05-graph-synthesis-quality-provenance*
*Context gathered: 2026-05-08*
