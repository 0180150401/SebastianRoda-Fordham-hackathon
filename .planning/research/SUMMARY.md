# Project Research Summary

**Project:** 6-degrees — AI Semantic Graph / Web-Research Assistant
**Domain:** Brownfield enhancement — LLM-synthesized knowledge graphs + multi-stage web retrieval
**Researched:** 2026-05-06
**Confidence:** HIGH (codebase mapped; stack and pitfalls cross-referenced against official sources and production post-mortems)

---

## Executive Summary

6-degrees is a brownfield enhancement milestone targeting three improvements on a working Next.js 16 / Supabase / OpenAI product: a more sophisticated multi-stage web-research pipeline, stronger graph synthesis quality, and a more legible graph visualization. Research confirms the technical approach is well-aligned with current state of the art (Deep GraphRAG, PAR²-RAG, ACQO), and the path forward is clear — but it runs through the existing 1 600-line monolith route handler that must be decomposed before new stages can be added safely.

The single highest-leverage investment is extracting the pipeline into typed, independently testable stage modules (`lib/pipeline/planner → retriever → scorer → structurer → enricher`). Everything else — scoring, query planning, per-node provenance, cluster detection — builds on top of that foundation. Attempting to bolt new capability onto the monolith without this structural work first is the primary architectural pitfall. The recommended build order is deliberate: types and stream contract first, then observability (before pipeline expansion), then sequential stage extraction.

The critical risks are cost explosion from unguarded pipeline fan-out (a documented $47K incident class), hallucinated edges reaching users as authoritative relationships, and silent scraping degradation that degrades graph quality invisibly over weeks. All three have clear mitigations available now, but none are wired yet. Observability must ship before pipeline complexity increases — quality cannot be improved without measurement.

---

## Key Findings

### Recommended Stack

The core stack (Next.js 16, React 19, Supabase, Stripe, Tailwind v4) is fixed. Research identified six additive technology choices that slot into the existing App Router + NDJSON-streaming architecture without disruption.

**Core new technologies:**
- `sigma@^3` + `graphology@^0.26` + `@react-sigma/core@^5`: Graph visualization — only JS graph renderer using WebGL natively; handles 10K+ nodes at 60fps where SVG/Canvas solutions stall. graphology provides the typed data model, Louvain, centrality, and ForceAtlas2 worker as first-class companions.
- `graphology-layout-forceatlas2` + `graphology-communities-louvain` + `graphology-metrics`: Force-directed layout (off main thread), community detection (O(n log n)), and centrality scoring — the three graph algorithms needed for cluster detection, visual encoding, and node sizing.
- `openai@^6.35` + `zod@^4`: Official OpenAI SDK replaces raw `fetch`; adds `.parse()` + `zodResponseFormat()` for guaranteed-valid graph JSON and structured output streaming. Zod v4 is stable (May 2026) with 14.7× faster string parsing.
- `exa-js` (official SDK): Wraps the existing HTTP integration; adds `highlights` mode (10× fewer tokens), typed results, and `deep-reasoning` search type for quality runs.
- `voyageai` (reranker): After merging Tavily + Exa results, `voyage-rerank-2.5` scores relevance against the original query before OpenAI synthesis — reduces hallucination risk by feeding the LLM only high-signal evidence. 7.9% improvement over Cohere Rerank v3.5 on MTREB.
- `langfuse@^3`: LLM observability via `observeOpenAI()` wrapper; 1M spans/month free, self-hostable, zero LangChain dependency. Captures per-run prompt, completion, token count, latency, and custom metadata.

See `.planning/research/STACK.md` for full library list, version compatibility table, and alternatives considered.

### Expected Features

This is a v2 enhancement milestone on a shipped v1. Auth, streaming pipeline, multi-source fetch, OpenAI synthesis, interactive graph, evidence/discourse panel shells, and Stripe-backed access control are all already live.

**Must have for v2 launch (P1):**
- Multi-stage retrieval pipeline with query planning — all other quality features depend on it; core pipeline upgrade
- Query-plan visibility in stream — low-effort trust signal reusing existing stream infrastructure
- Per-node source provenance (passage-level) — fills the evidence panel; directly addresses the "trustworthy, grounded" core value
- Cluster detection + semantic cluster labels — makes larger graphs scannable; highest visual impact per effort
- Node/edge type visual encoding — fixed vocabulary (5 node types, 3 edge types); high legibility payoff

**Should have after P1 validation (P2):**
- Confidence / weight scoring on nodes and edges — visible once users trust the pipeline
- Adaptive query expansion for thin results — silent UX improvement
- Graph history / session memory — add when usage data shows re-running behavior
- Evidence panel with ranked source excerpts — depends on provenance landing first

**Defer to v3+:**
- Discourse / perspective facets — conflicts with confidence scoring framing; high complexity
- Shareable read-only graph URL — growth lever, not core UX fix
- Document / PDF ingestion — separate product milestone with its own security model

See `.planning/research/FEATURES.md` for full competitor matrix and dependency graph between features.

### Architecture Approach

The existing architecture is a single 1 600-line `app/api/semantic-universe/route.ts` monolith where all pipeline stages share closure scope. The target architecture decomposes this into five server-side layers (Planner → Retriever → Scorer → Structurer → Enricher) in `lib/pipeline/`, a slim route coordinator (~50 lines), a typed NDJSON `PipelineEvent` discriminated union shared between server and client, a client-side stream FSM hook (`useSemanticStream`), and decomposed graph render components. The hard rule is layers only communicate forward — no stage reaches back for more data from a prior stage.

**Major components:**
1. `lib/pipeline/` (5 stage modules) — independently testable; route handler becomes a pipeline description, not an implementation
2. Typed `PipelineEvent` discriminated union in `lib/pipeline/types.ts` — shared server/client contract; replaces the implicit, fragile NDJSON schema
3. `useSemanticStream` FSM hook — replaces the imperative `while(true)` parse loop in `app/tool/page.tsx`; maps typed events to state transitions
4. `GraphCanvas` + `useGraphLayout` — memoized WebGL renderer backed by sigma/graphology; viewport culling; force layout runs off main thread
5. `EvidencePanel` / `DiscoursePanel` — read from graph store via context; never write back or re-derive semantic properties

See `.planning/research/ARCHITECTURE.md` for layer boundary definitions, build order rationale, and the five architectural anti-patterns to avoid.

### Critical Pitfalls

1. **Hallucinated edges accepted as ground truth** — Require each edge to carry `source_ids[]` referencing source documents; add a post-synthesis validation pass; prompt constraints: "Only draw an edge if both entities co-appear in at least one source passage." Address in graph synthesis quality phase before any provenance-display work.

2. **Silent scraping degradation** — Add a content-quality gate (reject sources below 150 tokens or containing bot-block signals); log source quality metrics per run; cross-validate entities found by Tavily vs Exa. Address in pipeline hardening before retrieval expansion (more sources amplifies bad signal).

3. **Latency / cost explosion from unguarded pipeline fan-out** — Add per-run cost budget, per-user daily spend cap in Supabase, and authenticate `/api/geo-chat` immediately. Cap image enrichment concurrency at 3–4 with global timeout. A documented production case: $47,812 undetected over nine hours with all HTTP 200s.

4. **Observability gap — dashboards green while quality burns** — Ship five-pillar instrumentation before pipeline expansion: latency decomposition per stage, token + cost accounting per run, input/output logging, quality proxy metrics (edge count, confidence coverage), and kill switches.

5. **Streaming contract break** — Define `PipelineEvent` discriminated union in a shared module imported by both route and client; extract NDJSON reader to a tested utility; add contract tests. The current `while(true)` loop with `eslint-disable` is fragile against any schema change.

6. **Thin fallback masking real failures** — Tag every response with `result_type: 'synthesized' | 'fallback'`; log fallback triggering reason; surface visibly in UI; add fallback rate metric with 10% alert threshold.

See `.planning/research/PITFALLS.md` for full pitfall → phase mapping, recovery strategies, and integration gotchas.

---

## Implications for Roadmap

Based on combined research, the recommended phase structure is seven phases across the v2 milestone. Architecture research mandates the first three phases as prerequisites before any new pipeline capability is added.

### Phase 1: Stream Contract & Foundation Types
**Rationale:** All subsequent phases depend on shared types and a stable stream protocol. Architecture research is explicit: "Do not skip Wave 1–3." Zero behavior change, no user-facing risk, unblocks everything.
**Delivers:** `lib/pipeline/types.ts` with `PipelineEvent` discriminated union; `useSemanticStream` FSM hook replacing `while(true)` loop; contract test for NDJSON parsing
**Addresses:** Table-stakes loading state UX (labeling improvements)
**Avoids:** Pitfall 5 (streaming contract break) — any subsequent phase that adds event types can do so safely

### Phase 2: Observability, Security & Cost Controls
**Rationale:** PITFALLS.md is explicit — observability "should be one of the first new phases; all subsequent quality improvement phases rely on being able to measure before/after." The unauthenticated `/api/geo-chat` endpoint is a live security risk that should not outlast the first development sprint.
**Delivers:** Langfuse integration (`observeOpenAI()` wrapper); per-run Supabase logging (latency, tokens, cost, node/edge counts, result_type); per-user daily rate limits; auth on `/api/geo-chat`; image enrichment moved to async/feature-flagged path; SSRF allowlist on `resolveSourceImages`
**Avoids:** Pitfall 3 (cost explosion), Pitfall 4 (observability gap), security mistakes documented in PITFALLS.md
**Research flag:** Standard patterns; skip `/gsd-research-phase`

### Phase 3: Pipeline Extraction & Scorer
**Rationale:** Decompose the 1 600-line monolith into `lib/pipeline/` stage modules (retriever, enricher first; scorer second). Architecture research: "Extract one stage at a time, verify the route still works, move on." This is the prerequisite for Phases 4–5 — scoring requires a Retriever stage to exist.
**Delivers:** `lib/pipeline/retriever.ts`, `lib/pipeline/enricher.ts`, `lib/pipeline/scorer.ts` (voyageai rerank-2.5); route handler reduced to ~50-line pipeline coordinator; first user-visible quality improvement (better-scored sources → better graph)
**Uses:** `exa-js` SDK (replaces HTTP), `voyageai` reranker
**Avoids:** Anti-pattern 1 (adding stages inline to monolith), Anti-pattern 2 (sending raw source dumps to LLM)
**Research flag:** Standard refactor patterns; skip `/gsd-research-phase`

### Phase 4: Multi-Stage Retrieval & Query Planner
**Rationale:** Builds on Phase 3 (scorer exists); adds `lib/pipeline/planner.ts` (LLM-driven sub-question decomposition) and enriches retrieval with Exa `highlights` mode, Tavily `advanced` depth, and multi-subquery fan-out. This is the core P1 pipeline feature that all other quality features depend on.
**Delivers:** `lib/pipeline/planner.ts` generating 5–12 targeted queries; adaptive fan-out with `Promise.allSettled` and URL dedup; Exa `searchAndContents` with `highlights`; Tavily `search_depth: "advanced"`; `query_plan` stream event type; content quality gate (reject bot-blocked sources); source quality stats logged per run
**Addresses:** P1: Multi-stage retrieval pipeline + query-plan visibility in stream
**Avoids:** Pitfall 2 (silent scraping degradation), Pitfall 1 partial mitigation (higher source quality reduces hallucination surface)
**Research flag:** Needs `/gsd-research-phase` — LLM prompt design for query decomposition has documented failure modes (over-expansion, topic drift); warrants research into ACQO and PAR²-RAG anchoring strategies

### Phase 5: Graph Synthesis Quality & Provenance
**Rationale:** With a scored, high-quality source feed from Phase 4, the synthesis layer can be upgraded to grounded edges with `source_ids[]` and passage-level provenance. This fills the evidence panel (currently a shell) and addresses the hallucination pitfall directly.
**Delivers:** Edge `source_ids[]` enforcement in structured output schema (zodResponseFormat); post-synthesis validation pass flagging unsupported edges; per-node `evidence[]` array with passage excerpts and retrieval scores; evidence panel populated with ranked source excerpts; `result_type` field on all stream responses; fallback state visible in UI
**Addresses:** P1: Per-node source provenance; fills Evidence panel
**Avoids:** Pitfall 1 (hallucinated edges), Pitfall 6 (fallback masking failures)
**Research flag:** Needs `/gsd-research-phase` — passage extraction approach (Exa highlights vs Tavily snippets vs custom chunking) and provenance schema design have multiple viable patterns; research needed to pick the right one

### Phase 6: Graph Visualization Upgrade
**Rationale:** Pure front-end; no pipeline risk; depends on typed event protocol from Phase 1. sigma + graphology replace the current renderer with WebGL performance, Louvain cluster detection, ForceAtlas2 layout, and node/edge type visual encoding — the remaining P1 visual features.
**Delivers:** sigma + graphology + @react-sigma/core installed and rendering; ForceAtlas2 layout (web worker); Louvain community detection → cluster color-coding; AI-generated cluster semantic labels (one OpenAI call post-synthesis); fixed node-type vocabulary (Person, Org, Concept, Event, Claim) with shape/color encoding; edge type encoding (causal, associative, etc.); node sizing by betweenness centrality; `GraphCanvas` + `GraphNode` + `GraphEdge` + `useGraphLayout` decomposed components; viewport culling for large graphs
**Addresses:** P1: Cluster detection + semantic labels; node/edge type visual encoding; table-stakes zoom/pan/drag behavior
**Uses:** Full sigma/graphology stack from STACK.md
**Research flag:** sigma/react-sigma v5 migration from current renderer has unknowns — recommend `/gsd-research-phase` scoped to the renderer migration path and graphology state integration pattern

### Phase 7: Evidence Panel & UX Polish
**Rationale:** With provenance data in place (Phase 5) and typed stream events (Phase 1), the evidence panel can be fully activated and the streaming UX refined. This is the final P1 closure.
**Delivers:** Evidence panel displaying ranked source excerpts per node (top 2–3 passages with retrieval scores); `stage_start` / `stage_done` progress events with user-friendly step copy matching mental model; error recovery with actionable messages; `enrichment_done` async event (images merge into graph without re-render); graph renders partial skeleton on `graph_ready` event before enrichment completes
**Addresses:** P1 closure; table-stakes: streaming progress granularity, node click → details panel, fallback surface
**Research flag:** Standard UX patterns; skip `/gsd-research-phase`

---

### Phase Ordering Rationale

- **Types before everything:** Phases 4–7 all add new `PipelineEvent` types. Without Phase 1, each addition risks a streaming contract break in production.
- **Observability before expansion:** Phase 2 before Phase 4 ensures the expanded, more expensive pipeline is instrumented from day one — cost explosions and quality regressions are detectable immediately rather than discovered via surprise invoice.
- **Extraction before addition:** Phase 3 before Phase 4 follows the architecture recommendation. Adding query planning to a 1 600-line monolith is an anti-pattern; to a 50-line coordinator calling `lib/pipeline/*.ts`, it's a one-line addition.
- **Synthesis quality before visual encoding:** Phase 5 before Phase 6 — edge confidence and node type encoding in Phase 6 require the Phase 5 schema fields (`source_ids`, `confidence`, typed categories) to exist in the payload. Rendering before provenance ships creates placeholder encoding that will need replacing.
- **Evidence panel last:** Phase 7 depends on Phase 5 (provenance data) and Phase 1 (typed stream events). All inputs available by Phase 7.

### Research Flags

**Phases needing `/gsd-research-phase` during planning:**
- **Phase 4 (Multi-stage retrieval):** LLM-driven query decomposition has documented failure modes. Research ACQO adaptive query optimization and PAR²-RAG anchoring strategies for prompt design.
- **Phase 5 (Synthesis quality):** Passage extraction approach and provenance schema have multiple viable patterns. Research passage-level grounding in graph synthesis before designing the `evidence[]` schema.
- **Phase 6 (Graph visualization):** sigma/react-sigma v5 migration path from the current renderer has unknowns. Research the migration pattern and graphology state model integration before planning.

**Phases with standard patterns (skip `/gsd-research-phase`):**
- **Phase 1 (Stream contract):** Standard TypeScript discriminated unions and FSM hook patterns; well-documented.
- **Phase 2 (Observability):** Langfuse `observeOpenAI()` integration is thoroughly documented; Supabase per-run logging is standard table + insert pattern.
- **Phase 3 (Pipeline extraction):** Standard module extraction refactor; architecture research provides the exact file structure and build order.
- **Phase 7 (UX polish):** Standard React UX patterns; all data dependencies resolved by prior phases.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core additions (sigma, openai SDK v6, zod v4, exa-js, voyageai) verified against official docs and release notes. Only observability provider choice (langfuse vs alternatives) is MEDIUM — aggregator sources corroborate but unverified via Helicone official. |
| Features | MEDIUM-HIGH | Competitive landscape verified via multiple sources (ResearchRabbit, Perplexity, TrustGraph). Feature priority is inferred from codebase mapping — depends on user behavior data not yet available. |
| Architecture | HIGH | Codebase mapped directly. Pattern recommendations verified against official React Flow docs, Next.js streaming guides, and production pipeline post-mortems. Layer boundary model is opinionated but well-grounded. |
| Pitfalls | HIGH | Cross-referenced against production post-mortems, codebase audit (CONCERNS.md), official docs, and peer-reviewed KG hallucination research. Cost explosion risk verified against a documented $47K incident. |

**Overall confidence:** HIGH

### Gaps to Address

- **Reranker latency under real query load:** voyageai rerank-2.5 adds ~300ms in benchmarks; real-world latency under Vercel Edge Function constraints is unverified. Validate during Phase 3 execution with a timeout guard.
- **sigma migration complexity:** The current graph renderer strategy (SVG/Canvas/D3) is unclear from codebase mapping. Actual migration effort for Phase 6 depends on what's there — explore during Phase 6 planning.
- **Per-run Supabase schema:** Phase 2 needs a `pipeline_runs` (or similar) table migration. Ensure Supabase schema design doesn't conflict with existing `profiles` and access control tables — review before planning Phase 2.
- **OpenAI structured output + large graph schemas:** zodResponseFormat with large node/edge schemas under token limits needs empirical testing. Flag for Phase 5 planning; add `max_tokens` guard and streaming JSON validation.
- **LLM prompt design for query planner:** Quality of query decomposition is highly prompt-dependent. Phase 4 should allocate time for prompt iteration with representative queries before treating the planner as stable.

---

## Sources

### Primary (HIGH confidence)
- sigmajs.org docs + npm sigma@3.0.2 — graph rendering, WebGL performance
- sim51/react-sigma GitHub (react-sigma v5) — React lifecycle integration
- graphology.github.io standard-library — ForceAtlas2, Louvain, metrics APIs
- openai/openai-node GitHub v6.35.0 — structured output, zodResponseFormat, streaming
- zod.dev v4 release notes (May 2026) — v4 stability, performance improvements
- exa.ai TypeScript SDK docs — highlights mode, searchAndContents API
- voyageai.com rerank-2.5 announcement (Aug 2025) — benchmark claims, API surface
- vercel.com AI SDK 6 announcement — DataStreamWriter, keep-alive patterns
- tavily.com best practices docs — multi-subquery, search_depth options
- Codebase audit CONCERNS.md (2026-05-06) — direct code inspection
- .planning/codebase/ARCHITECTURE.md (2026-05-06) — codebase mapping

### Secondary (MEDIUM confidence)
- pkgpulse.com graph visualization comparison 2026 — sigma vs cytoscape vs vis-network
- pkgpulse.com Langfuse vs LangSmith vs Helicone 2026 — observability provider selection
- tianpan.co agentic RAG architecture guide 2026 — multi-stage pipeline patterns
- tianpan.co batch LLM pipeline cost post-mortem (Apr 2026) — $47K undetected cost case study
- inference.net LLM observability gaps survey — five-pillar instrumentation pattern
- arxiv.org Deep GraphRAG 2601.11144v3 — hierarchical retrieval relevance
- arxiv.org PAR²-RAG 2603.29085 — breadth-first anchoring pattern
- arxiv.org ACQO 2601.21208v1 — adaptive query optimization

### Tertiary (LOW confidence — needs validation during planning)
- Helicone maintenance-mode status (three aggregators; unverified via Helicone official)

---
*Research completed: 2026-05-06*
*Ready for roadmap: yes*
