# Architecture Research

**Domain:** Multi-stage LLM + web-retrieval pipeline with graph-heavy interactive UI
**Researched:** 2026-05-06
**Confidence:** HIGH (codebase mapped; patterns verified against current literature)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     CLIENT — app/tool/page.tsx                    │
│  ┌───────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  Stream Parser │  │  Graph Renderer  │  │  Evidence Panels  │  │
│  │  (NDJSON fsm)  │  │  (React Flow /   │  │  (discourse,      │  │
│  │               │  │   canvas hybrid) │  │   provenance)     │  │
│  └──────┬────────┘  └────────┬─────────┘  └────────┬──────────┘  │
│         │                   │                      │             │
│  ┌──────▼───────────────────▼──────────────────────▼──────────┐  │
│  │              Graph State Store (useState / zustand)         │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ POST  (credentials: include)
                                   │ ← NDJSON stream
┌──────────────────────────────────▼───────────────────────────────┐
│            ROUTE HANDLER — app/api/semantic-universe/route.ts     │
│                     (Stream Coordinator)                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Auth gate → Access gate → Pipeline Orchestrator            │  │
│  └──────┬──────────────────────────────────────────────────────┘  │
│         │  emits step events after each stage completes           │
│  ┌──────▼──────────────────────────────────────────────────────┐  │
│  │                lib/pipeline/ (stage modules)                 │  │
│  │  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │  │
│  │  │  Planner   │ │Retriever │ │  Scorer  │ │ Structurer  │  │  │
│  │  │(query plan)│ │(Tav+Exa) │ │(rank/ded)│ │(OAI→graph)  │  │  │
│  │  └────────────┘ └──────────┘ └──────────┘ └─────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐    │  │
│  │  │  Enricher (image resolution, OG/Twitter scrape)      │    │  │
│  │  └─────────────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                    │                       │
          ┌─────────▼──────┐     ┌──────────▼──────┐
          │  Tavily / Exa   │     │   OpenAI Chat    │
          │  (HTTP, ext.)   │     │   Completions    │
          └─────────────────┘     └──────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Current Location |
|-----------|---------------|-----------------|
| Stream Coordinator | Auth/access gates, pipeline orchestration, NDJSON emission | `app/api/semantic-universe/route.ts` (monolith) |
| Query Planner | Sub-question decomposition, query expansion, brand + competitor query set | Inline in route handler |
| Retriever | Parallel Tavily + Exa fetch, URL-keyed dedup | Inline in route handler |
| Scorer | Relevance scoring, snippet quality ranking, source filtering | **Not yet extracted** |
| Structurer | OpenAI synthesis → typed `GraphNode[]` / `GraphLink[]` / evidence | `synthesizeWithOpenAI` inline |
| Enricher | Image resolution (OG/Twitter), moodboard assembly | `enrichVisualCorrelationsWithImages` inline |
| Graph Renderer | Force-layout rendering, node/edge interaction, clustering | Client components under `components/tool/` |
| Graph State Store | Holds parsed NDJSON payload, drives all panels | `useState` in `app/tool/page.tsx` |
| Evidence Panels | Discourse, visual correlations, model strength display | Client components under `components/tool/` |

---

## Layer Boundaries

### The Core Question: Where Does Each Stage Begin and End?

The existing route handler is a **1 600+ line monolith** — all stages execute sequentially in one async function, sharing closure scope. This is the primary architectural constraint for this milestone.

**Recommended boundary model — four server-side layers, one client-side layer:**

```
LAYER 1 — Query Planning
  Input:  raw brand string from POST body
  Output: string[] of targeted search queries (5–12 queries)
  Rule:   Pure function. No I/O. Deterministic given the same brand.

LAYER 2 — Retrieval
  Input:  string[] queries
  Output: SourceItem[] (raw, with duplicates)
  Rule:   I/O-only. No scoring, no synthesis. Parallel fan-out.

LAYER 3 — Scoring & Ranking
  Input:  SourceItem[] (raw)
  Output: SourceItem[] (deduped, scored, top-N)
  Rule:   CPU-only. No LLM calls. Heuristic or lightweight model.

LAYER 4 — Structuring (LLM)
  Input:  SourceItem[] (scored, top-N)
  Output: SemanticUniversePayload (graph + evidence + discourse)
  Rule:   One LLM call. Receives only ranked sources; never raw dump.

LAYER 5 — Enrichment
  Input:  SemanticUniversePayload + SourceItem[]
  Output: SemanticUniversePayload (with imageUrls populated)
  Rule:   Parallel I/O. Never mutates graph structure or evidence IDs.

CLIENT — Visualization
  Input:  NDJSON stream of typed step/done/error events
  Output: Rendered graph + panels
  Rule:   Render-only. Never re-derives graph structure client-side.
```

**The hard rule:** Layers only communicate forward. Layer 3 (Scorer) cannot call Layer 2 (Retriever) for more sources. Layer 4 (Structurer) cannot trigger additional retrieval. If more sources are needed, that decision lives in Layer 1 (Planner).

---

## Recommended Project Structure

```
lib/
├── pipeline/
│   ├── index.ts            # re-exports: runPipeline(), PipelineEvent
│   ├── planner.ts          # LAYER 1: query plan from brand string
│   ├── retriever.ts        # LAYER 2: parallel Tavily + Exa fetch
│   ├── scorer.ts           # LAYER 3: dedup, relevance heuristic, top-N
│   ├── structurer.ts       # LAYER 4: OpenAI synthesis → payload
│   ├── enricher.ts         # LAYER 5: image resolution
│   └── types.ts            # shared: SourceItem, GraphNode, GraphLink, etc.
├── supabase/               # (existing — do not touch)
├── stripe.ts               # (existing — do not touch)
├── tool-access.ts          # (existing — do not touch)
└── site-url.ts             # (existing — do not touch)

app/api/semantic-universe/
└── route.ts                # Slim coordinator: auth → pipeline → stream emit

components/tool/
├── graph/
│   ├── GraphCanvas.tsx     # force layout + viewport culling
│   ├── GraphNode.tsx       # memoized node renderer
│   ├── GraphEdge.tsx       # memoized edge renderer
│   └── useGraphLayout.ts   # layout state (d3-force or dagre)
├── panels/
│   ├── EvidencePanel.tsx
│   ├── DiscoursePanel.tsx
│   └── VisualCorrelations.tsx
└── stream/
    ├── useSemanticStream.ts   # NDJSON parse FSM → calls state store
    └── streamTypes.ts         # typed event discriminated union
```

### Structure Rationale

- **`lib/pipeline/`:** Extracting stages here makes each independently testable without spinning up Next.js, and keeps the route handler to ~50 lines of orchestration. Matches the "thin Route Handler" convention already used elsewhere in the codebase (`lib/tool-access.ts`).
- **`components/tool/graph/`:** Isolating graph rendering from stream parsing lets layout engine choices change independently of the data model.
- **`components/tool/stream/`:** A dedicated stream FSM (`useSemanticStream`) decouples parsing from UI rendering — currently both live in `app/tool/page.tsx`, which causes tight coupling and makes it hard to add richer event types.

---

## Architectural Patterns

### Pattern 1: Typed NDJSON Event Protocol

**What:** Define a discriminated union for all NDJSON event types emitted by the route handler. Each stage emits its own event type, carrying stage-specific data (not just a message string).

**When to use:** Now. Extending the stream with richer provenance and scoring data requires typed events; the current `{ type: "step", message: string }` shape cannot carry structured data without breaking client parsing.

**Trade-offs:** Requires coordinated update to both server emit and client parse. Low risk because the client already skips malformed lines.

**Example:**
```typescript
// lib/pipeline/types.ts
export type PipelineEvent =
  | { type: "stage_start";  stage: PipelineStage; ts: number }
  | { type: "stage_done";   stage: PipelineStage; ts: number; summary?: string }
  | { type: "sources_ready"; count: number; topScores: number[] }
  | { type: "graph_ready";   nodeCount: number; edgeCount: number }
  | { type: "done";          payload: SemanticUniversePayload }
  | { type: "error";         message: string; stage?: PipelineStage };

export type PipelineStage =
  | "planning" | "retrieval" | "scoring" | "structuring" | "enrichment";
```

```typescript
// In route.ts — emit after each stage
encoder.encode(JSON.stringify({ type: "stage_done", stage: "retrieval",
  ts: Date.now(), summary: `${sources.length} sources` }) + "\n")
```

### Pattern 2: Stage Module with Single Pure Entry Point

**What:** Each `lib/pipeline/*.ts` exports one async function with a typed signature. No side effects; no direct env-var reads (pass config in). The route handler supplies config from env and calls stages in sequence.

**When to use:** When extracting stages from the monolith. This is the safest incremental refactor — extract one stage at a time, verify the route still works, move on.

**Trade-offs:** Slightly more parameter passing, but dramatically easier to test and swap implementations (e.g., swap Tavily for a different provider without touching other stages).

**Example:**
```typescript
// lib/pipeline/retriever.ts
export async function retrieve(
  queries: string[],
  config: { tavilyKey: string; exaKey: string; maxPerSource?: number }
): Promise<SourceItem[]> {
  const [tavilyResults, exaResults] = await Promise.all([
    fetchTavily(queries, config.tavilyKey, config.maxPerSource ?? 5),
    fetchExa(queries, config.exaKey, config.maxPerSource ?? 5),
  ]);
  return [...tavilyResults, ...exaResults];
}
```

### Pattern 3: Client-Side Stream FSM

**What:** Replace the imperative NDJSON parse loop in `app/tool/page.tsx` with a finite state machine hook (`useSemanticStream`). The hook maps typed `PipelineEvent`s to state transitions, keeping parse logic and render logic separate.

**When to use:** When adding richer event types (stage progress, partial graph updates). The current approach of doing both parsing and state mutation in one long `useEffect` will become unmanageable.

**Trade-offs:** Adds a new hook file, but `app/tool/page.tsx` becomes a composition layer rather than a God component.

**Example:**
```typescript
// components/tool/stream/useSemanticStream.ts
export function useSemanticStream(onDone: (p: SemanticUniversePayload) => void) {
  const [state, dispatch] = useReducer(streamReducer, initialStreamState);

  async function startStream(brand: string) {
    const res = await fetch("/api/semantic-universe", { method: "POST",
      body: JSON.stringify({ brand }), credentials: "include" });
    for await (const event of parseNDJSON<PipelineEvent>(res.body!)) {
      dispatch({ type: "EVENT", event });
      if (event.type === "done") onDone(event.payload);
    }
  }
  return { state, startStream };
}
```

### Pattern 4: Memoized Graph Components with Viewport Culling

**What:** Each graph node/edge is a `React.memo` component. A `useGraphLayout` hook owns force-simulation state; nodes outside the current viewport bounding box are skipped during render. Layout computation runs in a `useEffect` with `startTransition` wrapping the state update.

**When to use:** When graph node counts exceed ~80 nodes or when users report sluggish panning. The current implementation (unknown rendering strategy, likely SVG/DOM) will degrade visibly at larger graphs.

**Trade-offs:** Adds complexity to the rendering layer but is well-supported by React Flow's documented patterns. Canvas fallback (PixiJS / OffscreenCanvas) is a future escape hatch if DOM rendering caps out.

**Example:**
```typescript
// components/tool/graph/GraphNode.tsx
export const GraphNode = React.memo(({ node }: { node: GraphNode }) => (
  <g transform={`translate(${node.x},${node.y})`}>
    <circle r={node.size} className={categoryStyles[node.category]} />
    <text>{node.label}</text>
  </g>
), (prev, next) => prev.node.x === next.node.x && prev.node.y === next.node.y
   && prev.node.label === next.node.label);
```

---

## Data Flow

### Enhanced Pipeline Request Flow

```
User submits brand → POST /api/semantic-universe
        ↓
  [Auth gate: getUser()]        ← 401 if no session
        ↓
  [Access gate: canUseTool()]   ← 402 if paywalled
        ↓
  [LAYER 1: Planner]            → string[] (queries)
        ↓ emit: stage_done "planning"
  [LAYER 2: Retriever]          → SourceItem[] (raw, ~50–100 items)
        ↓ emit: stage_done "retrieval" + sources_ready count
  [LAYER 3: Scorer]             → SourceItem[] (top 20, scored)
        ↓ emit: stage_done "scoring"
  [LAYER 4: Structurer (LLM)]   → SemanticUniversePayload
        ↓ emit: stage_done "structuring" + graph_ready counts
  [LAYER 5: Enricher]           → SemanticUniversePayload (+ images)
        ↓ emit: done (full payload)
```

### Client-Side State Flow

```
NDJSON stream
    ↓
useSemanticStream (FSM)
    ├─ stage_start / stage_done  → dispatch: update progress UI
    ├─ sources_ready             → dispatch: show source count badge
    ├─ graph_ready               → dispatch: show skeleton graph
    └─ done                      → dispatch: full payload → graph store
                                           ↓
                                  GraphCanvas (layout + render)
                                  EvidencePanel
                                  DiscoursePanel
                                  VisualCorrelations
```

### Key Data Flows

1. **Scored sources → LLM prompt:** The Scorer outputs a ranked `SourceItem[]` with a `relevanceScore` field attached. The Structurer constructs the OpenAI prompt from the top-N items only. Score metadata is preserved in `Evidence.coOccurrence` (or a new `Evidence.score` field) and surfaced in the Evidence panel as a trust signal.

2. **Provenance chain:** Each `Evidence` item carries `provider` (tavily/exa) + `query` (which planned query retrieved it) + source URL. The client Evidence panel can display this chain: `query → source → graph edge` — tracing why a link exists.

3. **Incremental graph updates (future):** The `graph_ready` event can carry a partial payload (skeleton nodes only), letting the client render a low-fidelity graph immediately while enrichment completes. The `done` event then delivers the full payload. This requires the client graph store to support a `merge` operation rather than a replace.

---

## Recommended Build Order

The milestone goal is enhancement without rewriting auth/billing. The following order minimizes risk by ensuring each step leaves the pipeline working:

| Wave | Work | Why This Order |
|------|------|---------------|
| **1** | Extract `lib/pipeline/types.ts` — move all types out of `route.ts` | Zero behaviour change; enables shared types for later steps |
| **2** | Extract `lib/pipeline/retriever.ts` and `lib/pipeline/enricher.ts` | Both are pure I/O; easiest to extract; route behaviour unchanged |
| **3** | Add typed NDJSON protocol (`PipelineEvent` union) + update client stream parser | Contracts are explicit; client FSM replaces the parse loop; backwards-compatible (skip unknown types) |
| **4** | Add `lib/pipeline/scorer.ts` (relevance heuristic) between retriever and structurer | First user-visible improvement: better sources → better graph; measurable |
| **5** | Add `lib/pipeline/planner.ts` (sub-question decomposition) | Builds on scorer; richer queries → richer graph; risks LLM latency increase — test with timeouts |
| **6** | Graph renderer improvements (memoization, layout algorithm, clustering) | Pure front-end; no pipeline risk; depends on typed event protocol from Wave 3 |

**Do not skip Wave 1–3.** Attempting to add scoring or planning to the monolith without extracting types first will produce an unmaintainable route file and make future phases harder.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (< 1k daily runs) | Monolith Route Handler is fine; refactor for maintainability, not scale |
| 1k–10k daily runs | Pipeline stages become bottleneck; consider queuing long runs with a job store (Supabase `analysis_runs` table) and a polling/webhook pattern instead of holding the HTTP connection open |
| 10k+ daily runs | Extract pipeline to a separate worker process (Edge Function with longer timeout, or Vercel background job); keep the existing Route Handler as a thin proxy that returns a run ID |

### Scaling Priorities

1. **First bottleneck:** OpenAI synthesis (Layer 4) — long LLM calls hold HTTP connections open. Mitigation: reduce context size via better scoring (Layer 3), add timeout + fallback graph.
2. **Second bottleneck:** Image enrichment (Layer 5) — parallel fetch to up to 10 external URLs. Mitigation: cap concurrency, add per-URL timeout (already at 3500ms), make enrichment optional/async.

---

## Anti-Patterns

### Anti-Pattern 1: Adding Stages Inline to the Monolith

**What people do:** Add a scoring pass as another block of code inside the existing 1 600-line route handler.
**Why it's wrong:** The function is already at the limit of cognitive complexity; inline additions make the stage boundaries invisible, cause accidental variable shadowing, and block independent testing.
**Do this instead:** Extract to `lib/pipeline/scorer.ts` first (even if trivial), then wire it in. The route handler should read like a pipeline description, not an implementation.

### Anti-Pattern 2: Sending Raw Source Dumps to the LLM

**What people do:** Pass all retrieved `SourceItem[]` directly into the OpenAI prompt without scoring or truncation.
**Why it's wrong:** Overstuffed context degrades output quality, increases token cost non-linearly, and makes it harder to trace which source drove which graph node. The current implementation already truncates; a scorer makes this deliberate rather than accidental.
**Do this instead:** Score and rank first; send top-N (recommended: 12–20) with relevance scores included in the prompt as `[score: 0.87] Title: ...`.

### Anti-Pattern 3: Re-deriving Graph Structure Client-Side

**What people do:** Move graph layout or node categorization logic into React components, using client-side heuristics to supplement thin server payloads.
**Why it's wrong:** Graph semantics (category, weight, gapHint) are model outputs — re-deriving them client-side silently diverges from the model's intent and makes the UI non-deterministic across sessions.
**Do this instead:** All semantic graph properties are server-owned. The client is layout-only: it decides x/y positions and visual clustering, but never changes node categories or edge weights.

### Anti-Pattern 4: Blocking the Stream on Image Enrichment

**What people do:** Run image enrichment synchronously before emitting the `done` event, making users wait for slow third-party image fetches.
**Why it's wrong:** Image enrichment (Layer 5) can add 2–5 seconds to the total response time for no structural benefit — the graph is complete without images.
**Do this instead:** Emit `done` with the graph payload first (without image URLs), then emit a separate `enrichment_done` event with the resolved image map. The client merges images into the existing visual correlations state without re-rendering the whole graph.

### Anti-Pattern 5: God Component for Graph + Stream + State

**What people do:** Keep all graph rendering, NDJSON parsing, and paywall logic in `app/tool/page.tsx`.
**Why it's wrong:** A 500+ line client component with multiple `useEffect` dependencies is difficult to reason about when adding new event types or graph interactions.
**Do this instead:** `app/tool/page.tsx` becomes a composition root — it mounts `<SemanticStreamProvider>`, `<GraphCanvas>`, `<EvidencePanel>`, etc. Each subtree owns its slice of state.

---

## Integration Points

### External Services

| Service | Integration Pattern | Key Constraint |
|---------|---------------------|----------------|
| Tavily | Direct HTTP from Route Handler; API key server-side only | Rate limit: respect per-query; add jitter on parallel calls |
| Exa | Direct HTTP from Route Handler; API key server-side only | Response shape differs from Tavily — normalize in Retriever layer |
| OpenAI Chat | Single call in Structurer layer; prompt assembled from scored sources | Token budget: limit sources to avoid context overflow; use `max_tokens` guard |
| Supabase | Auth/profile via existing `lib/supabase/*` — **do not modify** | Existing `profiles` schema; any new pipeline metadata needs a migration |
| Stripe | Existing checkout/webhook — **do not touch** | Access rules already in `lib/tool-access.ts` |

### Internal Boundaries

| Boundary | Communication | Contract |
|----------|---------------|----------|
| Route Handler ↔ Pipeline modules | Direct function call (same process) | Typed function signatures in `lib/pipeline/types.ts`; no shared mutable state |
| Pipeline ↔ Client | NDJSON stream over HTTP | `PipelineEvent` discriminated union; client skips unknown `type` values |
| Graph State ↔ Panels | React context or prop-drilling | Panels read from graph store; never write back to it |
| Stream FSM ↔ Graph Canvas | Shared state store (useState or zustand) | Store updated by FSM; Canvas subscribes; no direct coupling |

---

## Sources

- Codebase analysis: `.planning/codebase/ARCHITECTURE.md` (2026-05-06, HIGH confidence)
- Agentic RAG architecture patterns: https://tianpan.co/blog/2026-02-11-agentic-rag-architecture-production-guide (MEDIUM confidence)
- React Flow performance docs: https://reactflow.dev/learn/advanced-use/performance (HIGH confidence — official docs)
- React Flow force layout: https://reactflow.dev/examples/layout/force-layout (HIGH confidence)
- Multi-stage LLM pipeline patterns: WebSearch synthesis (MEDIUM confidence — multiple sources agree)
- NDJSON streaming reliability patterns: https://vincentvandeth.nl/blog/ndjson-receipt-ledger-ai-audit-trail (MEDIUM confidence)

---

*Architecture research for: 6-degrees — multi-stage LLM + web-retrieval pipeline with graph UI*
*Researched: 2026-05-06*
