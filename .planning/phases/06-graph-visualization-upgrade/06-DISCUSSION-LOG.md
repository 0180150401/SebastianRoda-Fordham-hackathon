# Phase 6: Graph Visualization Upgrade - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 06-graph-visualization-upgrade
**Areas discussed:** Node type schema, Cluster vs type encoding, Component extraction, Existing UX parity

---

## Node type schema

| Option | Description | Selected |
|--------|-------------|----------|
| Update synthesis schema | Phase 6 updates structurer prompt + GraphNode schema to emit entityType alongside existing category. Pipeline change in Phase 6 scope. | ✓ |
| Map existing categories | Keep current pipeline output; map brand/aesthetic/etc to new visual shapes. No pipeline change. | |
| Add entityType field later | Build renderer to support types, leave type='unknown' for now; Phase 7 wires actual data. | |

**User's choice:** Update synthesis schema (recommended default)
**Notes:** Add entityType: 'Person'\|'Org'\|'Concept'\|'Event'\|'Claim' alongside existing category.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both in parallel | Add entityType as new field; category stays for backwards compat with existing panels. | ✓ |
| Replace category with entityType | Remove category; entityType becomes sole classification. Breaks existing panels. | |
| Make category optional | category deprecated but still readable; entityType authoritative. | |

**User's choice:** Keep both in parallel (recommended default)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Causal / Associative / Contextual | Add relType: 'causal'\|'associative'\|'contextual' to GraphLink. Matches Phase 6 success criteria. | ✓ |
| Keep existing edge schema | No edge type changes; use weight/missing for visual differentiation only. | |
| Add relType but simple | 2 values: 'direct'\|'indirect'. Lower LLM burden. | |

**User's choice:** Causal / Associative / Contextual (recommended default)

---

## Cluster vs type encoding

| Option | Description | Selected |
|--------|-------------|----------|
| Entity type = color, cluster = border ring | Node fill color encodes entityType; cluster as ring/border. | ✓ |
| Cluster = color, entity type = shape | Cluster takes fill color; type encoded via node shape. | |
| Cluster = color, entity type = label prefix | Cluster takes color; type as label prefix (P: / O: etc). | |

**User's choice:** Entity type = color, cluster = border ring (recommended default)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Only when ≥3 clusters detected | Ring renders only when Louvain finds meaningful clustering. Clean for small graphs. | ✓ |
| Always visible | Every node always shows ring regardless of cluster count. | |
| User toggle | 'Show clusters' UI toggle for on/off control. | |

**User's choice:** Only when ≥3 clusters detected (recommended default)

---

## Component extraction

| Option | Description | Selected |
|--------|-------------|----------|
| New components/tool/semantic-graph.tsx | Dedicated component; page drops sigma/graphology/worker concerns into it. | ✓ |
| Keep inline in app/tool/page.tsx | Replace SVG block in-place within 1,627-line page. | |
| New app/tool/graph/page.tsx route | Full sub-route — overkill for a panel component. | |

**User's choice:** New components/tool/semantic-graph.tsx (recommended default)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed height matching current (72vh) | Match existing h-[72vh] Tailwind class. No layout change. | ✓ |
| Full-height with resize observer | ResizeObserver fills parent dynamically. More complex. | |

**User's choice:** Fixed height matching current (recommended default)

---

## Existing UX parity

| Option | Description | Selected |
|--------|-------------|----------|
| Pan + zoom | sigma native camera controls. Core navigation. | ✓ |
| Node drag | sigma DragEvents. | |
| Node selection + evidence panel | Click fires setSelectedNodeId to sidebar. | |
| PNG export | WebGL canvas toBlob() export. | |

**User's choice:** Pan + zoom (initial multi-select)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep node selection | Node click fires onNodeSelect callback to parent. Core product interaction. | ✓ |
| Drop it for now | Re-wire in Phase 7 with full evidence panel. | |
| Simplified: click highlights only | Highlights in graph but no sidebar panel. | |

**User's choice:** Keep node selection (recommended default)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Defer both drag + export to Phase 7 | Phase 6 focused on renderer migration + encoding. Less scope. | ✓ |
| Keep drag, defer export | Drag essential for exploration; export can wait. | |
| Keep both | Full UX parity in Phase 6. | |

**User's choice:** Defer both to Phase 7

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 'Show gaps only', re-wire to sigma | Toggle filters missing=true edges; re-wire to sigma graph. | ✓ |
| Drop in Phase 6, add back in Phase 7 | Simplifies sigma integration. | |
| You decide | Claude picks most practical approach. | |

**User's choice:** Keep it, re-wire to sigma (recommended default)

---

## Claude's Discretion

- Exact color palette for 5 entity type colors and cluster ring colors
- ForceAtlas2 configuration parameters
- Graphology graph initialization and rebuild pattern on props change
- Sigma border ring implementation approach
- Label rendering approach in sigma
- Edge stroke styling for relType encoding

## Deferred Ideas

- Node drag — Phase 7
- PNG export — Phase 7
- Full evidence panel UX tied to node selection — Phase 7
