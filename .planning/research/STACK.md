# Stack Research

**Domain:** AI semantic graph / multi-stage web-research assistant (brownfield enhancement)
**Researched:** 2026-05-06
**Confidence:** HIGH (graph viz, OpenAI SDK, retrieval) / MEDIUM (observability, reranking service choice)

> **Scope:** This file covers additive libraries and patterns only. The core stack (Next.js 16, React 19, Supabase, Stripe, Tailwind v4, Resend) is already decided. Every recommendation here should slot into the existing App Router + NDJSON-streaming Route Handler architecture.

---

## Recommended Stack

### Graph Visualization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `sigma` | `^3.0.2` | WebGL graph renderer | Only JS graph renderer that uses WebGL natively — handles 10K+ nodes at 60 fps where SVG/Canvas solutions stall. The current codebase has no graph lib installed; this is the right first choice for the density of a semantic universe. |
| `graphology` | `^0.26` | Graph data model + algorithms | Sigma's required companion; provides typed graph store, traversal APIs, import/export, and the community detection and layout libraries. Treat it as the single source of truth for graph state, separate from React state. |
| `@react-sigma/core` | `^5.0.6` | React wrapper for Sigma | Component-based Sigma lifecycle management with hooks (`useSigma`, `useRegisterEvents`, `useCamera`). Avoids manual DOM/canvas cleanup. Latest v5 targets Sigma 3. |
| `graphology-layout-forceatlas2` | `^0.10` | Force-directed layout (web worker) | ForceAtlas2 is the standard layout for semantic graphs: preserves clusters, readable at 50–500 nodes. The worker variant runs off the main thread — critical for not blocking the NDJSON stream consumer. |
| `graphology-communities-louvain` | `^2.4` | Community / cluster detection | Louvain is O(n log n) and works in-browser. Run it post-synthesis to assign cluster IDs before rendering — lets you color-code entity clusters without an extra LLM call. |
| `graphology-metrics` | `^2.3` | Degree, centrality, density | Use betweenness/degree centrality to size nodes proportionally. Makes the graph immediately more legible: high-centrality nodes are visually dominant. |

### LLM Synthesis & Structured Outputs

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `openai` (npm SDK) | `^6.35.0` | Official OpenAI client | The codebase currently calls OpenAI over raw `fetch`. The official SDK adds `.parse()` + `zodResponseFormat()` for guaranteed-valid graph JSON, streaming structured output via `stream.on('content.delta')`, and built-in retries/timeouts. Migration is low-risk (same API surface). |
| `zod` | `^4.x` (stable) | Schema validation for graph payload | Zod v4 is stable (May 2026) and delivers 14.7× faster string parsing, 100× fewer TS compiler instantiations. Use it to define `NodeSchema`, `EdgeSchema`, and `GraphPayloadSchema` consumed by both the OpenAI structured-output contract and the client-side NDJSON parser — single schema, both ends validated. |

### Multi-Stage Research Pipeline

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `exa-js` | `^1.x` (latest) | Neural search + contents API | Already integrated via HTTP; the official SDK wraps `searchAndContents()`, `findSimilar()`, `answer()`, and `streamAnswer()` with TypeScript types. Use `highlights` mode (10× fewer tokens than full text) and `deep-reasoning` search type for slow-path quality runs. |
| Tavily REST (existing) | API v2 | Keyword/real-time web retrieval | Keep current HTTP integration. Adopt `search_depth: "advanced"` for query-focused evidence gathering and implement multi-subquery pattern: decompose the user's topic into 3–5 focused sub-queries, fan out in parallel with `Promise.allSettled`, deduplicate by URL before synthesis. This is Tavily's documented best practice and requires no new package. |
| `voyageai` | `^0.2` | Cross-source reranking | After merging Tavily + Exa results, run `voyage-rerank-2.5` (August 2025) to score relevance against the original query before passing sources to OpenAI. Reduces hallucination risk by feeding the LLM only high-signal evidence. voyage-rerank-2.5 outperforms Cohere Rerank v3.5 by 7.9% on MTREB. HTTP-based; add as a thin wrapper in `lib/rerank.ts`. |

### Streaming UX

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vercel AI SDK (`ai`) | `^4.x` / SDK 6 | Streaming data protocol helpers | The current NDJSON implementation is hand-rolled. Vercel AI SDK's `createDataStream` / `DataStreamWriter` pattern gives you typed step events, partial-object streaming for incremental graph updates, and SSE keep-alives that prevent premature connection closes on long research runs (>30 s). Adopt selectively — keep the existing `step`/`done`/`error` contract but replace the manual `TextEncoder` flush loop. |

### Observability

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `langfuse` | `^3.x` | LLM trace + eval | Framework-agnostic; works with raw `openai` SDK calls via `observeOpenAI()` wrapper. 1M spans/month free, self-hostable, no LangChain dependency. Captures prompt, completion, token counts, latency, and custom metadata (query, source count, cluster count) per run. Add `LANGFUSE_SECRET_KEY` + `LANGFUSE_PUBLIC_KEY` env vars — zero-code-change observability for the OpenAI calls. |

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `graphology-layout` | `^0.6` | Circular / random seed layouts | Use as initial placement before ForceAtlas2 converges — prevents cold-start "all nodes at origin" flash. |
| `@sigma/node-border` | `^3.x` | Node ring renderer | Add a color-coded ring to nodes whose edges cross cluster boundaries — visually communicates bridge entities without requiring a legend. |
| `@sigma/edge-curve` | `^3.x` | Curved edge renderer | Curved edges reduce overlap on dense graphs; use when edge count > 2× node count. |
| `graphology-shortest-path` | `^2.x` | Dijkstra / BFS path finding | Power a "show path between nodes" interaction without another LLM call. |
| `graphology-utils` | `^2.x` | Graph merge / copy helpers | Merge partial graphs streamed across NDJSON steps cleanly. |

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Langfuse Cloud (dev project) | Trace inspection during development | Create a separate dev Langfuse project; use `LANGFUSE_ENABLED=false` guard to skip in test/CI. |
| `openai` CLI (`openai` npm) | Test structured output schemas | `openai api chat.completions.create --model gpt-4o --response-format ...` validates Zod → JSON Schema conversion before wiring route. |
| Sigma.js Playground (sigmajs.org) | Prototype graph layout settings | Tune ForceAtlas2 gravity/scaling/edge-weight params against representative graph JSON before committing values. |

---

## Installation

```bash
# Graph visualization
npm install sigma graphology @react-sigma/core graphology-layout-forceatlas2 graphology-communities-louvain graphology-metrics graphology-layout @sigma/node-border @sigma/edge-curve graphology-shortest-path graphology-utils

# LLM / structured outputs
npm install openai zod

# Retrieval
npm install exa-js voyageai

# Streaming UX
npm install ai

# Observability
npm install langfuse
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `sigma` + `graphology` | `reagraph` (Three.js WebGL) | Use reagraph if you need native 3D/VR graph views or prefer a single React-native component rather than a lower-level renderer. sigma is preferred here because its graphology data model makes algorithmic operations (Louvain, centrality, path-finding) first-class. |
| `sigma` + `graphology` | `cytoscape.js` | Use Cytoscape if graph algorithm breadth (60+ algorithms built-in) matters more than rendering performance. Cytoscape is SVG/Canvas, maxes out around 5K nodes visually. |
| `sigma` + `graphology` | `react-force-graph` | Use for quick prototypes or when 3D/VR is required. 3K stars vs sigma's 12K+; slower active development. |
| `langfuse` | `LangSmith` | Use LangSmith only if adopting LangGraph/LangChain deeply. LangSmith costs $39/seat/month and tightly couples to the LangChain ecosystem. |
| `langfuse` | `Helicone` | Helicone was acquired by Mintlify in March 2026 and is now in maintenance mode — do not start new integrations on it. |
| `voyageai` reranker | Cohere Rerank v3 | Use Cohere if you already have a Cohere contract or need their managed runtime SLAs. Voyage rerank-2.5 is measurably more accurate but Cohere has a more mature API stability record. |
| `openai` SDK | raw `fetch` (current) | Keep raw fetch only if you explicitly need to avoid the SDK's bundled types in an edge runtime context. The SDK bundle is ~200 KB; for edge functions consider tree-shaking or the `openai/core` import path. |
| Vercel AI SDK `ai` | hand-rolled NDJSON (current) | Keep hand-rolled if the existing stream contract is stable and no edge-case flush issues are present. The migration value is mainly the typed `DataStreamWriter` and keep-alive ping. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `vis-network` | SVG+Canvas hybrid; lags noticeably above 2K nodes; React integration requires manual imperative DOM wrapper | `sigma` + `@react-sigma/core` |
| `react-flow` / `xyflow` | Designed for flowcharts and DAGs, not force-directed semantic graphs; layout customization is a fight against built-in lane assumptions | `sigma` for semantic graphs; `react-flow` is fine for pipeline/process diagrams elsewhere |
| `LangChain.js` (full) | 1.5 MB+ bundle, opaque abstraction over OpenAI/Tavily calls the codebase already makes directly; introduces upgrade churn risk disproportionate to benefit for this use case | Use the raw SDKs (`openai`, `exa-js`) + a thin pipeline orchestration module in `lib/research/` |
| `zod` v3 | Still shipped as `zod` on npm but `openai` SDK v6 examples now import from `zod/v3` shim inside v4 packages. Pin `zod@^4` to avoid dual-version conflicts. | `zod@^4` |
| `Helicone` | Acquired by Mintlify March 2026; maintenance mode | `langfuse` |
| Streaming via `ReadableStream` + manual keepalive | Prone to silent connection drops on Vercel's 30 s edge timeout; loses partial progress on reconnect | Vercel AI SDK `createDataStream` which sends SSE pings and supports reconnect-aware consumers |
| GraphQL for graph data | Misleading name — GraphQL is a query protocol, not a graph data model. Using it to ship graph nodes/edges adds schema overhead with no benefit over the existing NDJSON `done` payload | NDJSON `done` event with typed Zod payload |

---

## Stack Patterns by Variant

**If graph density is low (< 50 nodes, < 100 edges):**
- ForceAtlas2 worker is optional; synchronous `graphology-layout-force` is sufficient
- Skip Louvain clustering (too few nodes to form meaningful clusters)
- Sigma is still the right renderer — consistent toolchain

**If graph density is high (> 500 nodes):**
- Enable Barnes-Hut optimization flag in ForceAtlas2 worker (`barnesHutOptimize: true`)
- Add a degree threshold filter in `lib/graph/prune.ts` to hide low-degree peripheral nodes by default (toggle via UI)
- Defer `@sigma/edge-curve` — curve computation adds CPU overhead at this scale

**If research pipeline latency is critical (< 10 s target):**
- Use Exa `auto` search (≈1 s) instead of `deep-reasoning` (5–60 s)
- Use Tavily `search_depth: "basic"` not `"advanced"`
- Skip reranking (voyageai call adds ≈300 ms); use top-N by raw relevance score
- Accept a shallower graph (fewer sources, higher hallucination risk) — surface this trade-off in the UI

**If research pipeline quality is critical (default target):**
- Tavily `search_depth: "advanced"` + 3–5 parallel subqueries
- Exa `searchAndContents` with `highlights` (10× token reduction, same latency)
- voyageai `rerank-2.5` cross-source reranking before OpenAI synthesis
- OpenAI `gpt-4o` with `zodResponseFormat` structured outputs (not JSON mode — structured outputs guarantee schema adherence)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `sigma@^3.0.2` | `graphology@^0.26` | Sigma 3 requires graphology 0.25+; do not mix with older graphology-* sub-packages that pin to 0.24. |
| `@react-sigma/core@^5.0.6` | `sigma@^3`, React 19 | v5 specifically targets Sigma 3. v4 targets Sigma 2 — do not mix. |
| `zod@^4` | `openai@^6.35` | openai SDK v6 internally uses zod v3 shim (`zod/v3`) for its own helpers. Your app code should import from `zod` (v4 entrypoint); the SDK resolves its own internal zod independently. |
| `ai` (Vercel AI SDK 6) | Next.js `^16`, React 19 | SDK 6 requires Next.js 15+; compatible with the current 16.1.6. |
| `langfuse@^3` | `openai@^6` | `observeOpenAI()` wrapper supports openai SDK v4+; v6 is verified supported. |

---

## Sources

- [pkgpulse.com: Cytoscape vs vis-network vs Sigma 2026](https://www.pkgpulse.com/blog/cytoscape-vs-vis-network-vs-sigma-graph-visualization-javascript-2026) — MEDIUM confidence (aggregator)
- [sigmajs.org docs](https://sigmajs.org/docs) + [npm sigma@3.0.2](https://www.npmjs.com/package/sigma) — HIGH confidence (official)
- [sim51/react-sigma GitHub](https://github.com/sim51/react-sigma) — HIGH confidence (official)
- [graphology.github.io standard-library](https://graphology.github.io/standard-library/layout-forceatlas2.html) — HIGH confidence (official)
- [openai/openai-node GitHub v6.35.0](https://github.com/openai/openai-node/releases/tag/v6.35.0) — HIGH confidence (official)
- [zod.dev v4 release notes](https://v4.zod.dev/v4) — HIGH confidence (official)
- [exa.ai docs TypeScript SDK](https://docs.exa.ai/docs/sdks/typescript-sdk-specification) — HIGH confidence (official)
- [voyageai.com rerank-2.5 announcement](https://blog.voyageai.com/2025/08/11/rerank-2-5/) — HIGH confidence (official)
- [pkgpulse.com: Langfuse vs LangSmith vs Helicone 2026](https://www.pkgpulse.com/guides/langfuse-vs-langsmith-vs-helicone-llm-observability-2026) — MEDIUM confidence (aggregator, corroborated by multiple sources)
- [vercel.com: AI SDK 6 announcement](https://www.vercel.com/blog/ai-sdk-6) — HIGH confidence (official)
- [tavily.com best practices docs](https://docs.tavily.com/documentation/best-practices/best-practices-search) — HIGH confidence (official)
- Helicone maintenance-mode status: pkgpulse.com + stackscout.dev + tokenmix.ai — MEDIUM confidence (three independent aggregators agree; unverified via Helicone official)

---
*Stack research for: 6-degrees — AI semantic graph / web-research assistant (brownfield enhancement)*
*Researched: 2026-05-06*
