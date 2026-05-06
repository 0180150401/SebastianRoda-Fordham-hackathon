---
phase: 03-pipeline-extraction-scorer
plan: 01
subsystem: pipeline
tags: [nextjs, semantic-universe, tavily, exa, vitest]

requires:
  - phase: 02-observability-security-cost-controls
    provides: Phase 2 telemetry and stream shell retained in the route
provides:
  - Shared semantic universe domain model exports
  - Isolated Tavily and Exa source retrieval stage
  - Retriever unit tests with mocked fetch
affects: [pipeline, semantic-universe-route, retriever, scorer]

tech-stack:
  added: []
  patterns:
    - "Pipeline domain models live in lib/pipeline/models.ts"
    - "Pipeline stages expose importable functions under lib/pipeline/"

key-files:
  created:
    - lib/pipeline/models.ts
    - lib/pipeline/retriever.ts
    - lib/pipeline/__tests__/retriever.test.ts
  modified:
    - app/api/semantic-universe/route.ts

key-decisions:
  - "Kept Tavily and Exa retrieval as raw fetch calls to preserve existing payloads exactly."
  - "Kept dedupeByUrl exported from retriever so later scorer/enricher plans can reuse source ordering semantics."

patterns-established:
  - "Move route-local domain contracts into lib/pipeline/models.ts and import them with type-only imports where possible."
  - "Expose pipeline stages as small server-side functions that can be tested without instantiating the Next route."

requirements-completed: [PIPE-01]

duration: 10 min
completed: 2026-05-06
---

# Phase 03 Plan 01: Pipeline Retrieval Extraction Summary

**Semantic universe domain models and Tavily/Exa retrieval now live in shared pipeline modules with mocked Vitest coverage.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-06T21:06:00Z
- **Completed:** 2026-05-06T21:16:18Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Extracted graph, evidence, discourse, visual correlation, model strength, source, payload, and `TRACKED_MODELS` contracts into `lib/pipeline/models.ts`.
- Moved Tavily, Exa, and URL dedupe retrieval logic into `lib/pipeline/retriever.ts` while preserving merge order and the 18-source cap.
- Added retriever tests for duplicate URL collapse and mocked multi-provider source retrieval.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/pipeline/models.ts — domain types + constants** - `1b94656` (feat)
2. **Task 2: Create lib/pipeline/retriever.ts + wire route** - `83da8f2` (feat)
3. **Task 3: Vitest unit tests for dedupe + retriever (mocked fetch)** - `011ded3` (test)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `lib/pipeline/models.ts` - Shared semantic universe domain types and `TRACKED_MODELS`.
- `lib/pipeline/retriever.ts` - Tavily/Exa retrieval, URL dedupe, and `retrieveSourcesForBrand`.
- `lib/pipeline/__tests__/retriever.test.ts` - Vitest coverage for dedupe and retrieval cap behavior with mocked fetch.
- `app/api/semantic-universe/route.ts` - Imports shared models/retriever and calls `retrieveSourcesForBrand` inside the existing stream stage.

## Decisions Made

- Kept raw Tavily/Exa HTTP requests rather than adopting an SDK so request payloads, headers, and response parsing remain unchanged in this plan.
- Kept `dedupeByUrl` available to the route because image enrichment still relies on the same source ordering semantics until later extraction plans move that logic.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope creep; extraction stayed within declared files.

## Issues Encountered

Initial TypeScript verification after Task 1 found one missing imported type (`ModelStrengthPayload`). It was added before the Task 1 commit and verification passed.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run lib/pipeline/__tests__/retriever.test.ts` — passed (1 file, 2 tests)
- `npm test` — passed (3 files, 38 tests)
- `npx tsc --noEmit` — passed
- Plan acceptance sweep — passed

## Next Phase Readiness

Ready for Plan 03-02. The route now depends on `lib/pipeline/models.ts` and `lib/pipeline/retriever.ts`, giving the scorer plan an importable retrieval stage to rank.

---
*Phase: 03-pipeline-extraction-scorer*
*Completed: 2026-05-06*
