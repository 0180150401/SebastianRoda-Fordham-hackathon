# Phase 5 Research: Graph Synthesis Quality & Provenance

**Date:** 2026-05-08
**Status:** Complete
**Scope:** Passage extraction approach, source/passage provenance schema, provenance validation, and degraded/fallback result visibility for Phase 5.

## Executive Summary

Phase 5 should preserve provider-native passage material before synthesis, make passage evidence the graph grounding unit, and validate generated graph structure after synthesis before it reaches the UI. The existing pipeline already requests useful Exa and Tavily content, but currently flattens provider output into `SourceItem.snippet`, which loses provenance granularity. The safest implementation path is additive: keep current `Evidence` compatibility fields, add explicit source and passage identity, require model output to cite passage IDs, then run a deterministic validator that repairs once, rejects unsupported edges/nodes, and marks the result as `success`, `degraded`, or `fallback`.

The best product behavior is a smaller honest graph. If provenance validation removes many relationships but the minimum usable graph floor still holds, return a degraded partial graph with a concise visible reason. If the graph falls below 4 nodes, 3 grounded edges, or 3 passage evidence items, fall back.

## Primary Source Findings

### Provider-Native Passage Extraction

Exa Search supports nested `contents.text`, `contents.highlights`, and `contents.summary` parameters. Highlights are explicitly positioned as key excerpts relevant to the query, and Exa recommends highlights for agent workflows because they reduce token usage while preserving relevant evidence. This matches Phase 5's decision to avoid a new arbitrary fetch pass and prefer provider-native passages.

Tavily Search supports `chunks_per_source` when `search_depth` is `advanced`; chunks are short snippets of up to 500 characters and are concatenated in the `content` field. Tavily also supports `include_raw_content`, but that may increase latency and is not necessary for Phase 5's bounded scope. The existing retriever already uses `advanced`, so setting or preserving `chunks_per_source` and splitting `content` on Tavily's chunk separator is the lowest-risk path.

Current implication: update `lib/pipeline/retriever.ts` to preserve structured passage candidates from Exa highlights/text and Tavily content/chunks instead of collapsing them into one snippet too early. `SourceItem.snippet` can remain as the UI/back-compat fallback.

### Structured Output and Schema Discipline

OpenAI's current structured output guidance distinguishes JSON mode from schema-adherent structured outputs. JSON mode only ensures valid JSON; it does not guarantee the output matches the requested schema. Phase 5's stricter `sourceIds`/`evidenceIds` contract would benefit from structured outputs where supported, or at minimum a Zod validation and normalization pass with explicit fallback behavior.

Current implication: keep the existing normalizer, but plan a strict schema for synthesis output. If the SDK/model path supports `json_schema`/Zod response formatting, prefer it over `response_format: { type: "json_object" }`. If not, continue JSON mode only with strong runtime validation and tests that intentionally feed malformed provenance.

### Citation and Faithfulness Research

ALCE frames citation generation as an end-to-end retrieve-then-generate problem and evaluates fluency, correctness, and citation quality. Its results show that even strong models often produce claims without complete citation support, so Phase 5 should not trust model-provided citations without a post-generation check.

RAGTruth shows that RAG systems can still produce unsupported or contradictory claims even with retrieved content available. This supports Phase 5's hard post-synthesis gate for graph edges and non-brand nodes.

ARES evaluates RAG along context relevance, answer faithfulness, and answer relevance. For this product, the direct analogue is: retrieved passage relevance, graph relationship faithfulness to cited passages, and synthesis usefulness. Phase 5 does not need a full automated judge, but tests should include fixtures that separate "valid JSON with IDs" from "IDs that actually support the relationship."

## Recommended Phase 5 Architecture

### 1. Preserve Source Documents and Passage Evidence

Add a small source/passage split while keeping current UI compatibility:

```ts
type SourceDocument = {
  id: string;
  title: string;
  url: string;
  provider: SourceProvider;
  query: string;
  rank: number;
  score?: number;
  published?: string;
};

type Evidence = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  provider: SourceProvider;
  query: string;
  excerpt: string;
  aiResponse: string; // keep as compatibility alias for current UI
  retrievalScore?: number;
  sourceRank?: number;
  coOccurrence: number;
  timestamp: number;
};
```

`sourceId` should be deterministic per canonical URL plus provider/query context where needed. `evidenceId` should be deterministic enough for tests, for example `ev-${sourceIndex}-${passageIndex}`.

### 2. Build Passage Evidence Before Synthesis

Add an extraction helper such as `buildPassageEvidence(sources)`:

- Use Exa `contents.highlights` first when present.
- Use Exa text as a fallback by trimming to one compact excerpt.
- Use Tavily `content` chunks, splitting on `[...]` when `advanced` chunk output is present.
- Fall back to `SourceItem.snippet`.
- Discard empty, duplicate, or extremely short passages.
- Cap passage count for prompt budget, for example top 18 to 24 passages.

The synthesis prompt should show stable passage IDs and source IDs, then require all generated links and non-brand nodes to cite passage IDs.

### 3. Add Explicit Provenance to Graph Items

Extend graph types additively:

- `GraphNode.sourceIds?: string[]`
- `GraphNode.evidenceIds?: string[]`
- `GraphLink.sourceIds: string[]`
- `GraphLink.evidenceIds: string[]`

For Phase 5, `GraphLink.evidenceIds` is mandatory after normalization. `GraphNode.evidenceIds` is mandatory for generated non-brand nodes. `brand-core` remains exempt.

### 4. Validate After Synthesis

Add a post-normalization provenance validator, likely in `lib/pipeline/provenance.ts`:

```ts
type ProvenanceValidationResult = {
  payload: SemanticUniversePayload;
  resultType: "success" | "degraded" | "fallback";
  reason?: string;
  rejectedLinks: number;
  rejectedNodes: number;
  repairedLinks: number;
};
```

Validation rules:

- Remove unknown `evidenceIds` and `sourceIds`.
- Derive `sourceIds` from evidence when missing.
- For each link, require at least one valid passage `evidenceId`.
- If a link has no valid evidence, attempt one deterministic repair by lexical overlap among source node label, target node label, relationship label, and passage excerpt/query/title.
- Reject the link if repair fails.
- For each non-brand node, require valid evidence after repair/derivation; reject unsupported generated nodes and attached links if necessary.
- Mark `degraded` if any generated structure is rejected or if repair was required.
- Mark `fallback` if the validated graph falls below 4 nodes, 3 grounded edges, or 3 passage evidence items.

Keep the repair heuristic simple and testable. A good first pass is token overlap with stopword removal and a bounded top-1 threshold. Do not call the model for repair in Phase 5.

### 5. Surface Result Type Calmly

Extend stream/payload metadata:

```ts
type ResultType = "success" | "degraded" | "fallback";

type SemanticUniversePayload = {
  resultType: ResultType;
  resultReason?: string;
  // existing fields...
};
```

Also emit or include the same data in stream details so the client can show a compact `/tool` indicator. Suggested user-facing copy:

- `Grounded synthesis`
- `Partial graph: unsupported relationships removed`
- `Fallback graph: not enough grounded evidence`

Telemetry should record `result_type`, `result_reason`, rejected/repaired counts, passage evidence count, and grounded edge count. Prefer existing JSON metadata fields before adding database columns.

## Implementation Plan Inputs

Likely work packages for `/gsd-plan-phase 5`:

1. Update models and stream contract for `sourceIds`, passage evidence fields, `resultType`, and `resultReason`.
2. Preserve provider-native passage candidates in retrieval output.
3. Add passage evidence extraction and synthesis prompt/schema changes.
4. Add provenance validator with deterministic repair/reject behavior.
5. Wire `resultType`/reason through `stream-handler.ts`, telemetry, and `/tool`.
6. Extend unit and contract tests for successful grounding, repair, rejection, degraded display, and fallback floor.

## Test Strategy

Add focused fixtures rather than broad live-provider tests:

- Exa result with multiple highlights becomes multiple passage `Evidence` rows tied to one source.
- Tavily `content` with chunk separators becomes passage rows.
- Link with valid passage evidence passes and derives `sourceIds`.
- Link with unknown evidence ID is repaired once when lexical overlap is strong.
- Link with no support is rejected.
- Unsupported non-brand node is removed or causes attached links to be removed.
- Graph below floor returns fallback with visible reason.
- Stream `done` payload and client schema accept `resultType` and `resultReason`.
- `/tool` renders compact degraded/fallback status without requiring the Phase 7 evidence panel.

## Risks and Guardrails

- **Prompt budget:** Passage IDs plus excerpts can grow quickly. Cap passages and excerpts before synthesis.
- **False repair:** Lexical overlap can attach weak support. Keep the threshold conservative and report degraded when repair occurs.
- **Schema churn:** Current UI reads `aiResponse`; keep it as an alias until Phase 7.
- **Provider variance:** Treat highlights/chunks as optional. The fallback path to `SourceItem.snippet` remains required.
- **Over-pruning:** Rejected edges may orphan nodes. Prune unsupported generated nodes but preserve `brand-core`.

## Sources

- Exa Search API guide: https://exa.ai/docs/reference/search-api-guide-for-coding-agents
- Tavily Search API docs: https://docs.tavily.com/documentation/api-reference/endpoint/search
- OpenAI Structured Outputs guide: https://developers.openai.com/api/docs/guides/structured-outputs
- ALCE, "Enabling Large Language Models to Generate Text with Citations": https://arxiv.org/abs/2305.14627
- RAGTruth, "A Hallucination Corpus for Developing Trustworthy Retrieval-Augmented Language Models": https://arxiv.org/abs/2401.00396
- ARES, "An Automated Evaluation Framework for Retrieval-Augmented Generation Systems": https://arxiv.org/abs/2311.09476

