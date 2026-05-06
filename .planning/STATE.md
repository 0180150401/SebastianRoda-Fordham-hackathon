# State: 6-degrees v2

**Updated:** 2026-05-06  
**Session:** Roadmap initialized

---

## Project Reference

**Core Value:** Users get a trustworthy, explorable graph of entities and relationships grounded in fresh web evidence, with clear provenance and legible model reasoning.

**Current Focus:** Phase 1 — Stream Contract & Foundation Types

---

## Current Position

| Field | Value |
|-------|-------|
| Phase | 1 — Stream Contract & Foundation Types |
| Plan | — (not started) |
| Status | Not started |
| Progress | ░░░░░░░░░░░░░░ 0 / 7 phases |

**Next action:** `/gsd-plan-phase 1`

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 0 / 7 |
| Plans complete | 0 |
| Requirements mapped | 15 / 15 |
| Sessions | 1 |

---

## Accumulated Context

### Decisions

- **Stack fixed:** Next.js 16, React 19, Supabase, Stripe, OpenAI, Tavily, Exa — brownfield enhancement only; no rewrites of working auth, billing, or stream contract
- **New additive libraries approved by research:** `sigma@^3`, `graphology@^0.26`, `@react-sigma/core@^5`, `graphology-layout-forceatlas2`, `graphology-communities-louvain`, `graphology-metrics`, `voyageai` (reranker), `langfuse@^3`, `exa-js` SDK (official), `openai@^6.35`, `zod@^4`
- **Phase order mandated by architecture research:** types → observability → extraction → retrieval → synthesis → visualization → polish. Do not skip or reorder.
- **Optimize for legible graphs + evidence, not raw token volume** — aligns with Core Value; guides trade-off decisions within phases

### Todos

- (none yet)

### Blockers

- (none)

### Research Flags (surface at plan time)

- **Phase 4:** Needs `/gsd-research-phase` — LLM query decomposition (ACQO + PAR²-RAG anchoring strategies)
- **Phase 5:** Needs `/gsd-research-phase` — Passage extraction approach and `evidence[]` provenance schema design
- **Phase 6:** Needs `/gsd-research-phase` — sigma/react-sigma v5 migration path from current renderer

### Known Gaps to Validate During Planning

- **voyageai reranker latency:** ~300ms in benchmarks; validate under Vercel Edge constraints during Phase 3 with a timeout guard
- **Supabase `pipeline_runs` schema:** Review before Phase 2 planning to confirm no conflict with existing `profiles` and access-control tables
- **OpenAI structured output + large graph schemas:** Flag for Phase 5 planning; add `max_tokens` guard and streaming JSON validation empirically
- **LLM prompt design for query planner:** Quality is highly prompt-dependent; allocate explicit iteration time during Phase 4 before treating planner as stable
- **Current renderer strategy:** SVG/Canvas/D3 usage is unclear from codebase mapping; confirm during Phase 6 research to calibrate migration effort

---

## Session Continuity

**To resume:** Read this file + `.planning/ROADMAP.md`, then run `/gsd-progress`

---

*State initialized: 2026-05-06*  
*Last updated: 2026-05-06 after roadmap creation*
