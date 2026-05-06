---
phase: 03-pipeline-extraction-scorer
plan: 02
subsystem: pipeline
tags: [nextjs, semantic-universe, voyageai, rerank, vitest]

requires:
  - phase: 03-pipeline-extraction-scorer
    provides: Plan 03-01 shared pipeline models and retriever stage
provides:
  - Voyage-powered source scorer before OpenAI synthesis
  - Safe no-key, timeout, and API-error fallback to first 18 sources
  - Scorer unit tests with mocked Voyage client
affects: [pipeline, semantic-universe-route, scorer]

tech-stack:
  added: [voyageai@^0.2.1]
  patterns:
    - "Pipeline scoring lives in lib/pipeline/scorer.ts"
    - "Optional external ranking stages must preserve deterministic fallback order"

key-files:
  created:
    - lib/pipeline/scorer.ts
    - lib/pipeline/__tests__/scorer.test.ts
    - .planning/phases/03-pipeline-extraction-scorer/03-02-SUMMARY.md
  modified:
    - package.json
    - package-lock.json
    - .env.example
    - app/api/semantic-universe/route.ts

key-decisions:
  - "Kept Voyage reranking optional through VOYAGE_API_KEY so local/test runs preserve existing source order."
  - "Used ranked source count for source telemetry after the scoring stage."
  - "Lazy-loaded the Voyage SDK through CommonJS because its ESM export currently fails Vitest directory import resolution."

patterns-established:
  - "Scorer stages expose a public pipeline function plus an injectable inner helper for mocked tests."
  - "Rerank failures log a redacted [scorer] warning and return the naive top-N source slice."

requirements-completed: [PIPE-01, PIPE-02]

duration: 6 min
completed: 2026-05-06
---

# Phase 03 Plan 02: Voyage Source Scorer Summary

**Voyage `rerank-2.5` now ranks retrieved semantic-universe sources before OpenAI synthesis, with deterministic fallback coverage.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-06T21:18:40Z
- **Completed:** 2026-05-06T21:24:15Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments

- Installed `voyageai@^0.2.1` and documented optional `VOYAGE_API_KEY` setup.
- Added `scoreSourcesForSynthesis`, which calls Voyage `rerank-2.5` with an 8s timeout and falls back to the existing top-18 ordering when disabled or failing.
- Wired ranked sources into competitor extraction, OpenAI synthesis, fallback synthesis, image enrichment, and source telemetry.
- Added scorer tests for no-key fallback and mocked rerank ordering.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install voyageai SDK** - `8c54e12` (chore)
2. **Task 2: Implement lib/pipeline/scorer.ts** - `949ccd9` (feat)
3. **Task 3: Wire scorer into semantic-universe stream** - `4612b9e` (feat)
4. **Task 4: Vitest tests for scorer fallback + ordering** - `eb569b1` (test)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `lib/pipeline/scorer.ts` - Voyage rerank wrapper, top-18 fallback, timeout handling, and injectable test helper.
- `lib/pipeline/__tests__/scorer.test.ts` - Tests no-key fallback and mocked ranking order.
- `app/api/semantic-universe/route.ts` - Reads `VOYAGE_API_KEY` and passes ranked sources into downstream synthesis/enrichment.
- `package.json` - Adds `voyageai`.
- `package-lock.json` - Locks `voyageai@0.2.1` and transitive dependencies.
- `.env.example` - Documents optional `VOYAGE_API_KEY`.

## Decisions Made

- Used `rerank-2.5` exactly as planned and kept the query deterministic: `${brand} semantic brand universe competitive intent`.
- Counted `source_count` as ranked source count because downstream synthesis now consumes the scored subset.
- Kept manual live-key verification optional; automated tests mock the ranking path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lazy-load Voyage SDK for test compatibility**
- **Found during:** Task 4 (Vitest tests for scorer fallback + ordering)
- **Issue:** Static `voyageai` import failed Vitest before tests ran because the SDK's ESM export resolves a directory import unsupported by Node's ESM loader.
- **Fix:** Replaced the static SDK import with a lazy CommonJS load only when `VOYAGE_API_KEY` is present; mocked tests exercise the injectable rerank helper without importing the SDK.
- **Files modified:** `lib/pipeline/scorer.ts`
- **Verification:** `npx vitest run lib/pipeline/__tests__/scorer.test.ts`, `npm test`, and `npx tsc --noEmit` passed.
- **Committed in:** `eb569b1` (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking).
**Impact on plan:** No scope creep; the fix preserves production reranking while keeping no-key/test paths deterministic.

## Issues Encountered

`npm install voyageai` reported existing audit findings (7 vulnerabilities: 3 moderate, 4 high). The plan did not include audit remediation, so no dependency tree changes beyond installing the approved SDK were made.

## User Setup Required

Optional only:

- Add `VOYAGE_API_KEY` in the deployment environment to enable Voyage reranking.
- Omit `VOYAGE_API_KEY` to keep deterministic first-18 source fallback behavior.

## Verification

- `node -e "require('./package.json').dependencies.voyageai || process.exit(1)"` - passed
- Task acceptance sweep (`grep`/`test -f` checks for dependency, env key, scorer, route, and test file) - passed
- `npx vitest run lib/pipeline/__tests__/scorer.test.ts` - passed (1 file, 2 tests)
- `npx tsc --noEmit` - passed
- `npm test` - passed (4 files, 40 tests)
- Manual optional live rerank with `VOYAGE_API_KEY` - not run

## Next Phase Readiness

Ready for Plan 03-03. The route now has retrieval and scoring extracted behind importable pipeline modules, and synthesis receives no more than 18 ranked sources.

---
*Phase: 03-pipeline-extraction-scorer*
*Completed: 2026-05-06*
