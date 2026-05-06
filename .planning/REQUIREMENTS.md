# Requirements: 6-degrees v2 milestone

**Defined:** 2026-05-06  
**Core Value:** Users get a trustworthy, explorable graph of entities and relationships grounded in fresh web evidence, with clear provenance and legible model reasoning.

## v1 Requirements (this milestone)

### Stream contract & client consumption

- [ ] **STREAM-01**: Typed `PipelineEvent` (or equivalent) defines the NDJSON stream contract shared by `app/api/semantic-universe` and the `/tool` client, without breaking existing step semantics users rely on today.
- [ ] **STREAM-02**: Client stream handling is encapsulated (FSM hook or equivalent), replacing ad-hoc parsing so new event types can be added safely.

### Observability, security, and cost

- [ ] **OBS-01**: Each semantic run records measurable telemetry (latency by stage, token/cost proxies, counts of nodes/edges/sources) sufficient to compare quality changes before versus after pipeline work.
- [ ] **OBS-02**: Guardrails prevent runaway cost from retrieval or enrichment fan-out (caps, backoff, kill switches, or equivalent production-safe controls).
- [ ] **OBS-03**: API routes reachable from the client that perform paid or sensitive work require the same authentication and authorization posture as the rest of the tool (no orphaned public callers).

### Pipeline structure & retrieval quality

- [ ] **PIPE-01**: Semantic pipeline logic is modularized (`lib/pipeline/` or equivalent) with a slim route coordinator, preserving current behavior while enabling independent stage changes.
- [ ] **PIPE-02**: A scoring or reranking stage filters merged web results before synthesis so the LLM consumes higher-signal evidence.

### Multi-stage retrieval & planning

- [ ] **RTRY-01**: Retrieval uses multiple deliberate stages (planned sub-queries or equivalent) beyond a single Tavily + Exa pass, with deduplication and failure isolation between substeps.
- [ ] **RTRY-02**: The stream exposes enough of the retrieval plan that a user can see what the system searched for without reading server logs.

### Graph synthesis truthfulness & provenance

- [ ] **SYN-01**: Edges carry explicit grounding to sources (for example passage- or URL-level linkage) validated before the graph is shown as authoritative structure.
- [ ] **SYN-02**: Responses distinguish primary synthesis versus fallback pathways in telemetry and surfaced UX so degraded runs are detectable.

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
| STREAM-01 | Phase 1 — Stream Contract & Foundation Types | Pending |
| STREAM-02 | Phase 1 — Stream Contract & Foundation Types | Pending |
| OBS-01 | Phase 2 — Observability, Security & Cost Controls | Pending |
| OBS-02 | Phase 2 — Observability, Security & Cost Controls | Pending |
| OBS-03 | Phase 2 — Observability, Security & Cost Controls | Pending |
| PIPE-01 | Phase 3 — Pipeline Extraction & Scorer | Pending |
| PIPE-02 | Phase 3 — Pipeline Extraction & Scorer | Pending |
| RTRY-01 | Phase 4 — Multi-Stage Retrieval & Query Planner | Pending |
| RTRY-02 | Phase 4 — Multi-Stage Retrieval & Query Planner | Pending |
| SYN-01 | Phase 5 — Graph Synthesis Quality & Provenance | Pending |
| SYN-02 | Phase 5 — Graph Synthesis Quality & Provenance | Pending |
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
*Last updated: 2026-05-06 after roadmap creation — traceability complete*
