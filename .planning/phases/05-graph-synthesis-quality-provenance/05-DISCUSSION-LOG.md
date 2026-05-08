# Phase 5: Graph Synthesis Quality & Provenance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 05-graph-synthesis-quality-provenance
**Areas discussed:** Evidence Shape, Unsupported Edge Handling, Fallback Visibility, Evidence Strictness, Passage Extraction Source, Source and Passage IDs, Validation Failure Behavior, Minimum Usable Structure

---

## Evidence Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Passage evidence | Each evidence item is a short excerpt/snippet tied to a source URL. Best for trustworthy edge grounding and Phase 7 evidence UI. | yes |
| Source evidence | Each evidence item represents a whole URL/source, with summary text. Simpler but weaker for edge grounding. | |
| Hybrid evidence | Source-level parent plus 1-3 passage excerpts per source. Richest but larger schema/work. | |

**User's choice:** Passage evidence.
**Notes:** Keep source URL/title metadata for current UI compatibility, but passage is the grounding unit.

---

## Unsupported Edge Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Reject the edge | Remove unsupported edges before display. | |
| Downgrade the edge | Keep it but mark as missing/uncertain/gap. | |
| Repair once | Try to attach best matching passage; reject if still unsupported. | yes |

**User's choice:** Repair once.
**Notes:** Repair must be bounded; unsupported edges are removed after failed repair.

---

## Fallback Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Payload + stream detail | Include result type/reason in payload and stream, but no new UI badge yet. | |
| Visible UI indicator now | Add a small status indicator in `/tool` when result is fallback/degraded. | yes |
| Telemetry only | Record for debugging but do not show users yet. | |

**User's choice:** Visible UI indicator now.
**Notes:** Keep it small and status-like; do not build Phase 7 evidence panel now.

---

## Evidence Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Edges only | Every edge must have at least one passage evidence ID. | |
| Edges + non-brand nodes | Every relationship edge and every generated node except `brand-core` must be traceable. | yes |
| Everything | Every node, edge, discourse item, visual card, and model-strength row must have evidence. | |

**User's choice:** Edges + non-brand nodes.
**Notes:** Discourse/visual/model-strength should still use evidence where available, but they are not hard gates for Phase 5.

---

## Passage Extraction Source

| Option | Description | Selected |
|--------|-------------|----------|
| Ranked source snippets | Derive passages from already filtered/reranked `SourceItem.snippet`. | |
| Provider-native highlights/text | Prefer Exa highlights/text and Tavily content/chunks when available; snippets as fallback. | yes |
| New page extraction pass | Fetch source pages and extract passages directly. | |

**User's choice:** Provider-native highlights/text.
**Notes:** Avoid a new arbitrary page-fetch pass in Phase 5 to contain latency and SSRF risk.

---

## Source and Passage IDs

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `evidenceIds` | Keep current field names; IDs point to passage evidence. | |
| Add explicit `sourceIds` + `evidenceIds` | `sourceIds` identify URL/source; `evidenceIds` identify passages. | yes |
| Rename to `passageIds` | Most precise but breaks more existing UI/code. | |

**User's choice:** Add explicit `sourceIds` plus passage-level `evidenceIds`.
**Notes:** Existing UI can keep reading `evidenceIds`; downstream provenance gets a clean source/passage split.

---

## Validation Failure Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Degrade run | Return a partial graph with `result_type: degraded` and visible reason. | yes |
| Fallback graph | Abandon synthesis output and use deterministic fallback. | |
| Hard error | Fail the run and show an error. | |

**User's choice:** Degrade run.
**Notes:** Fall back only if graph drops below the minimum usable structure floor.

---

## Minimum Usable Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Small graph floor | At least 4 nodes, 3 grounded edges, and 3 passage evidence items. | yes |
| Current-size floor | At least 8 nodes, 8 grounded edges, and 6 passage evidence items. | |
| Ratio floor | Keep graph if at least 70% of synthesized edges survive validation. | |

**User's choice:** Small graph floor.
**Notes:** Truthfulness over size: a smaller grounded graph is better than a larger shaky one.

---

## the agent's Discretion

- Exact TypeScript field/type names for provenance helpers.
- Exact bounded repair heuristic.
- Exact degraded/fallback reason constants and telemetry shape.

## Deferred Ideas

- Full evidence panel UX belongs to Phase 7.
- Graph renderer/cluster improvements belong to Phase 6.
- Arbitrary page-fetch passage extraction is deferred due to latency/security risk.
