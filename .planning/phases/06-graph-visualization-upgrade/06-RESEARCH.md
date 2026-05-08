# Phase 6: Graph Visualization Upgrade - Research

**Researched:** 2026-05-08
**Domain:** sigma.js v3 + graphology WebGL graph rendering, ForceAtlas2 worker layout, Louvain community detection
**Confidence:** HIGH (core APIs verified via official docs and npm registry; one medium-confidence area noted for dashed edge workaround)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add `entityType: 'Person' | 'Org' | 'Concept' | 'Event' | 'Claim'` as a new field on `GraphNode` in `lib/pipeline/models.ts`. Additive — existing `category: NodeCategory` field is kept in parallel.
- **D-02:** Update the synthesis prompt in `lib/pipeline/structurer.ts` to classify each node with an `entityType`. LLM emits both `category` (existing) and `entityType` (new) in structured JSON output.
- **D-03:** Add `relType: 'causal' | 'associative' | 'contextual'` as a new field on `GraphLink`. Update synthesis prompt. Existing edge fields preserved.
- **D-04:** Entity type is the primary visual channel (fill color). 5 distinct fill colors needed.
- **D-05:** Louvain community membership is encoded as a colored border ring around each node.
- **D-06:** Cluster ring renders only when Louvain detects ≥3 communities. Hidden on simpler graphs.
- **D-07:** Edge visual style encodes `relType`: causal = solid thick, associative = solid thin, contextual = dashed (or equivalent). `missing: true` flag continues with dashed red treatment.
- **D-08:** Extract rendering into `components/tool/semantic-graph.tsx`. Props: `nodes`, `links`, `selectedNodeId`, `showGapsOnly`, `onNodeSelect`.
- **D-09:** Sigma container uses `h-[72vh]` (Tailwind), matching current SVG.
- **D-10:** Component is `'use client'`, manages graphology state, ForceAtlas2 worker lifecycle, and Louvain computation internally.
- **D-11:** ForceAtlas2 runs off main thread using `graphology-layout-forceatlas2` worker mode via `@react-sigma/layout-forceatlas2`.
- **D-12:** Louvain runs on the client after graph is constructed. Communities assigned once after initial layout stabilizes.
- **D-13:** Pan and zoom preserved — handled natively by sigma's built-in camera controls.
- **D-14:** Node selection preserved — clicking a node triggers `onNodeSelect(nodeId)` callback.
- **D-15:** "Show gaps only" toggle re-wired to sigma; parent passes already-filtered nodes/links as props.
- **D-16:** Node drag deferred to Phase 7.
- **D-17:** PNG export deferred to Phase 7.

### Claude's Discretion

- Exact color palette for 5 entity type fill colors and cluster ring colors
- Exact ForceAtlas2 configuration parameters (iterations, gravity, scaling ratio, barnesHutOptimize threshold)
- Graphology graph initialization pattern and when/how the graph is rebuilt when props change
- Sigma node renderer implementation details for the border ring (custom program or node attribute approach)
- Whether to use sigma's built-in label rendering or a custom label approach
- Exact edge stroke widths and dash patterns for relType encoding

### Deferred Ideas (OUT OF SCOPE)

- Node drag (Phase 7)
- PNG export via sigma WebGL canvas (Phase 7)
- Full evidence panel UX tied to node selection (Phase 7)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-01 | Network view scales to richer graphs interactively (layout + performance appropriate to WebGL-backed rendering) | sigma.js v3 WebGL rendering confirmed; ForceAtlas2 worker mode removes main-thread blocking; 200+ node target is achievable |
| VIS-02 | Nodes and edges visually encoded by type/category so dense graphs remain scannable | `@sigma/node-border` for entityType fill + Louvain ring; `edgeProgramClasses` type dispatch for relType edge styles |
| VIS-03 | Communities/clusters computed and surfaced in visualization layer for medium-to-large graphs | `graphology-communities-louvain` `louvain.detailed()` returns community count; ring renders only when ≥3 communities (D-06) |
</phase_requirements>

---

## Summary

Phase 6 replaces the current custom SVG + requestAnimationFrame force simulation in `app/tool/page.tsx` (lines ~1,269–1,410) with a sigma.js v3 / graphology WebGL renderer. The migration path is clear and well-documented: `@react-sigma/core@^5` provides `SigmaContainer`, `useLoadGraph`, `useRegisterEvents`, and layout hooks that integrate cleanly with Next.js 16 App Router `'use client'` components via dynamic import with `ssr: false`.

The approved library set (sigma@^3, @react-sigma/core@^5, graphology@^0.26, graphology-layout-forceatlas2@^0.10, graphology-communities-louvain@^2, @sigma/node-border@^3) covers every Phase 6 requirement without custom WebGL shader work. The `@sigma/node-border` package provides the community ring via `borderColor` node attribute using its pre-built `NodeBorderProgram`. ForceAtlas2 worker mode is available through `@react-sigma/layout-forceatlas2`'s `useWorkerLayoutForceAtlas2` hook — no manual worker file needed.

The one significant finding is that **sigma.js v3 does not natively support dashed edges**. The three built-in edge programs (EdgeLineProgram, EdgeRectangleProgram, EdgeArrowProgram) and the optional `@sigma/edge-curve` package all render solid strokes only. Dashed edge appearance for `relType: 'contextual'` and `missing: true` requires a visual encoding workaround — either color + opacity differentiation, or a custom GLSL edge program. Color + opacity differentiation is the pragmatic path for Phase 6; a custom GLSL dashed program is buildable but adds a full Wave.

**Primary recommendation:** Use `@react-sigma/layout-forceatlas2`'s `useWorkerLayoutForceAtlas2` hook (not raw `graphology-layout-forceatlas2/worker`) to minimize worker lifecycle boilerplate. Use `@sigma/node-border`'s `NodeBorderProgram` for entity-type fill + community ring. Encode edge `relType` visually via size (causal = 3px, associative = 1.5px) and color (contextual = muted/low-opacity) since dashed is not natively available.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sigma | 3.0.3 | WebGL graph renderer | Approved; handles 1000s of nodes at 60fps |
| @react-sigma/core | 5.0.6 | React wrapper: SigmaContainer, hooks | Approved; eliminates manual Sigma lifecycle management |
| graphology | 0.26.0 | Graph data model | Approved; required by sigma as peer dep |
| graphology-layout-forceatlas2 | 0.10.1 | ForceAtlas2 layout + worker | Approved; worker mode runs off main thread |
| graphology-communities-louvain | 2.0.2 | Louvain community detection | Approved; returns community partition + count |
| graphology-metrics | 2.4.0 | Graph metrics utilities | Approved; supplementary |
| @sigma/node-border | 3.0.0 | Border ring node renderer | Covers entityType fill + community ring in one program |

[VERIFIED: npm registry — all versions confirmed 2026-05-08]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-sigma/layout-forceatlas2 | 5.0.6 | React hook for FA2 worker (`useWorkerLayoutForceAtlas2`) | Preferred over manual worker lifecycle |
| @react-sigma/layout-core | 5.0.6 | Base layout hook primitives | Peer dep of layout-forceatlas2 |
| @sigma/edge-curve | 3.1.0 | Curved edge renderer | Not needed in Phase 6 unless curved edges requested |

[VERIFIED: npm registry]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-sigma/layout-forceatlas2 hook | Raw `graphology-layout-forceatlas2/worker` | Raw worker needs manual FA2LayoutSupervisor instantiation, start/kill cleanup; React hook handles lifecycle automatically |
| @sigma/node-border NodeBorderProgram | Custom GLSL NodeProgram | Custom program = more flexible but requires WebGL shader work; NodeBorderProgram covers the community ring requirement with zero custom shader code |
| Color/opacity edge differentiation | Custom dashed GLSL EdgeProgram | Custom dashed program is possible (buildable in ~1 task) but is scope creep; color + size encoding is sufficient for Phase 6 scanability |

**Installation:**
```bash
npm install sigma graphology @react-sigma/core @react-sigma/layout-core @react-sigma/layout-forceatlas2 graphology-layout-forceatlas2 graphology-communities-louvain graphology-metrics @sigma/node-border
```

---

## Architecture Patterns

### Recommended Project Structure
```
components/tool/
├── semantic-graph.tsx      # New 'use client' component — sigma/graphology renderer
app/tool/
└── page.tsx                # Parent: owns nodes/links/selectedNodeId state; renders <SemanticGraph>
lib/pipeline/
└── models.ts               # GraphNode + entityType, GraphLink + relType schema additions
lib/pipeline/
└── structurer.ts           # Synthesis prompt update: emit entityType + relType
```

### Pattern 1: SigmaContainer with dynamic import (Next.js SSR safety)

**What:** `SigmaContainer` uses WebGL and browser globals. Must be loaded client-side only.
**When to use:** Always — `components/tool/semantic-graph.tsx` is `'use client'` but sigma still needs `ssr: false` dynamic import to avoid `window is not defined` during SSR prerender.

```typescript
// Source: sim51.github.io/react-sigma/docs/start-setup/
// components/tool/semantic-graph.tsx
'use client';

import dynamic from 'next/dynamic';

// Dynamically import the inner sigma content to prevent SSR errors
const GraphInner = dynamic(() => import('./semantic-graph-inner'), { ssr: false });

export function SemanticGraph(props: SemanticGraphProps) {
  return <GraphInner {...props} />;
}
```

**Alternative:** The entire `semantic-graph.tsx` can be wrapped with `dynamic` at the parent call site in `app/tool/page.tsx`. Either approach works; co-locating the dynamic import inside the component is cleaner.

### Pattern 2: Graph initialization and rebuild when props change

**What:** Use `useLoadGraph` hook inside a child component of `SigmaContainer`. On props change, call `loadGraph(newGraph, true)` (clear=true) to replace the graph.
**When to use:** Every time the `nodes` or `links` props update (new analysis result arrives).

```typescript
// Source: sim51.github.io/react-sigma/docs/example/load-graph/
// Source: sim51.github.io/react-sigma/docs/api/core/functions/useLoadGraph
function GraphLoader({ nodes, links }: { nodes: GraphNode[]; links: GraphLink[] }) {
  const loadGraph = useLoadGraph();

  useEffect(() => {
    const graph = new Graph();

    for (const node of nodes) {
      graph.addNode(node.id, {
        label: node.label,
        x: Math.random(),   // sigma assigns layout via FA2; initial positions can be random
        y: Math.random(),
        size: node.size ?? 10,
        color: ENTITY_TYPE_COLORS[node.entityType ?? 'Concept'],
        type: 'border',     // required to activate NodeBorderProgram
        borderColor: 'transparent', // updated after Louvain runs
      });
    }

    for (const link of links) {
      graph.addEdge(link.source, link.target, {
        id: link.id,
        size: edgeSizeForRelType(link.relType),
        color: edgeColorForLink(link),
        type: 'line',       // default edge program
      });
    }

    // loadGraph with clear=true replaces previous graph
    loadGraph(graph, true);
  }, [nodes, links, loadGraph]);

  return null;
}
```

**Key insight:** `SigmaContainer`'s `graph` prop is treated as immutable (re-passing triggers full sigma re-init including losing camera state). The `useLoadGraph` hook is the correct pattern for dynamic updates — it loads into the existing sigma instance and preserves camera state.

### Pattern 3: ForceAtlas2 worker via useWorkerLayoutForceAtlas2

**What:** `useWorkerLayoutForceAtlas2` from `@react-sigma/layout-forceatlas2` manages the FA2 worker lifecycle. Start on mount, stop after N seconds, kill on unmount.
**When to use:** After graph is loaded. The worker runs in background and updates node positions in the graphology graph; sigma re-renders automatically.

```typescript
// Source: sim51.github.io/react-sigma/docs/api/layout-forceatlas2/functions/useWorkerLayoutForceAtlas2
// Source: sim51.github.io/react-sigma/docs/example/layouts/
function LayoutController() {
  const { start, stop, kill } = useWorkerLayoutForceAtlas2({
    settings: {
      slowDown: 10,
      gravity: 1,
      scalingRatio: 2,
      barnesHutOptimize: true,   // critical for 200+ node performance
      barnesHutTheta: 0.5,
    },
  });

  useEffect(() => {
    start();
    // Stop after layout stabilizes (~5s for medium graphs, ~10s for large)
    const timer = setTimeout(stop, 6000);
    return () => {
      clearTimeout(timer);
      stop();
      kill();
    };
  }, [start, stop, kill]);

  return null;
}
```

**Component placement:** `LayoutController` must be a child of `SigmaContainer` (the hook reads from sigma context). It must also mount after the graph is loaded — sequence via `useState` flag: `graphLoaded` → render `<LayoutController>`.

### Pattern 4: Louvain community detection and border ring coloring

**What:** After FA2 layout stabilizes (on stop), run `louvain.detailed(graph)` to get community count and partition. If ≥3 communities, assign `borderColor` to each node and update sigma settings to use `NodeBorderProgram`.
**When to use:** Once per graph load, after ForceAtlas2 stops.

```typescript
// Source: graphology.github.io/standard-library/communities-louvain.html
import louvain from 'graphology-communities-louvain';
import { NodeBorderProgram } from '@sigma/node-border';

function applyLouvainColors(graph: Graph, sigma: Sigma): void {
  const result = louvain.detailed(graph);

  if (result.count < 3) {
    // Not enough communities — keep borderColor transparent
    return;
  }

  const palette = COMMUNITY_RING_COLORS; // 8-color array of distinct hues
  graph.forEachNode((nodeId) => {
    const community = result.communities[nodeId];
    graph.setNodeAttribute(nodeId, 'borderColor', palette[community % palette.length]);
  });
  // Sigma picks up attribute changes automatically — no explicit refresh needed
}
```

**Attribute `community` vs direct color:** `louvain.assign(graph)` writes a `community` integer attribute on each node. `louvain.detailed(graph).communities` returns the partition object. Either approach works; `detailed` gives the count check for the ≥3 guard.

### Pattern 5: Node event handling (selection callback)

**What:** `useRegisterEvents` maps sigma's `clickNode` event to the parent's `onNodeSelect` callback.

```typescript
// Source: sim51.github.io/react-sigma/docs/api/core/functions/useRegisterEvents
function EventHandlers({ onNodeSelect }: { onNodeSelect: (id: string) => void }) {
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    registerEvents({
      clickNode: (event) => onNodeSelect(event.node),
      clickStage: () => onNodeSelect(''),
    });
  }, [registerEvents, onNodeSelect]);

  return null;
}
```

### Pattern 6: nodeProgramClasses configuration for @sigma/node-border

**What:** Set `node.type = 'border'` on each node and register `NodeBorderProgram` in sigma settings.

```typescript
// Source: npmjs.com/package/@sigma/node-border, sigma.js renderer docs
import { NodeBorderProgram } from '@sigma/node-border';

<SigmaContainer
  style={{ height: '72vh', width: '100%' }}
  settings={{
    nodeProgramClasses: {
      border: NodeBorderProgram,
    },
    defaultNodeType: 'border',
    renderLabels: true,
    labelDensity: 0.07,
    labelGridCellSize: 60,
  }}
>
```

`NodeBorderProgram` reads: `color` (fill), `borderColor` (ring), `size`. Border thickness defaults to 10% of node radius. Use `createNodeBorderProgram` factory for customizing the ratio — e.g. `createNodeBorderProgram([{ color: { value: 'borderColor' }, size: { value: 0.15 } }])` for a 15% ring.

### Pattern 7: Multiple edge visual styles via edgeProgramClasses

**What:** Sigma dispatches edge rendering by `edge.type` attribute. Register separate programs for each relType.

**Constraint (CRITICAL):** Sigma v3 has no native dashed edge support. `EdgeLineProgram`, `EdgeRectangleProgram`, and `@sigma/edge-curve` all render solid strokes. Dashed appearance must be achieved through color/opacity/size differentiation or a custom GLSL program.

**Recommended Phase 6 approach** — size + color encoding, no custom shader needed:

```typescript
// Source: sigmajs.org/docs/advanced/data/ — type attribute, edgeProgramClasses
// Edge attribute mapping
function edgeSizeForRelType(relType?: string, missing?: boolean): number {
  if (missing) return 2;        // gap edges: medium, will be red
  if (relType === 'causal') return 3.5;
  if (relType === 'associative') return 1.5;
  return 1;                     // contextual: thin
}

function edgeColorForLink(link: GraphLink): string {
  if (link.missing) return '#fb7185';   // red — gap edges (existing treatment)
  if (link.relType === 'causal') return '#94a3b8';      // solid slate
  if (link.relType === 'associative') return '#64748b'; // medium slate
  return 'rgba(100,116,139,0.4)';       // contextual: muted/transparent
}
```

For a **full dashed contextual edge** in a future iteration: implement a custom `AbstractEdgeProgram` subclass with a GLSL fragment shader that discards fragments at alternating intervals. This is buildable but is scope-appropriate for Phase 7 UX polish.

### Anti-Patterns to Avoid
- **Passing a new `Graph` instance to `SigmaContainer`'s `graph` prop on re-render:** Kills and recreates the entire sigma instance, losing camera state and causing a visual flash. Use `useLoadGraph(graph, true)` inside a child instead.
- **Running Louvain before FA2 stabilizes:** Louvain detects communities based on graph structure, not position — it can run any time. But assigning border colors before layout stabilizes means nodes may reposition after the ring is drawn (visually jarring). Run Louvain in the FA2 stop callback or after the stabilization timeout.
- **Importing sigma/react-sigma in a server component:** These libraries access `window` and `WebGL` context at import time. Always `'use client'` + dynamic import with `ssr: false`.
- **Calling `graph.addNode()` when the node already exists:** Graphology throws `UsageGraphError`. Always call `graph.clear()` before re-populating (handled by `loadGraph(graph, true)`).
- **Missing CSS import:** `@react-sigma/core` requires `import '@react-sigma/core/lib/style.css'` (or the equivalent min.css) for the container to render correctly. Omitting it causes the sigma canvas to have 0 height.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebGL graph rendering | Custom canvas/WebGL renderer | sigma@^3 | Handles batched draw calls, picking, camera, zoom — 1000s of lines of non-trivial WebGL |
| ForceAtlas2 off-thread | Manual Worker + postMessage | `useWorkerLayoutForceAtlas2` | Worker instantiation, graph serialization to worker, position sync back — all abstracted |
| Graph data model | Plain JS object graph | graphology@^0.26 | Validated add/remove, attribute read/write, iterator API, peer dep of sigma |
| Community detection | Custom modularity algorithm | `graphology-communities-louvain` | Louvain is a multi-step algorithm (modularity optimization, dendrogram) — correctness-sensitive |
| Node border ring | Custom GLSL program from scratch | `@sigma/node-border` NodeBorderProgram | Zero-shader approach using pre-built WebGL program; `borderColor` attribute is all that's needed |

**Key insight:** The entire sigma ecosystem (sigma + @sigma/* packages + graphology + @react-sigma/*) is designed to be composed — each problem domain has an official package. Rolling custom solutions replicates well-tested WebGL and graph theory code.

---

## Common Pitfalls

### Pitfall 1: SSR crash — `window is not defined`
**What goes wrong:** Importing `@react-sigma/core` or `sigma` in any component that renders on the server causes a build/runtime crash.
**Why it happens:** Sigma accesses `document` and `WebGL` context at module level.
**How to avoid:** Wrap `SemanticGraph` (or its inner sigma content) with `dynamic(() => import(...), { ssr: false })`. The `'use client'` directive alone is not sufficient — Next.js still prerendering server-side will hit the import.
**Warning signs:** `ReferenceError: window is not defined` in Next.js dev server console.

[VERIFIED: sim51.github.io/react-sigma/docs/start-setup/ — explicitly documented]

### Pitfall 2: SigmaContainer height not set → invisible graph
**What goes wrong:** The sigma canvas renders with 0px height; graph appears blank.
**Why it happens:** SigmaContainer fills its container; if container has no explicit height, it collapses.
**How to avoid:** Pass `style={{ height: '72vh', width: '100%' }}` to `SigmaContainer` or wrap in a `<div className="h-[72vh] w-full">`.
**Warning signs:** Sigma canvas visible in DevTools DOM but no pixels shown; canvas height = 0.

[VERIFIED: sim51.github.io/react-sigma/docs/faq/ — documented as most common pitfall]

### Pitfall 3: Missing CSS import
**What goes wrong:** Sigma container renders incorrectly or cursor styling is wrong.
**How to avoid:** Add `import '@react-sigma/core/lib/style.css'` in `semantic-graph.tsx` (or the dynamic inner component).

[VERIFIED: sim51.github.io/react-sigma/docs/start-setup/]

### Pitfall 4: graph.addNode duplicate node error on prop update
**What goes wrong:** On second render when `nodes` prop changes, `graph.addNode()` throws `UsageGraphError: node already exists`.
**Why it happens:** The graphology graph instance persists across renders; previous nodes are still present.
**How to avoid:** Create a fresh `Graph()` and pass it to `loadGraph(graph, true)` — the `clear=true` argument clears previous state.
**Warning signs:** `UsageGraphError: Graph.addNode: the "X" node already exist in the graph.` in console.

[VERIFIED: github.com/sim51/react-sigma/issues/9]

### Pitfall 5: ForceAtlas2 worker never stops → runaway CPU
**What goes wrong:** Worker continues running indefinitely after component unmount, consuming CPU.
**Why it happens:** The worker runs until explicitly stopped; React does not stop it on unmount.
**How to avoid:** Return cleanup function from `useEffect` that calls `stop()` and `kill()`. Use `setTimeout` to auto-stop after layout stabilization window.
**Warning signs:** CPU usage stays elevated after navigating away from `/tool`; no visible slowdown but DevTools performance tab shows persistent worker activity.

[VERIFIED: github.com/sim51/react-sigma/issues/15 — documented issue]

### Pitfall 6: Louvain community count check skipped → ring on 1-community graphs
**What goes wrong:** Every node gets the same community ring color, making the ring meaningless visual noise on simple graphs.
**Why it happens:** `louvain.assign()` always assigns communities; without checking `count >= 3`, ring is applied even when the entire graph is one community.
**How to avoid:** Use `louvain.detailed(graph)` and check `result.count >= 3` before setting `borderColor`. If count < 3, set `borderColor` to `'transparent'` or omit it (D-06).

[VERIFIED: graphology.github.io/standard-library/communities-louvain.html — API confirmed]

### Pitfall 7: SigmaContainer settings treated as mutable
**What goes wrong:** Passing a new `settings` object on each render triggers full sigma re-instantiation (including WebGL context reset).
**Why it happens:** React re-renders generate new object references; sigma compares by reference.
**How to avoid:** Define `settings` as a `useMemo` or module-level constant — never inline object literals in JSX for sigma settings.
**Warning signs:** Visible flash/blink on any parent state change; graph resets to initial layout on every re-render.

[VERIFIED: sim51.github.io/react-sigma/docs/start-introduction/ — explicitly documented: "treat settings and graph as immutable"]

---

## Code Examples

### Complete SemanticGraph component skeleton (verified patterns)

```typescript
// components/tool/semantic-graph.tsx
// Source: sim51.github.io/react-sigma/docs/start-setup/ + example/load-graph/ + layout examples
'use client';

import dynamic from 'next/dynamic';
import type { GraphLink, GraphNode } from '@/lib/pipeline/models';

const SemanticGraphInner = dynamic(
  () => import('./semantic-graph-inner'),
  { ssr: false, loading: () => <div className="h-[72vh] w-full animate-pulse bg-surface-inset rounded-xl" /> }
);

export interface SemanticGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNodeId: string | null;
  showGapsOnly: boolean;
  onNodeSelect: (nodeId: string) => void;
}

export function SemanticGraph(props: SemanticGraphProps) {
  return <SemanticGraphInner {...props} />;
}
```

```typescript
// components/tool/semantic-graph-inner.tsx  (dynamically imported, client only)
'use client';

import '@react-sigma/core/lib/style.css';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSigma } from '@react-sigma/core';
import { useWorkerLayoutForceAtlas2 } from '@react-sigma/layout-forceatlas2';
import { NodeBorderProgram } from '@sigma/node-border';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SemanticGraphProps } from './semantic-graph';

// Module-level constant — never recreated (Pitfall 7)
const SIGMA_SETTINGS = {
  nodeProgramClasses: { border: NodeBorderProgram },
  defaultNodeType: 'border',
  renderLabels: true,
  labelDensity: 0.07,
  labelGridCellSize: 60,
  minCameraRatio: 0.1,
  maxCameraRatio: 10,
};

function GraphContent({ nodes, links, onNodeSelect }: SemanticGraphProps & { onNodeSelect: (id:string)=>void }) {
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const [graphLoaded, setGraphLoaded] = useState(false);

  // Build and load graph when props change
  useEffect(() => {
    const graph = new Graph();
    for (const node of nodes) {
      graph.addNode(node.id, {
        label: node.label,
        x: Math.random() * 10 - 5,
        y: Math.random() * 10 - 5,
        size: node.size ?? 10,
        color: ENTITY_TYPE_COLORS[node.entityType ?? 'Concept'],
        type: 'border',
        borderColor: 'transparent',
      });
    }
    for (const link of links) {
      if (graph.hasNode(link.source) && graph.hasNode(link.target)) {
        graph.addEdge(link.source, link.target, {
          size: edgeSizeForRelType(link.relType, link.missing),
          color: edgeColorForLink(link),
        });
      }
    }
    loadGraph(graph, true);
    setGraphLoaded(true);
  }, [nodes, links, loadGraph]);

  // Events
  useEffect(() => {
    registerEvents({
      clickNode: (e) => onNodeSelect(e.node),
      clickStage: () => onNodeSelect(''),
    });
  }, [registerEvents, onNodeSelect]);

  return graphLoaded ? <LayoutAndCommunity sigma={sigma} /> : null;
}

function LayoutAndCommunity({ sigma }: { sigma: ReturnType<typeof useSigma> }) {
  const { start, stop, kill } = useWorkerLayoutForceAtlas2({
    settings: { slowDown: 10, gravity: 1, scalingRatio: 2, barnesHutOptimize: true },
  });

  useEffect(() => {
    start();
    const timer = setTimeout(() => {
      stop();
      // Apply Louvain after layout stabilizes
      const graph = sigma.getGraph();
      const result = louvain.detailed(graph);
      if (result.count >= 3) {
        graph.forEachNode((nodeId) => {
          const community = result.communities[nodeId];
          graph.setNodeAttribute(nodeId, 'borderColor', COMMUNITY_COLORS[community % COMMUNITY_COLORS.length]);
        });
      }
    }, 6000);

    return () => { clearTimeout(timer); stop(); kill(); };
  }, [start, stop, kill, sigma]);

  return null;
}

export default function SemanticGraphInner(props: SemanticGraphProps) {
  return (
    <SigmaContainer style={{ height: '72vh', width: '100%' }} settings={SIGMA_SETTINGS}>
      <GraphContent {...props} />
    </SigmaContainer>
  );
}
```

### Graphology graph initialization — do not use SigmaContainer graph prop for dynamic data

```typescript
// WRONG — triggers full sigma re-init on every nodes/links change:
// <SigmaContainer graph={buildGraphFromProps(nodes, links)}>

// CORRECT — load via hook, sigma instance persists:
// const loadGraph = useLoadGraph();
// useEffect(() => { loadGraph(newGraph, true); }, [nodes, links]);
```

### Louvain with ≥3 community guard

```typescript
// Source: graphology.github.io/standard-library/communities-louvain.html
import louvain from 'graphology-communities-louvain';

const result = louvain.detailed(graph);  // { communities: {nodeId: int}, count: int, modularity: float, ... }
if (result.count >= 3) {
  // apply ring colors
  graph.forEachNode((nodeId) => {
    const c = result.communities[nodeId];
    graph.setNodeAttribute(nodeId, 'borderColor', palette[c % palette.length]);
  });
}
```

### Edge encoding without dashed support

```typescript
// sigma v3 has no native dashed edges — encode relType via size + color/opacity
function edgeSizeForRelType(relType?: string, missing?: boolean): number {
  if (missing) return 2;
  if (relType === 'causal') return 3.5;
  if (relType === 'associative') return 1.5;
  return 1;   // contextual: thin
}

function edgeColorForLink(link: { relType?: string; missing?: boolean }): string {
  if (link.missing) return '#fb7185';
  if (link.relType === 'causal') return '#94a3b8';
  if (link.relType === 'associative') return '#64748b';
  return 'rgba(100,116,139,0.35)';  // contextual: transparent/muted
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom SVG + requestAnimationFrame force sim | sigma.js v3 WebGL + ForceAtlas2 worker | sigma v3 released March 2024 | 10-100x more nodes at interactive frame rates |
| Manual React lifecycle for sigma | `@react-sigma/core` hooks (useLoadGraph, useRegisterEvents, useSigma) | react-sigma v5 released Dec 2025 | Eliminates manual sigma.kill() / re-init boilerplate |
| Main-thread FA2 (`forceatlas2.assign(graph, {iterations: N})`) | Worker FA2 (`useWorkerLayoutForceAtlas2`) | Available since graphology-layout-forceatlas2 v0.5 | Page stays responsive during layout on 200+ node graphs |

**Deprecated/outdated in this codebase:**
- `simulateGraph()` custom force simulation (lines ~617–687 in app/tool/page.tsx): replaced by ForceAtlas2 worker entirely — can be deleted.
- `nodeColor(category)` function (lines ~609–615): replaced by `entityType`-based color map in semantic-graph component — can be deleted.
- Inline SVG graph block (lines ~1,269–1,410): replaced by `<SemanticGraph />` component.
- `pan`, `zoom`, `isPanning`, `draggedNodeId`, `panStartRef` state/refs in `app/tool/page.tsx`: pan/zoom become sigma native; drag is deferred to Phase 7. These state vars can be removed from `app/tool/page.tsx` when the SVG block is excised.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@react-sigma/core/lib/style.css` is the correct CSS import path for v5.0.6 | Pitfall 3 / Code Examples | Missing CSS causes invisible container; easy to fix by checking dist/ |
| A2 | `useWorkerLayoutForceAtlas2` accepts `{ settings: FA2Settings }` directly without separate layout params wrapper | Pattern 3 | Wrong parameter shape; fix by checking @react-sigma/layout-forceatlas2 types at install time |
| A3 | `louvain.detailed(graph).communities` returns a `{ [nodeId: string]: number }` partition (not community array) | Pattern 4 / Code Examples | Wrong — check graphology-communities-louvain types; API is well-documented so risk is LOW |
| A4 | `NodeBorderProgram` from `@sigma/node-border` v3.0.0 reads `borderColor` attribute from graphology node (not from sigma's node reducer) | Pattern 6 | Wrong attribute name means no ring; verify at install time by checking package source/storybook |

---

## Open Questions

1. **CSS import path for @react-sigma/core v5.0.6**
   - What we know: Official docs reference `'@react-sigma/core/lib/react-sigma.min.css'` in some places and `'@react-sigma/core/lib/style.css'` in others.
   - What's unclear: Which exact path is correct for v5.0.6.
   - Recommendation: After `npm install`, run `ls node_modules/@react-sigma/core/lib/` to confirm the actual filename before writing the import.

2. **ForceAtlas2 worker in Next.js 16 Turbopack — potential worker blob URL issue**
   - What we know: Next.js 16.2 fixed a Turbopack bug where Web Workers bootstrapped via `blob://` URLs had `location.origin = ''`, causing relative fetches to fail. graphology-layout-forceatlas2 uses an internal worker.
   - What's unclear: Whether `graphology-layout-forceatlas2/worker` (used internally by `useWorkerLayoutForceAtlas2`) is affected by this in Next.js 16.1.6 (pre-16.2 fix). The version in this project is 16.1.6.
   - Recommendation: Test FA2 worker in dev mode immediately after install. If worker fails silently (layout doesn't run), fall back to synchronous FA2 with `forceatlas2.assign(graph, { iterations: 200 })` for Phase 6 — layout quality is slightly worse but acceptable for a fallback. Log `[semantic-graph] FA2 worker running: ${layout.isRunning()}` to detect silent failure.
   - **Risk level:** MEDIUM — Next.js 16.1.6 predates the Turbopack blob URL fix in 16.2.

3. **Dashed edge for `contextual` relType and `missing` flag**
   - What we know: sigma v3 has no native dashed edge support. Color + opacity differentiation is the recommended Phase 6 approach.
   - What's unclear: Whether the product stakeholder considers color+opacity sufficient for "distinguishes ≥3 relationship types" per VIS-02, or whether dashed is required for acceptance.
   - Recommendation: Color+size encoding meets "visually distinct" per the requirement text. If dashed is required, scope a custom GLSL EdgeProgram to Phase 7 alongside the PNG export and drag work.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | ✓ | (project already running) | — |
| sigma | Renderer | NOT INSTALLED | — | Install required |
| @react-sigma/core | SigmaContainer/hooks | NOT INSTALLED | — | Install required |
| graphology | Graph model | NOT INSTALLED | — | Install required |
| graphology-layout-forceatlas2 | FA2 worker | NOT INSTALLED | — | Install required |
| graphology-communities-louvain | Louvain | NOT INSTALLED | — | Install required |
| graphology-metrics | Graph metrics | NOT INSTALLED | — | Install required |
| @sigma/node-border | Border ring renderer | NOT INSTALLED | — | Install required |
| @react-sigma/layout-forceatlas2 | Worker hook | NOT INSTALLED | — | Install required |
| @react-sigma/layout-core | Layout peer dep | NOT INSTALLED | — | Install required |

[VERIFIED: package.json — none of the sigma/graphology packages are in current dependencies]

**Missing dependencies with no fallback:**
All sigma/graphology packages above are required. The Wave 0 plan task MUST include the install command:
```bash
npm install sigma graphology @react-sigma/core @react-sigma/layout-core @react-sigma/layout-forceatlas2 graphology-layout-forceatlas2 graphology-communities-louvain graphology-metrics @sigma/node-border
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test:contract` (runs `lib/pipeline` tests only) |
| Full suite command | `npm test` (runs all `lib/**/*.test.ts`) |

**Scope constraint:** vitest is configured with `environment: 'node'` and `include: ["lib/**/*.test.ts"]`. Browser/DOM testing is not set up. All sigma/graphology visual rendering logic runs in the browser — no unit tests for the rendering component itself. Tests for Phase 6 cover only the **schema changes** in `lib/pipeline/models.ts` and `lib/pipeline/structurer.ts`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | WebGL rendering at interactive frame rates with 200+ nodes | manual smoke | — | manual only |
| VIS-02 | entityType field on GraphNode; relType field on GraphLink; schema validates | unit | `npm run test:contract -- --reporter=verbose lib/pipeline/__tests__/structurer.test.ts` | ✅ (`structurer.test.ts` exists — extend) |
| VIS-02 | synthesis prompt emits entityType + relType in JSON output | unit | same as above | ✅ extend existing |
| VIS-03 | Louvain ≥3 community guard; ring only when count ≥ 3 | manual smoke | — | manual only (no DOM env) |

**Rationale for manual-only on VIS-01 and VIS-03:** WebGL rendering and canvas interaction require a browser context. vitest's `environment: 'node'` cannot test sigma rendering. Phase 6 test coverage is limited to the model schema additions and synthesis prompt correctness — the renderer is verified by in-browser smoke test.

### Sampling Rate
- **Per task commit:** `npm run test:contract` (fast, covers lib/pipeline changes only)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual `/tool` smoke test before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `lib/pipeline/__tests__/structurer.test.ts` — add cases for `entityType` and `relType` fields on nodes/links (file exists, needs new test cases)
- [ ] Model type guards — add `entityType` and `relType` validation in `normalizeModelPayload` in `lib/pipeline/structurer.ts` (not a test file gap, but required for the test to pass)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 6 makes no auth changes |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | `SemanticGraph` is a rendering component only; access gate is in parent |
| V5 Input Validation | yes | `entityType` and `relType` values from LLM JSON output must be validated/narrowed before use in type maps |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns for sigma.js + LLM-synthesized graph data

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM emits unexpected `entityType` string, applied directly to color map → undefined/null color | Tampering | Narrow with `in` check or `satisfies` before color lookup; fallback to default color |
| LLM emits unexpected `relType` → incorrect edge visual | Tampering | Whitelist check: `['causal','associative','contextual'].includes(relType)` before use |
| XSS via node `label` rendered in sigma label program | Tampering | Sigma renders labels via WebGL canvas text — not inner HTML; XSS not applicable |
| sigma canvas 2D context access for PNG export | Elevation of privilege | PNG export is deferred to Phase 7; not a concern in Phase 6 |

**Input validation note:** The `normalizeModelPayload` function in `lib/pipeline/structurer.ts` already validates and normalizes node/link fields. The `entityType` and `relType` fields must be added to that normalization with explicit whitelisting — not trusted as-is from the LLM response.

---

## Project Constraints (from CLAUDE.md)

- Stay on current stack (Next.js 16, React 19, Supabase, Stripe); sigma/graphology is a narrowly scoped exception explicitly approved in STATE.md
- All application code in TypeScript with `strict: true`
- New component: `components/tool/semantic-graph.tsx` — named export `SemanticGraph`, `'use client'`
- Filename convention: kebab-case (`semantic-graph.tsx`, `semantic-graph-inner.tsx`)
- Component export: named export (`export function SemanticGraph(...)`)
- Error handling: `console.error` with bracketed prefix `[semantic-graph]` for sigma/worker failures
- No secrets in repo; no env changes needed for Phase 6 (all sigma/graphology is client-side)
- Extract helpers into `lib/` or colocated functions before exceeding ~150 lines per conceptual unit
- Test script: `npm test` runs vitest; no Jest
- ESLint flat config; no Prettier configured — follow existing style

---

## Sources

### Primary (HIGH confidence)
- [sim51.github.io/react-sigma/docs/start-setup/](https://sim51.github.io/react-sigma/docs/start-setup/) — SigmaContainer, Next.js setup, dynamic import
- [sim51.github.io/react-sigma/docs/example/load-graph/](https://sim51.github.io/react-sigma/docs/example/load-graph/) — useLoadGraph hook usage and graph prop vs hook pattern
- [sim51.github.io/react-sigma/docs/api/core/functions/useLoadGraph](https://sim51.github.io/react-sigma/docs/api/core/functions/useLoadGraph) — useLoadGraph signature (verified)
- [sim51.github.io/react-sigma/docs/api/core/functions/useSigma](https://sim51.github.io/react-sigma/docs/api/core/functions/useSigma) — useSigma signature (verified)
- [sim51.github.io/react-sigma/docs/api/core/functions/useRegisterEvents](https://sim51.github.io/react-sigma/docs/api/core/functions/useRegisterEvents) — useRegisterEvents signature (verified)
- [sim51.github.io/react-sigma/docs/api/core/interfaces/SigmaContainerProps](https://sim51.github.io/react-sigma/docs/api/core/interfaces/SigmaContainerProps) — SigmaContainerProps (verified)
- [sim51.github.io/react-sigma/docs/api/layout-forceatlas2/functions/useWorkerLayoutForceAtlas2](https://sim51.github.io/react-sigma/docs/api/layout-forceatlas2/functions/useWorkerLayoutForceAtlas2) — worker hook signature (verified)
- [graphology.github.io/standard-library/communities-louvain.html](https://graphology.github.io/standard-library/communities-louvain.html) — Louvain API (verified)
- [graphology.github.io/standard-library/layout-forceatlas2.html](https://graphology.github.io/standard-library/layout-forceatlas2.html) — FA2 worker API (verified)
- npm registry — sigma@3.0.3, @react-sigma/core@5.0.6, graphology@0.26.0, graphology-layout-forceatlas2@0.10.1, graphology-communities-louvain@2.0.2, @sigma/node-border@3.0.0 (verified 2026-05-08)

### Secondary (MEDIUM confidence)
- [sigmajs.org/docs/advanced/renderers/](https://www.sigmajs.org/docs/advanced/renderers/) — built-in edge programs, no dashed support confirmed
- [sigmajs.org/docs/advanced/data/](https://www.sigmajs.org/docs/advanced/data/) — type attribute + nodeProgramClasses/edgeProgramClasses dispatch
- [deepwiki.com/jacomyal/sigma.js/2-core-library](https://deepwiki.com/jacomyal/sigma.js/2-core-library) — program dispatch architecture
- [github.com/graphology/graphology/blob/master/src/layout-forceatlas2/worker.d.ts](https://github.com/graphology/graphology/blob/master/src/layout-forceatlas2/worker.d.ts) — FA2LayoutSupervisor type defs
- [sim51.github.io/react-sigma/docs/faq/](https://sim51.github.io/react-sigma/docs/faq/) — common pitfalls (container height, multi-edge, SSR)

### Tertiary (LOW confidence — flagged)
- [nextjs.org/blog/next-16-2-turbopack](https://nextjs.org/blog/next-16-2-turbopack) — Turbopack web worker blob URL fix in 16.2; concern flagged as Open Question for 16.1.6

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified via npm registry
- Architecture patterns: HIGH — all core hook signatures verified via official react-sigma docs
- Pitfalls: HIGH — cross-referenced against official FAQ, GitHub issues, and docs
- Dashed edge limitation: HIGH — confirmed absence in renderer docs; no @sigma/edge-dashed package exists
- FA2 worker in Next.js 16.1.6: MEDIUM — Turbopack blob URL fix is in 16.2, not 16.1.6; behavior unverified

**Research date:** 2026-05-08
**Valid until:** 2026-08-08 (stable ecosystem; sigma v3 API stabilized March 2024, react-sigma v5 December 2025)
