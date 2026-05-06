# Feature Research

**Domain:** AI semantic graph / web-research product (brownfield enhancement — 6-degrees v2 milestone)
**Researched:** 2026-05-06
**Confidence:** MEDIUM-HIGH (competitive landscape verified via multiple sources; project-specific applicability inferred from codebase mapping)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Source citations with clickable links | Every credible AI research tool (Perplexity, KnolAI, TrustGraph) ships inline citations tied to claims — users penalize absence | LOW | OG-image enrichment already exists; clickable source links per node/edge are the gap |
| Streaming progress with visible steps | Users expect to watch long AI work happen — "working…" spinners are no longer acceptable | LOW | Already implemented via NDJSON stream; labeling/step copy quality is the improvement surface |
| Zoom, pan, drag on graph canvas | Any graph tool without these feels broken | LOW | Assumed present; verify physics stabilization on large graphs |
| Node click → details/evidence panel | Clicking a node to see why it exists (source excerpt, entity type, related nodes) is expected | MEDIUM | Partially exists ("evidence and discourse panels" per architecture); completeness is the gap |
| Fallback / error recovery with user feedback | Users expect graceful degradation, not blank screens | LOW | Fallback graph builder already exists; surface fallback reason visibly to user |
| Basic graph labeling (node names, edge types) | Unlabeled nodes are unreadable | LOW | Already present; edge type labels (causal, associative, etc.) may be missing |
| Re-run / refresh analysis | Users expect to re-query with updated terms without a full page reload | LOW | Standard product-loop UX |
| Query input with intent clarity | Users need to understand what "topic" to enter and what they'll get back | LOW | Copy/placeholder text, example queries, brief explanation of graph semantics |
| Loading state that conveys stages | "Step 2 of 4: Synthesizing graph" outperforms a spinner and builds trust in the model | LOW | Stream infrastructure is there; step labels should match user mental model |

---

### Differentiators (Competitive Advantage)

Features that set 6-degrees apart. These align with the Core Value: *trustworthy, explorable graph of entities grounded in fresh web evidence.*

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-stage retrieval pipeline with query planning | Produces dramatically better graphs — broad anchor queries → focused follow-up → scoring/re-ranking before synthesis; matches state-of-art (Deep GraphRAG, PAR²-RAG, ACQO); users feel the difference as "richer, denser graphs" | HIGH | Core pipeline upgrade; add query-plan step before Tavily/Exa fetch; add re-ranker pass before OpenAI synthesis |
| Per-node source provenance (passage-level, not URL-level) | 2026 standard is passage-level citations — linking node to the specific excerpt that grounded it, not just the domain; builds trust in individual claims | MEDIUM | Requires enrichment pass that extracts and stores relevant passages per synthesized entity |
| Cluster / community detection with semantic labels | Users can't parse 50+ nodes without spatial grouping; auto-detected clusters with AI-generated summaries ("3 entities about monetary policy") make graphs scannable at a glance | MEDIUM | Community detection (Louvain or modularity) runs on graph data; cluster label synthesis is one extra OpenAI call |
| Node/edge type visual encoding | Encoding type (Person, Organization, Concept, Event; causal vs associative edge) into shape/color lets users orient faster than reading labels | MEDIUM | Schema work: define fixed node types in prompt, map to visual tokens in graph renderer |
| Confidence / weight scoring on nodes and edges | Shows model certainty; users can filter out low-confidence edges; differentiates from "black box graph" tools | MEDIUM | Retrieve relevance scores from Exa/Tavily and propagate through synthesis prompt; render as opacity or edge thickness |
| Query-plan visibility in stream | Showing "expanding query to include [related term]" in the step stream makes the pipeline legible and builds trust before the graph loads | LOW | Stream a `query_plan` step event type from route handler; render distinctly in UI |
| Evidence panel with ranked source excerpts per node | On node click, show the top 2–3 source passages that grounded this entity, ranked by retrieval score; lets users validate the model's reasoning | MEDIUM | Requires passage storage per node during synthesis; feeds the existing "evidence panel" |
| Discourse / perspective facets | For contested topics, surfaces opposing viewpoints as edge attributes or a "perspectives" sub-panel; uniquely legible for news/research topics | HIGH | Requires separate "perspective" extraction step in synthesis prompt; adds significant synthesis complexity |
| Adaptive query expansion for thin results | If initial retrieval returns < N sources or diversity score is low, automatically re-query with expanded/related terms before synthesis; improves graph density silently | MEDIUM | Threshold check after deduplication step; trigger secondary Tavily/Exa calls with rephrased queries |
| Graph history / session memory | Users can switch between prior analyses without re-running; treats the workspace as a persistent research session | MEDIUM | Requires storing completed graph payloads per user (Supabase table); minimal UI to list/load prior runs |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like good ideas but introduce disproportionate complexity, scope drift, or UX harm.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time collaborative graphs | "Multiplayer" is popular in tools like Figma/Miro | Multi-user state sync on a graph with live streaming is enormous complexity; the product value is individual insight, not co-authoring | Add graph sharing via shareable read-only URL instead — delivers 80% of the value |
| Chat interface on top of the graph | "Talk to the graph" is a natural-sounding request | Dilutes the graph-first identity; chat pulls investment away from the visualizer; Perplexity already owns the chat-first lane | Add a focused "expand node" action (click → spawn sub-graph) that feels like conversation without the full chat paradigm |
| Manual node/edge CRUD (edit graph by hand) | Power users want to fix wrong nodes | Makes 6-degrees feel like a diagramming tool (Lucidchart, Miro) instead of an insight engine; maintenance and persistence cost is high | Surface a "regenerate from corrected query" flow — fix the input, not the output |
| Full document / PDF ingestion pipeline | Enterprise users want to ground graphs in private documents | Completely different product surface (enterprise RAG); OAuth scoping, chunking, vector store, and security model are a separate milestone | Note as future milestone gate; out of scope until web-research pipeline is excellent |
| One-click export to Notion/Obsidian/Roam | Productivity users love integrations | Each integration is a maintenance contract; v1 integrations routinely break on third-party API changes | Ship PNG/SVG export of the graph first; satisfy the "save my work" need without API dependency |
| Real-time "live graph" auto-refresh | Feels dynamic and modern | Users rarely benefit from stale-cache invalidation on semantic topics; adds polling complexity; introduces race conditions in stream state | Add a manual "refresh" button with a "last analyzed" timestamp |
| Full ontology / schema editor | "Let me define my own node types" | Schema proliferation is a documented anti-pattern (LLMs produce inconsistent hierarchies); user-editable schemas require governance infrastructure | Keep a fixed, small node-type vocabulary (Person, Org, Concept, Event, Claim) in the synthesis prompt — cover 95% of use cases |
| Raw graph data export (JSON/CSV download) | Developers and researchers want the data | Encourages using 6-degrees as a data pipe, not a product; drives engineering support for edge-case data shapes | Offer a structured summary export (markdown or JSON of key entities + sources) instead — satisfies the content need without graph-structure dependencies |

---

## Feature Dependencies

```
[Multi-stage retrieval pipeline]
    └──required by──> [Confidence / weight scoring on nodes and edges]
    └──required by──> [Adaptive query expansion for thin results]
    └──required by──> [Query-plan visibility in stream]

[Per-node source provenance]
    └──required by──> [Evidence panel with ranked source excerpts]

[Node/edge type visual encoding]
    └──enhances──> [Cluster / community detection with semantic labels]

[Cluster / community detection]
    └──required by──> [Cluster semantic labels]

[Graph history / session memory]
    └──enhances──> [Discourse / perspective facets]

[Discourse / perspective facets] ──conflicts──> [Simple confidence scoring]
    (perspective framing implies multiple conflicting truths; confidence scoring implies one ground truth)
```

### Dependency Notes

- **Multi-stage pipeline required by scoring and expansion:** Retrieval scores only exist if the pipeline retrieves and ranks before synthesis; confidence cannot be retrofitted onto a single-pass pipeline.
- **Provenance required by evidence panel:** The evidence panel is a UI shell today; it needs per-node passage storage from the pipeline to have real content.
- **Cluster detection before cluster labels:** Community detection (Louvain on the node–edge graph) must run first; the label generation is a follow-on synthesis call on the cluster membership.
- **Perspective facets conflict with confidence scoring:** Confidence implies ground truth probability; perspectives imply epistemic pluralism. Ship one framing per milestone — avoid shipping both as co-equal UI concepts simultaneously.

---

## MVP Definition

> This is a brownfield project; v1 is shipped. Sections below reflect the **current milestone** (v2 enhancement cycle).

### Already Shipped (v1 — validated)

- [x] Auth, session management, route protection
- [x] Streaming NDJSON pipeline with step events
- [x] Multi-source fetch (Tavily + Exa) with deduplication
- [x] OpenAI synthesis to node–edge graph payload
- [x] Interactive graph with OG image enrichment
- [x] Evidence and discourse panels (shell)
- [x] Stripe-backed access control and demo limits

### Launch With (v2 milestone — next shipping target)

- [ ] **Multi-stage retrieval pipeline with query planning** — core improvement to graph quality; all other quality features depend on it
- [ ] **Query-plan visibility in stream** — low-effort trust signal; reuses stream infrastructure; ships with pipeline upgrade
- [ ] **Per-node source provenance (passage-level)** — fills the evidence panel; directly addresses "trustworthy, grounded" core value
- [ ] **Cluster detection + semantic cluster labels** — makes larger graphs readable; highest visual impact per implementation effort
- [ ] **Node/edge type visual encoding** — fixed vocabulary (5 node types, 3 edge types); moderate effort, high legibility payoff

### Add After Validation (v2.x)

- [ ] **Confidence / weight scoring on nodes and edges** — visible only once users trust the pipeline; add when retention data shows users re-running
- [ ] **Adaptive query expansion for thin results** — silent UX improvement; add when pipeline is stable enough to measure "thin result" cases
- [ ] **Graph history / session memory** — add when usage data shows users returning and re-running the same or similar queries
- [ ] **Evidence panel ranked excerpts** — depends on provenance landing; ship once provenance data is in place for 2+ runs

### Future Consideration (v3+)

- [ ] **Discourse / perspective facets** — high complexity; justified only when topic coverage is wide and users are encountering contested topics repeatedly
- [ ] **Shareable read-only graph URL** — defer until retention baseline established; social sharing is a growth lever, not a core UX fix
- [ ] **Document / PDF ingestion pipeline** — separate product milestone; requires security model, chunking, and storage architecture not present in current stack

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Multi-stage retrieval pipeline | HIGH | HIGH | P1 |
| Query-plan visibility in stream | HIGH | LOW | P1 |
| Per-node source provenance | HIGH | MEDIUM | P1 |
| Cluster detection + semantic labels | HIGH | MEDIUM | P1 |
| Node/edge type visual encoding | MEDIUM | MEDIUM | P1 |
| Evidence panel ranked excerpts | HIGH | LOW (after provenance) | P2 |
| Confidence / weight scoring | MEDIUM | MEDIUM | P2 |
| Adaptive query expansion | HIGH | MEDIUM | P2 |
| Graph history / session memory | MEDIUM | MEDIUM | P2 |
| Discourse / perspective facets | HIGH (niche) | HIGH | P3 |
| Shareable read-only URL | MEDIUM | LOW | P3 |
| Document / PDF ingestion | HIGH (enterprise) | HIGH | P3 |

**Priority key:**
- P1: Must have for v2 milestone launch
- P2: Should have, add when P1 items are validated
- P3: Nice to have, future milestone

---

## Competitor Feature Analysis

| Feature | ResearchRabbit | Perplexity Sonar Deep Research | TrustGraph 2 | 6-degrees (current) | 6-degrees (target) |
|---------|----------------|-------------------------------|--------------|---------------------|-------------------|
| Source citations | Document-level | Inline, numbered | Passage-level (PROV-O) | URL + OG image | Passage-level per node |
| Graph visualization | Interactive network (author + paper) | None | None | Force-directed node–edge | Force-directed + clusters + type encoding |
| Multi-stage retrieval | Algorithm-based (citation graph) | Exhaustive multi-source | Document lineage | Single-pass parallel fetch | Query plan → fetch → re-rank → synthesize |
| Provenance transparency | High (explainable algorithms) | Medium (inline citations) | High (full trace) | Low (OG images) | High (passage-level per node) |
| Streaming UX | None | None | None | Step stream | Step stream + query plan steps |
| Confidence scoring | None | None | Full lineage trace | None | Opacity / edge weight |
| Cluster detection | Yes (author communities) | None | None | None | Louvain + semantic labels |
| Domain | Academic papers only | General web | Enterprise documents | General web | General web |

---

## Sources

- ResearchRabbit feature set: https://www.researchrabbit.ai/features + https://learn.researchrabbit.ai/en/articles/12454456-introduction-to-researchrabbit
- Perplexity Sonar Deep Research: https://docs.perplexity.ai/docs/sonar/models/sonar-deep-research
- TrustGraph 2 provenance model: https://trustgraph.ai/news/release-2-1
- KnolAI citation standards: https://www.pienomial.com/products/knol-ai
- Atlas Workspace citation accuracy analysis: https://atlasworkspace.ai/blog/ai-with-references
- Deep GraphRAG hierarchical retrieval: https://arxiv.org/abs/2601.11144v3
- PAR²-RAG breadth-first anchoring: https://arxiv.org/pdf/2603.29085
- ACQO adaptive query optimization: https://arxiv.org/abs/2601.21208v1
- Knowledge graph anti-patterns: https://www.semanticarts.com/six-enterprise-knowledge-graph-anti-patterns/
- LLM ontology engineering failures: https://graphresearchlabs.com/llm-as-ontology-engineer/
- One-click graph creation problems: https://medium.com/enterprise-rag/one-click-graph-creation-creates-bad-graphs-f12a806b9548
- GraphRAG at 12M nodes (lessons): https://particula.tech/blog/graphrag-implementation-enterprise-data-platform
- Network visualizer UX (ZoomCharts, Gephi): https://js.zoomcharts.com/charts/net-chart + https://gephi.github.io/desktop
- Graph visualization UX complaints (GitHub issues): https://github.com/splx-ai/agentic-radar/issues/35

---
*Feature research for: AI semantic graph / web-research product (6-degrees v2 milestone)*
*Researched: 2026-05-06*
