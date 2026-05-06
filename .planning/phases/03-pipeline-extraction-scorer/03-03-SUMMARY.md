---
phase: 03-pipeline-extraction-scorer
plan: 03
subsystem: pipeline
tags: [nextjs, semantic-universe, openai, ndjson, vitest]

requires:
  - phase: 03-pipeline-extraction-scorer
    provides: Plan 03-01 pipeline models/retriever and Plan 03-02 scorer/rerank wiring
provides:
  - Isolated visual enrichment stage
  - Isolated OpenAI structuring, fallback, and normalization stage
  - Central semantic universe NDJSON stream handler
  - Structurer smoke tests without OpenAI network access
affects: [pipeline, semantic-universe-route, stream-handler, structurer, enricher]

tech-stack:
  added: []
  patterns:
    - "Semantic universe stages live under lib/pipeline/ and are invoked by stream-handler.ts"
    - "Route handlers stay as auth, budget, env, client, stream, and response-cookie shells"

key-files:
  created:
    - lib/pipeline/enricher.ts
    - lib/pipeline/structurer.ts
    - lib/pipeline/stream-handler.ts
    - lib/pipeline/__tests__/structurer.test.ts
    - .planning/phases/03-pipeline-extraction-scorer/03-03-SUMMARY.md
  modified:
    - app/api/semantic-universe/route.ts

key-decisions:
  - "Kept the stream handler responsible for NDJSON stage ordering and telemetry writes while the route owns access checks and response cookies."
  - "Exported extractJsonObject for deterministic structurer smoke coverage without invoking OpenAI."
  - "Preserved existing OpenAI prompt text, model id, fallback graph shape, image resolution behavior, and scorer-before-synthesis ordering."

patterns-established:
  - "Pipeline modules export one public stage function plus private helper closures for their local behavior."
  - "Stream orchestration accepts server-side dependencies rather than reading request/user state directly."

requirements-completed: [PIPE-01]

duration: 8 min
completed: 2026-05-06
---

# Phase 03 Plan 03: Pipeline Structurer and Stream Handler Summary

**Semantic universe image enrichment, OpenAI structuring, fallback normalization, and NDJSON orchestration now live in importable pipeline modules while the route POST shell is 40 lines.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-06T21:23:30Z
- **Completed:** 2026-05-06T21:31:34Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments

- Extracted visual image resolution and correlation enrichment into `lib/pipeline/enricher.ts`.
- Extracted OpenAI synthesis, fallback payload construction, competitor mining, JSON extraction, and normalization helpers into `lib/pipeline/structurer.ts`.
- Added `lib/pipeline/stream-handler.ts` to own run_meta, source retrieval, Voyage scoring, synthesis, enrichment, demo marking, telemetry insert, usage accounting, done/error events, and stream close behavior.
- Slimmed `app/api/semantic-universe/route.ts` to an auth/budget/env/client/response shell with `POST` at 40 physical lines.
- Added deterministic structurer tests for JSON extraction and fallback payload construction without OpenAI network calls.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract enricher.ts (image pipeline)** - `62695d0` (feat)
2. **Task 2: Extract structurer.ts (synthesis + fallback + normalization)** - `0a279ad` (feat)
3. **Task 3: Create stream-handler.ts & slim route.ts** - `d55ffb6` (feat)
4. **Task 4: Minimal structurer unit smoke test** - `d4a519e` (test)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `lib/pipeline/enricher.ts` - Image URL detection, meta/inline image resolution, and visual correlation enrichment.
- `lib/pipeline/structurer.ts` - OpenAI graph synthesis, fallback graph generation, model payload normalization, model strength helpers, and competitor extraction.
- `lib/pipeline/stream-handler.ts` - NDJSON stream stage orchestration, telemetry insert, OpenAI usage accounting, and final done/error events.
- `lib/pipeline/__tests__/structurer.test.ts` - Smoke tests for pure structurer behavior without network calls.
- `app/api/semantic-universe/route.ts` - Thin coordinator for kill switch, auth, paywall, budget, env validation, traced OpenAI client, stream response, and demo cookie.

## Decisions Made

- Kept telemetry writes and usage accounting in the stream handler because they are part of the ordered stream lifecycle and need stage durations/output counts.
- Passed `markFreeDemoUsed` into the handler as a callback so admin/user Supabase profile write setup stays route-local.
- Exported `extractJsonObject` as a small test seam for meaningful deterministic structurer coverage.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope creep; extraction stayed within declared files and direct tests.

## Issues Encountered

A local generation script for Task 3 initially failed before writing files due to an escaped template literal in generated text. It was corrected and rerun; no repository files were changed by the failed attempt.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx tsc --noEmit` - passed
- `npx vitest run lib/pipeline/__tests__/structurer.test.ts` - passed (1 file, 2 tests)
- `npm test` - passed (5 files, 42 tests), including the existing NDJSON contract suite
- `grep -c "async function enrichVisualCorrelationsWithImages" app/api/semantic-universe/route.ts` - `0`
- `grep -c "async function synthesizeWithOpenAI" app/api/semantic-universe/route.ts` - `0`
- `grep -q "enrichVisualCorrelationsWithImages" lib/pipeline/enricher.ts` - passed
- `grep -q "synthesizeWithOpenAI" lib/pipeline/structurer.ts` - passed
- `test -f lib/pipeline/stream-handler.ts` - passed
- `grep -q "runSemanticUniverseAnalysisStream\\|attachSemanticUniverseStream" lib/pipeline/stream-handler.ts` - passed
- `POST` line count - 40 physical lines including blanks

## Next Phase Readiness

Phase 03 pipeline decomposition is complete from this plan's scope. The semantic route now composes retriever, scorer, structurer, enricher, and stream-handler modules, ready for downstream query-planning/retrieval-depth work.

## Self-Check: PASSED

---
*Phase: 03-pipeline-extraction-scorer*
*Completed: 2026-05-06*
