# Phase 6: Graph Visualization Upgrade - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current SVG + custom JS force simulation renderer with a sigma/graphology WebGL-backed renderer that handles large typed graphs at interactive frame rates. This phase delivers: sigma/graphology WebGL rendering, Louvain community detection with visual cluster encoding, ForceAtlas2 layout off the main thread via web worker, and type-based visual encoding for ≥5 node entity types and ≥3 edge relationship types.

**Also in scope for Phase 6:** Updating the synthesis pipeline schema to emit `entityType` on nodes and `relType` on edges — this is a pipeline change required to feed the new visual encoding.

**Out of scope:** Full evidence panel UX (Phase 7), node drag behavior (Phase 7), PNG export (Phase 7), broad page redesign, new retrieval or synthesis pipeline changes beyond schema fields.

</domain>

<decisions>
## Implementation Decisions

### Node Type Schema
- **D-01:** Add `entityType: 'Person' | 'Org' | 'Concept' | 'Event' | 'Claim'` as a new field on `GraphNode` in `lib/pipeline/models.ts`. This is additive — the existing `category: NodeCategory` field (`brand | aesthetic | query | competitor | gap`) is kept in parallel for backwards compatibility with existing UI panels (discourse items, model strength, gaps filter, discourse discourse panel) that key off `category`.
- **D-02:** Update the synthesis prompt in `lib/pipeline/structurer.ts` to classify each node with an `entityType` using the five entity categories. The LLM emits both `category` (existing) and `entityType` (new) in the structured JSON output.
- **D-03:** Add `relType: 'causal' | 'associative' | 'contextual'` as a new field on `GraphLink`. Update the synthesis prompt to classify each edge relationship. Existing edge fields (`weight`, `missing`, `dominantCompetitor`, `evidenceIds`, `sourceIds`) are preserved.

### Visual Encoding
- **D-04:** Entity type is the **primary visual channel (fill color)**: each `entityType` value maps to a distinct fill color. 5 colors needed for Person, Org, Concept, Event, Claim.
- **D-05:** Louvain community membership is encoded as a **colored border ring** around each node. The ring color comes from the detected community assignment.
- **D-06:** The cluster ring only renders when Louvain detects **≥3 communities**. On smaller or less-clustered graphs, the ring is hidden — nodes render with fill color only. No visual noise on simple graphs.
- **D-07:** Edge visual style encodes `relType`: causal = solid thick stroke, associative = solid thin stroke, contextual = dashed stroke (or equivalent visually distinct style). Existing `missing` flag continues to render with the current dashed red treatment.

### Component Architecture
- **D-08:** Extract the entire graph rendering concern into a new dedicated component: `components/tool/semantic-graph.tsx`. This component receives `nodes`, `links`, `selectedNodeId`, `showGapsOnly`, and `onNodeSelect` as props. The parent `app/tool/page.tsx` renders this component instead of the inline SVG block.
- **D-09:** The sigma container uses a fixed height of `72vh` (Tailwind: `h-[72vh]`) matching the current SVG `h-[72vh] w-full` treatment. No ResizeObserver in Phase 6.
- **D-10:** `components/tool/semantic-graph.tsx` is a `'use client'` component. It manages graphology graph state, ForceAtlas2 web worker lifecycle, and Louvain computation internally.

### Layout and Clustering
- **D-11:** ForceAtlas2 layout runs off the main thread using `graphology-layout-forceatlas2`'s built-in worker mode. The page remains responsive during layout computation on large graphs (Phase 6 success criterion).
- **D-12:** Louvain community detection runs via `graphology-communities-louvain` on the client after the graph is constructed. Communities are assigned once after initial layout stabilizes.

### Preserved UX
- **D-13:** Pan and zoom are preserved — handled natively by sigma's built-in camera controls via `@react-sigma/core`.
- **D-14:** Node selection is preserved — clicking a node triggers `onNodeSelect(nodeId)` callback, which updates `selectedNodeId` state in the parent `app/tool/page.tsx`. The existing evidence/info sidebar continues to respond to this state.
- **D-15:** "Show gaps only" toggle is preserved and re-wired. When active, only edges with `missing: true` are passed to the sigma graph. The toggle state lives in the parent page and is passed as `showGapsOnly` prop.

### Deferred to Phase 7
- **D-16:** Node drag is deferred to Phase 7. Phase 6 sigma renderer does not implement draggable nodes.
- **D-17:** PNG export is deferred to Phase 7. The WebGL canvas export path (`canvas.toBlob()`) will be added during Phase 7 UX polish.

### Claude's Discretion
- Exact color palette for the 5 entity type colors and cluster ring colors (should be visually distinct and accessible)
- Exact ForceAtlas2 configuration parameters (iterations, gravity, scaling ratio, barnesHutOptimize threshold)
- Graphology graph initialization pattern and how/when the graph is rebuilt when the `nodes`/`links` props change
- Sigma node renderer implementation details for the border ring (custom program or node attribute approach)
- Whether to use sigma's built-in label rendering or a custom label approach
- Exact edge stroke widths and dash patterns for relType encoding

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Planning and requirements
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria (200+ node perf, Louvain clusters, ≥5 node types, ≥3 edge types, ForceAtlas2 web worker), and research flag (sigma/react-sigma v5 migration path)
- `.planning/REQUIREMENTS.md` — VIS-01, VIS-02, VIS-03 acceptance language
- `.planning/STATE.md` — Approved library list: `sigma@^3`, `@react-sigma/core@^5`, `graphology@^0.26`, `graphology-layout-forceatlas2`, `graphology-communities-louvain`, `graphology-metrics`

### Prior phase decisions
- `.planning/phases/05-graph-synthesis-quality-provenance/05-CONTEXT.md` — Phase 5 locked decisions on evidence/source provenance schema. Phase 6 synthesis schema changes must not break `evidenceIds` or `sourceIds` on nodes/edges.
- `.planning/phases/01-stream-contract-foundation-types/01-CONTEXT.md` — Typed NDJSON contract. `PipelineEvent` and `GraphNode`/`GraphLink` types live in `lib/pipeline/types.ts` and `lib/pipeline/models.ts`. Schema additions must extend, not break, the typed contract.

### Codebase entry points
- `app/tool/page.tsx` — Current inline SVG graph renderer (lines ~1,269–1,410), force simulation (`simulateGraph`), node/link state, pan/zoom/selection handlers, and `showGapsOnly` filter logic. Phase 6 replaces the SVG block with `<SemanticGraph ... />`.
- `lib/pipeline/models.ts` — `NodeCategory`, `GraphNode`, `GraphLink`, `SemanticUniversePayload` type definitions. Phase 6 adds `entityType` and `relType` fields here.
- `lib/pipeline/structurer.ts` — Synthesis prompt and JSON schema (line ~1,246+). Phase 6 updates the prompt to emit `entityType` and `relType`.
- `hooks/use-semantic-universe-stream.ts` — Stream consumer hook. Must accept the new `entityType`/`relType` fields without breaking.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/tool/page.tsx` `simulateGraph()`: Current custom force sim (lines ~618–700) — will be fully replaced by ForceAtlas2; can be deleted.
- `app/tool/page.tsx` `nodeColor()`: Current 5-category color function (lines ~609–616) — replace with `entityType`-based color map in the new component.
- `app/tool/page.tsx` node/link state + `showGapsOnly` filter logic — kept in `app/tool/page.tsx`; new `<SemanticGraph>` component accepts filtered results as props.
- `lib/utils.ts` `cn()` — available for className composition in the new component.

### Established Patterns
- `'use client'` components that co-exist with server-rendered layout: pattern established in `components/auth/require-tool-auth.tsx`, `components/tool/tool-access-gate.tsx`.
- Props-down / callback-up: parent page owns state, child component fires callbacks. Used throughout `app/tool/page.tsx` → `components/tool/*`.
- Named exports for components: `export function SemanticGraph(...)` — matches project conventions.
- `requestAnimationFrame`-based animation: current force sim uses it (lines ~762–789); ForceAtlas2 worker replaces this pattern.

### Integration Points
- `app/tool/page.tsx` renders the SVG block inside a `<div className="overflow-hidden rounded-xl border border-border bg-surface-inset">`. The new `<SemanticGraph>` component drops into this same div.
- `selectedNodeId` state in `app/tool/page.tsx` drives the evidence panel sidebar. `SemanticGraph` calls `onNodeSelect(id)` to update it.
- `showGapsOnly` + `visibleLinks`/`visibleNodes` memos in `app/tool/page.tsx` (lines ~966–990) — these filter the data before it reaches the graph. Phase 6 passes already-filtered nodes/links to `<SemanticGraph>`.
- `lib/pipeline/models.ts` exports `GraphNode`, `GraphLink`, `SemanticUniversePayload` — shared by the route handler, stream hook, and now the new graph component.

</code_context>

<specifics>
## Specific Ideas

- The border ring for Louvain clusters should only appear when ≥3 communities are detected — clean for simple graphs, informative for medium-to-large ones.
- sigma/graphology is already the approved library from prior research (STATE.md); no need to re-evaluate alternatives during planning.
- The synthesis prompt change is straightforward additive JSON schema extension — not a full restructuring of the synthesis approach.

</specifics>

<deferred>
## Deferred Ideas

- Node drag (re-adding draggable behavior to the sigma renderer) — Phase 7
- PNG export via sigma's WebGL canvas (`canvas.toBlob()`) — Phase 7
- Full evidence panel UX tied to node selection — Phase 7 (Phase 6 preserves the callback; the panel itself stays as-is)

</deferred>

---

*Phase: 06-graph-visualization-upgrade*
*Context gathered: 2026-05-06*
