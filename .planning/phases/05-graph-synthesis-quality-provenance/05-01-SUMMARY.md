---
phase: 05-graph-synthesis-quality-provenance
plan: 01
subsystem: pipeline
tags: [retrieval, evidence, provenance, types, vitest]
requires:
  - phase: 04-multi-stage-retrieval-query-planner
    provides: planned Tavily/Exa retrieval and ranked usable sources
provides:
  - Passage-level evidence extraction from ranked sources
  - Additive source/document provenance fields
  - Provider-native Exa/Tavily passage preservation
affects: [graph synthesis, stream payload, tool evidence UI]
tech-stack:
  added: []
  patterns: [deterministic evidence IDs, provider-native passage preservation]
key-files:
  created:
    - lib/pipeline/passage-evidence.ts
    - lib/pipeline/__tests__/passage-evidence.test.ts
  modified:
    - lib/pipeline/models.ts
    - lib/pipeline/retriever.ts
    - lib/pipeline/structurer.ts
key-decisions:
  - "Preserve existing Evidence.aiResponse while adding passage-specific excerpt/sourceId metadata."
  - "Use deterministic ev-SS-PP passage IDs and source IDs for validator-friendly provenance."
patterns-established:
  - "Passage extraction runs from ranked SourceItem data without fetching arbitrary URLs."
  - "Provider-native passages live on SourceItem.passages while snippet remains a compatibility fallback."
requirements-completed: [SYN-01]
duration: 22min
completed: 2026-05-08
---

# Phase 5: Graph Synthesis Quality & Provenance Summary

**Passage evidence foundation with provider-native Exa/Tavily excerpts and additive source/document provenance fields**

## Performance

- **Duration:** 22 min
- **Started:** 2026-05-08T05:37:00Z
- **Completed:** 2026-05-08T05:59:13Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added additive `ResultType`, `SourceDocument`, `SourcePassage`, `sourceIds`, passage evidence, and result metadata types.
- Preserved Exa highlights/text and Tavily advanced chunks on `SourceItem.passages`.
- Added deterministic `buildPassageEvidence`, `buildSourceDocuments`, and `formatEvidenceForSynthesis` helpers with focused unit tests.

## Task Commits

1. **Task 1-3: Passage provenance foundation** - `2be25f9` (feat)

## Files Created/Modified

- `lib/pipeline/models.ts` - Additive provenance/result fields.
- `lib/pipeline/retriever.ts` - Provider-native passage preservation.
- `lib/pipeline/passage-evidence.ts` - Deterministic source/passages to evidence helpers.
- `lib/pipeline/__tests__/passage-evidence.test.ts` - Passage extraction fixtures.
- `lib/pipeline/structurer.ts` - Compatibility source IDs on fallback/normalization paths after making `GraphLink.sourceIds` required.

## Decisions Made

None beyond the plan. Implementation followed Phase 5 research and context.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm test -- --runInBand` failed because Vitest does not support Jest's `--runInBand` flag. Re-ran the project script as `npm test`, which passed.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run lib/pipeline/__tests__/passage-evidence.test.ts` — passed
- `npx vitest run lib/pipeline/__tests__/passage-evidence.test.ts lib/pipeline/__tests__/structurer.test.ts` — passed
- `npx tsc --noEmit` — passed
- `npm test` — passed, 69 tests

## Next Phase Readiness

Wave 2 can now consume passage IDs and source IDs from trusted evidence when adding post-synthesis provenance validation.

## Self-Check: PASSED

---
*Phase: 05-graph-synthesis-quality-provenance*
*Completed: 2026-05-08*
