# Requirements: 6-degrees v2 milestone

**Defined:** 2026-05-06  
**Core Value:** Users get a trustworthy, explorable graph of entities and relationships grounded in fresh web evidence, with clear provenance and legible model reasoning.

## v1 Requirements (this milestone)

### Stream contract & client consumption

- [x] **STREAM-01**: Typed `PipelineEvent` (or equivalent) defines the NDJSON stream contract shared by `app/api/semantic-universe` and the `/tool` client, without breaking existing step semantics users rely on today. *(Implemented 2026-05-06; confirm in-browser UAT.)*
- [x] **STREAM-02**: Client stream handling is encapsulated (FSM hook or equivalent), replacing ad-hoc parsing so new event types can be added safely. *(Implemented 2026-05-06; confirm in-browser UAT.)*

### Observability, security, and cost

- [x] **OBS-01**: Each semantic run records measurable telemetry (latency by stage, token/cost proxies, counts of nodes/edges/sources) sufficient to compare quality changes before versus after pipeline work. *(Implemented 2026-05-06: Supabase `semantic_pipeline_runs` + optional Langfuse tracing via OpenAI SDK; apply migration + configure Langfuse env before relying on dashboards.)*
- [x] **OBS-02**: Guardrails prevent runaway cost from retrieval or enrichment fan-out (caps, backoff, kill switches, or equivalent production-safe controls). *(Implemented 2026-05-06: UTC pseudo-token budget `SEMANTIC_DAILY_TOKEN_BUDGET`, retrieval charge env, kill switch `SEMANTIC_PIPELINE_DISABLED`, route `maxDuration`.)*
- [x] **OBS-03**: API routes reachable from the client that perform paid or sensitive work require the same authentication and authorization posture as the rest of the tool (no orphaned public callers). *(Implemented 2026-05-06: `/api/geo-chat` requires Supabase session; confirm callers send `credentials: 'include'`.)*

### Pipeline structure & retrieval quality

- [x] **PIPE-01**: Semantic pipeline logic is modularized (`lib/pipeline/` or equivalent) with a slim route coordinator, preserving current behavior while enabling independent stage changes. *(Implemented 2026-05-06: `lib/pipeline/` models, retriever, scorer, enricher, structurer, and stream handler; route `POST` verified at 40 lines.)*
- [x] **PIPE-02**: A scoring or reranking stage filters merged web results before synthesis so the LLM consumes higher-signal evidence. *(Implemented 2026-05-06: Voyage `rerank-2.5` scorer with deterministic no-key/error fallback.)*

### Multi-stage retrieval & planning

- [x] **RTRY-01**: Retrieval uses multiple deliberate stages (planned sub-queries or equivalent) beyond a single Tavily + Exa pass, with deduplication and failure isolation between substeps. *(Implemented 2026-05-06: structured query planner, planned Tavily/Exa fanout, provider timeouts, dedupe, partial-failure stats, source-quality filter before scoring.)*
- [x] **RTRY-02**: The stream exposes enough of the retrieval plan that a user can see what the system searched for without reading server logs. *(Implemented 2026-05-06: typed `query_plan` event emitted before retrieval and preserved in `/tool` trace UI.)*

### Graph synthesis truthfulness & provenance

- [x] **SYN-01**: Edges carry explicit grounding to sources (for example passage- or URL-level linkage) validated before the graph is shown as authoritative structure. *(Implemented 2026-05-08: passage-level evidence IDs, source IDs, grounded synthesis prompt, provenance validator, repair/reject logic, and fallback floor.)*
- [x] **SYN-02**: Responses distinguish primary synthesis versus fallback pathways in telemetry and surfaced UX so degraded runs are detectable. *(Implemented 2026-05-08: `resultType`/`resultReason` stream payload, compact `/tool` status, and Supabase provenance telemetry.)*

### Visualization & comprehension

- [ ] **VIS-01**: The network view scales to richer graphs interactively (layout + performance appropriate to WebGL-backed rendering or an equivalent credible approach documented in `.planning/research/`).
- [ ] **VIS-02**: Nodes and edges are visually encoded by type/category so dense graphs remain scannable.
- [ ] **VIS-03**: Communities or clusters can be computed and surfaced in the visualization layer for medium-to-large graphs.

### Evidence & UX

- [ ] **EVID-01**: The evidence UI presents ranked excerpts or pointers tied to node- or edge-level provenance data produced by synthesis.

## v2 Requirements (defer)

- **HIST-01**: Persisted graph history / session memory across visits (product decision + storage model).
- **SHARE-01**: Shareable read-only graph links with access control.
- **DOC-01**: First-class document and PDF ingestion with a dedicated security review.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native clients | Web-first; separate release train |
| Full third-party model marketplace | Keep OpenAI primary path; revisit if product demands |
| Full adversarial red-team of all prompts | Out of band unless sponsor requires formal review |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STREAM-01 | Phase 1 — Stream Contract & Foundation Types | Done (UAT pending) |
| STREAM-02 | Phase 1 — Stream Contract & Foundation Types | Done (UAT pending) |
| OBS-01 | Phase 2 — Observability, Security & Cost Controls | Pending |
| OBS-02 | Phase 2 — Observability, Security & Cost Controls | Pending |
| OBS-03 | Phase 2 — Observability, Security & Cost Controls | Pending |
| PIPE-01 | Phase 3 — Pipeline Extraction & Scorer | Done |
| PIPE-02 | Phase 3 — Pipeline Extraction & Scorer | Done |
| RTRY-01 | Phase 4 — Multi-Stage Retrieval & Query Planner | Done |
| RTRY-02 | Phase 4 — Multi-Stage Retrieval & Query Planner | Done |
| SYN-01 | Phase 5 — Graph Synthesis Quality & Provenance | Done |
| SYN-02 | Phase 5 — Graph Synthesis Quality & Provenance | Done |
| VIS-01 | Phase 6 — Graph Visualization Upgrade | Pending |
| VIS-02 | Phase 6 — Graph Visualization Upgrade | Pending |
| VIS-03 | Phase 6 — Graph Visualization Upgrade | Pending |
| EVID-01 | Phase 7 — Evidence Panel & UX Polish | Pending |

**Coverage:**  
- v1 requirements: 15 total  
- Mapped to phases: 15  
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-06*  
*Last updated: 2026-05-08 — SYN-01/02 marked done after Phase 5 verification*
