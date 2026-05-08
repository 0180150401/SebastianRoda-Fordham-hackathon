---
phase: 05-graph-synthesis-quality-provenance
plan: 02
subsystem: pipeline
tags: [graph, provenance, validation, synthesis, vitest]
requires:
  - phase: 05-graph-synthesis-quality-provenance
    provides: passage evidence IDs and source IDs from 05-01
provides:
  - Post-synthesis provenance validator
  - Deterministic link repair/reject behavior
  - Fallback-floor result classification
affects: [stream handler, telemetry, tool UI]
tech-stack:
  added: []
  patterns: [post-normalization validation, deterministic lexical repair]
key-files:
  created:
    - lib/pipeline/provenance.ts
    - lib/pipeline/__tests__/provenance.test.ts
  modified:
    - lib/pipeline/structurer.ts
    - lib/pipeline/__tests__/structurer.test.ts
key-decisions:
  - "Use trusted passage evidence from buildPassageEvidence as the synthesis evidence set."
  - "Repair links once with conservative lexical overlap; reject unsupported structure otherwise."
patterns-established:
  - "Graph provenance is validated after model normalization and before stream emission."
  - "Below-floor model graphs are classified as fallback rather than shown."
requirements-completed: [SYN-01]
duration: 24min
completed: 2026-05-08
---

# Phase 5: Graph Synthesis Quality & Provenance Summary

**Post-synthesis graph provenance validator with deterministic repair, rejection, and fallback-floor classification**

## Performance

- **Duration:** 24 min
- **Started:** 2026-05-08T05:40:00Z
- **Completed:** 2026-05-08T06:04:54Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added `validateGraphProvenance` with source ID derivation, unknown ID filtering, conservative repair, unsupported structure rejection, and fallback floor checks.
- Updated synthesis to prompt against trusted passage IDs and validate normalized model payloads before returning.
- Updated fallback payloads to include passage-compatible evidence and non-empty link `sourceIds`.

## Task Commits

1. **Task 1-3: Provenance validation integration** - `45b5586` (feat)

## Files Created/Modified

- `lib/pipeline/provenance.ts` - Validator and result metadata.
- `lib/pipeline/__tests__/provenance.test.ts` - Repair, reject, derive, degraded, and fallback coverage.
- `lib/pipeline/structurer.ts` - Trusted passage prompting and validator integration.
- `lib/pipeline/__tests__/structurer.test.ts` - Trusted evidence and fallback source ID coverage.

## Decisions Made

None beyond the plan. The repair threshold requires at least two overlapping meaningful tokens, which keeps brand-name-only matches from attaching weak evidence.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run lib/pipeline/__tests__/passage-evidence.test.ts lib/pipeline/__tests__/provenance.test.ts lib/pipeline/__tests__/structurer.test.ts` — passed
- `npx tsc --noEmit` — passed
- `npm test` — passed, 75 tests

## Next Phase Readiness

Wave 3 can now propagate `success`, `degraded`, and `fallback` from provenance validation through stream payloads, telemetry, and `/tool`.

## Self-Check: PASSED

---
*Phase: 05-graph-synthesis-quality-provenance*
*Completed: 2026-05-08*
