# Roadmap: 6-degrees v2 Milestone

**Milestone:** v2 — Stronger Graph UX, Model Outputs & Research Pipeline  
**Created:** 2026-05-06  
**Granularity:** Standard (7 phases — derived from 5 requirement categories + natural delivery boundaries)  
**Coverage:** 15/15 v1 requirements mapped

---

## Phases

- [x] **Phase 1: Stream Contract & Foundation Types** — Typed `PipelineEvent` union + FSM client hook; zero behavior change; unblocks all downstream phases (completed 2026-05-06)
- [x] **Phase 2: Observability, Security & Cost Controls** — Langfuse instrumentation, per-run telemetry, cost guards, and auth hardening before pipeline expansion (completed 2026-05-06)
- [x] **Phase 3: Pipeline Extraction & Scorer** — Decompose 1 600-line monolith into `lib/pipeline/` stage modules; add voyageai reranker (completed 2026-05-06)
- [ ] **Phase 4: Multi-Stage Retrieval & Query Planner** — LLM-driven query decomposition, multi-subquery fan-out, retrieval plan visible in stream
- [ ] **Phase 5: Graph Synthesis Quality & Provenance** — Grounded edges with `source_ids[]`, passage-level evidence arrays, fallback visibility
- [ ] **Phase 6: Graph Visualization Upgrade** — sigma/graphology WebGL renderer; Louvain clusters; node/edge type encoding; ForceAtlas2 layout
- [ ] **Phase 7: Evidence Panel & UX Polish** — Evidence panel with ranked excerpts per node; legible stream progress; partial graph skeleton on `graph_ready`

---

## Phase Details

### Phase 1: Stream Contract & Foundation Types
**Goal**: All server–client communication is typed, contract-tested, and safe to extend without breaking production
**Depends on**: Nothing (first phase)
**Requirements**: STREAM-01, STREAM-02
**Success Criteria** (what must be TRUE):
  1. Server emits typed `PipelineEvent` discriminated-union objects; client consumes them through the FSM hook without any switch-on-string ad-hoc parsing
  2. Adding a new event type to the server requires only extending the shared union in `lib/pipeline/types.ts` — no fragile one-off client changes needed
  3. A contract test validates NDJSON parsing for every event type without a live server running
  4. The `/tool` page loads and streams with identical user-visible behavior after the type migration — zero regression
**Plans**: 3 plans
- [x] 01-01-PLAN.md — Tooling foundation: install zod+vitest, vitest.config.ts, `lib/pipeline/types.ts` (PipelineEvent + zod schema), extract `normalizePayload` to `lib/pipeline/normalize-payload.ts`
- [x] 01-02-PLAN.md — Pure NDJSON parser (`lib/pipeline/ndjson.ts`), full contract test suite (every variant + chunk splitting + fail-fast), type `emitLine` against `PipelineEvent`
- [x] 01-03-PLAN.md — `useSemanticUniverseStream` hook (parse+validate+FSM only), refactor `app/tool/page.tsx` to consume it, manual UAT for SC4 zero-regression
**Research flag**: skip — standard TypeScript discriminated unions and FSM hook patterns; well-documented
**UI hint**: no

---

### Phase 2: Observability, Security & Cost Controls
**Goal**: Every run is measured, bounded, and secured before pipeline complexity increases
**Depends on**: Phase 1
**Requirements**: OBS-01, OBS-02, OBS-03
**Success Criteria** (what must be TRUE):
  1. A developer can query per-run latency by stage, token/cost proxy, node/edge counts, and `result_type` from a log store or Langfuse dashboard
  2. A run that would exceed the per-user daily spend cap is rejected with a clear error — no silent overruns are possible
  3. The `/api/geo-chat` endpoint (and any equivalent callers performing paid or sensitive work) returns 401 for unauthenticated requests
  4. A cost anomaly running for more than 10 minutes is detectable and stoppable via a kill switch before it causes financial damage
**Plans**:
- [x] `02-01-PLAN.md` — Supabase `semantic_pipeline_runs` + `user_daily_usage` migration, RLS, `.env.example` knobs
- [x] `02-02-PLAN.md` — `run_meta` stream event, Langfuse + OpenAI SDK tracing, semantic-universe DB telemetry insert + `maxDuration`
- [x] `02-03-PLAN.md` — Kill switch + UTC daily pseudo-token cap, geo-chat auth + traced completions + Vitest budget helpers
**Research flag**: skip — Langfuse `observeOpenAI()` integration and Supabase per-run logging are standard documented patterns
**UI hint**: no

---

### Phase 3: Pipeline Extraction & Scorer
**Goal**: The 1 600-line monolith is decomposed into independently-testable stage modules with a scoring layer producing higher-signal LLM input
**Depends on**: Phase 2
**Requirements**: PIPE-01, PIPE-02
**Success Criteria** (what must be TRUE):
  1. `export async function POST` in the route is ≤65 lines (including blanks) and delegates stage logic to `lib/pipeline/` modules (`retriever`, `scorer`, `enricher`, `structurer`, stream wiring)
  2. Each stage module can be imported and unit-tested in isolation without instantiating the route
  3. The voyageai reranker scores merged Tavily+Exa results before they reach OpenAI synthesis — higher-signal evidence enters the LLM, producing measurably fewer low-confidence edges
  4. Existing streaming behavior and all user-visible output is unchanged after the refactor (confirmed by contract test from Phase 1)
**Plans**: 3 plans (`.planning/phases/03-pipeline-extraction-scorer/`)
- [x] `03-01-PLAN.md` — `lib/pipeline/models.ts`, `lib/pipeline/retriever.ts` (`retrieveSourcesForBrand`, `dedupeByUrl`), Vitest `retriever.test.ts`, route rewires
- [x] `03-02-PLAN.md` — `voyageai` rerank (`lib/pipeline/scorer.ts`), `VOYAGE_API_KEY`, wire ranked sources before synthesis, `scorer.test.ts`
- [x] `03-03-PLAN.md` — `enricher`, `structurer`, `stream-handler.ts`, slim POST shell, `structurer.test.ts`
**Research flag**: skip — standard module extraction refactor; architecture research provides the exact file structure and build order
**UI hint**: no

---

### Phase 4: Multi-Stage Retrieval & Query Planner
**Goal**: The system runs deliberate multi-query retrieval and exposes its retrieval plan in the stream so users can see what was searched
**Depends on**: Phase 3
**Requirements**: RTRY-01, RTRY-02
**Success Criteria** (what must be TRUE):
  1. A user watching the stream sees the query plan (generated sub-questions) appear as a `query_plan` event before retrieval begins
  2. The system issues 5–12 targeted sub-queries per run instead of a single broad pass, producing richer and more diverse source coverage
  3. Bot-blocked or low-quality sources (<150 tokens, or containing bot-block signals) are filtered before synthesis — no garbage-in sources reach the LLM
  4. A single sub-query failure does not abort the pipeline — results are partial but valid, with the failure isolated and logged
**Plans**: 4 plans (`.planning/phases/04-multi-stage-retrieval-query-planner/`)
- [ ] `04-01-PLAN.md` — `query_plan` stream contract, contract tests, hook state, and friendly trace rendering
- [ ] `04-02-PLAN.md` — Structured query planner, adaptive caps, deterministic fallback, env-configurable retrieval limits
- [ ] `04-03-PLAN.md` — Plan-aware Tavily/Exa fanout, provider timeouts, failure isolation, source-quality filter
- [ ] `04-04-PLAN.md` — Stream orchestration, aggregate counts, degraded retrieval reason, additive telemetry migration
**Research flag**: satisfied — `.planning/phases/04-multi-stage-retrieval-query-planner/04-RESEARCH.md`
**UI hint**: no

---

### Phase 5: Graph Synthesis Quality & Provenance
**Goal**: Every graph edge is grounded in source evidence and degraded or fallback runs are clearly visible to users
**Depends on**: Phase 4
**Requirements**: SYN-01, SYN-02
**Success Criteria** (what must be TRUE):
  1. Every edge in the rendered graph carries at least one `source_id[]` reference traceable to a retrieved document — no edge appears without grounding
  2. A post-synthesis validation pass flags or rejects edges referencing zero sources; no unsupported relationships are shown to users as authoritative structure
  3. A user can distinguish a primary synthesis run from a fallback run via a visible `result_type` indicator in the stream and UI
  4. Each node carries an `evidence[]` array with passage excerpts and retrieval scores that downstream UI components can consume directly
**Plans**: TBD
**Research flag**: yes — `/gsd-research-phase` required. Passage extraction approach (Exa highlights vs Tavily snippets vs custom chunking) and provenance schema design have multiple viable patterns; research before committing to the `evidence[]` schema and `zodResponseFormat` structure
**UI hint**: no

---

### Phase 6: Graph Visualization Upgrade
**Goal**: The graph renderer handles large, typed graphs at interactive frame rates with automatic cluster detection and type-based visual encoding
**Depends on**: Phase 5
**Requirements**: VIS-01, VIS-02, VIS-03
**Success Criteria** (what must be TRUE):
  1. A graph with 200+ nodes renders at interactive frame rates without browser hang or jank during pan, zoom, and drag
  2. Communities are automatically detected (Louvain) and color-coded so a user can identify cluster groupings at a glance on medium-to-large graphs
  3. Node shape/color distinguishes ≥5 types (Person, Org, Concept, Event, Claim); edge style distinguishes ≥3 relationship types (causal, associative, contextual)
  4. ForceAtlas2 layout runs off the main thread via web worker — the page remains responsive during layout computation on large graphs
**Plans**: TBD
**Research flag**: yes — `/gsd-research-phase` required. sigma/react-sigma v5 migration from the current renderer has unknowns; research the migration path and graphology state model integration pattern before planning (actual renderer strategy unclear from codebase mapping)
**UI hint**: yes

---

### Phase 7: Evidence Panel & UX Polish
**Goal**: Ranked source excerpts are surfaced per selected node and streaming progress copy is legible throughout the run
**Depends on**: Phase 5, Phase 6
**Requirements**: EVID-01
**Success Criteria** (what must be TRUE):
  1. Clicking a node opens an evidence panel showing the top 2–3 ranked source passages with retrieval scores, tied to the node's `evidence[]` provenance data
  2. Stream progress steps use user-friendly copy matching the user's mental model — no internal stage names or technical IDs visible during a run
  3. A run that degrades to fallback shows a visible indicator in the UI — users are never silently served a degraded graph presented as authoritative
  4. The graph renders a partial skeleton when `graph_ready` fires, before enrichment completes — users see structure forming incrementally during long runs
**Plans**: TBD
**Research flag**: skip — standard React UX patterns; all data dependencies (provenance, typed events, WebGL renderer) resolved by prior phases
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stream Contract & Foundation Types | 3/3 | Complete    | 2026-05-06 |
| 2. Observability, Security & Cost Controls | 3/3 | Complete    | 2026-05-06 |
| 3. Pipeline Extraction & Scorer | 3/3 | Complete | 2026-05-06 |
| 4. Multi-Stage Retrieval & Query Planner | 0/4 | Planned | — |
| 5. Graph Synthesis Quality & Provenance | 0/0 | Not started | — |
| 6. Graph Visualization Upgrade | 0/0 | Not started | — |
| 7. Evidence Panel & UX Polish | 0/0 | Not started | — |

---

## Coverage

| Requirement | Phase | Category |
|-------------|-------|----------|
| STREAM-01 | 1 | Stream contract |
| STREAM-02 | 1 | Stream contract |
| OBS-01 | 2 | Observability |
| OBS-02 | 2 | Observability |
| OBS-03 | 2 | Observability |
| PIPE-01 | 3 | Pipeline structure |
| PIPE-02 | 3 | Pipeline structure |
| RTRY-01 | 4 | Multi-stage retrieval |
| RTRY-02 | 4 | Multi-stage retrieval |
| SYN-01 | 5 | Graph synthesis |
| SYN-02 | 5 | Graph synthesis |
| VIS-01 | 6 | Visualization |
| VIS-02 | 6 | Visualization |
| VIS-03 | 6 | Visualization |
| EVID-01 | 7 | Evidence & UX |

**Total:** 15/15 requirements mapped ✓ — no orphans

---

*Roadmap created: 2026-05-06*  
*Last updated: 2026-05-06 after Phase 4 planning*
