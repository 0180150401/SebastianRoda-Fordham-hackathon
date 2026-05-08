---
phase: 05-graph-synthesis-quality-provenance
plan: 03
subsystem: pipeline-ui-database
tags: [streaming, telemetry, supabase, ui, provenance]
requires:
  - phase: 05-graph-synthesis-quality-provenance
    provides: provenance validation result from 05-02
provides:
  - Result type and reason on final stream payload
  - Degraded/fallback synthesis telemetry columns
  - Compact /tool synthesis status indicator
affects: [semantic pipeline, Supabase telemetry, tool UI]
tech-stack:
  added: []
  patterns: [visible degradation status, additive telemetry migration]
key-files:
  created:
    - supabase/migrations/20260508060000_phase5_synthesis_provenance.sql
  modified:
    - lib/pipeline/stream-handler.ts
    - lib/pipeline/normalize-payload.ts
    - lib/pipeline/__tests__/pipeline.contract.test.ts
    - lib/pipeline/__tests__/stream-handler.test.ts
    - app/tool/page.tsx
key-decisions:
  - "Result metadata stays on the final done payload; no new stream event discriminator was added."
  - "The migration is self-healing for a remote semantic_pipeline_runs drift observed during db push."
patterns-established:
  - "Stream detail, payload, UI, and telemetry share the same result type/reason vocabulary."
  - "Supabase telemetry migrations remain additive and preserve RLS."
requirements-completed: [SYN-01, SYN-02]
duration: 25min
completed: 2026-05-08
---

# Phase 5: Graph Synthesis Quality & Provenance Summary

**Synthesis provenance status now flows through stream payloads, telemetry, and the `/tool` graph UI**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-08T05:44:00Z
- **Completed:** 2026-05-08T06:09:34Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments

- Added `success`, `degraded`, and `fallback` result propagation through `stream-handler.ts`.
- Persisted synthesis reason and provenance counts to Supabase telemetry.
- Added compact `/tool` copy: `Grounded synthesis`, `Partial graph: unsupported relationships removed`, and `Fallback graph: not enough grounded evidence`.
- Applied the Phase 5 Supabase migration with `supabase db push`.

## Task Commits

1. **Task 1-4: Stream, telemetry, contract, and UI status** - `07f8a42` (feat)
2. **UI status polish: Avoid initial grounded copy before a run** - `04295b0` (fix)
3. **Telemetry fallback polish: Preserve OpenAI usage when provenance falls below graph floor** - `1f36f98` (fix)

## Files Created/Modified

- `supabase/migrations/20260508060000_phase5_synthesis_provenance.sql` - Result type relaxation and synthesis provenance telemetry columns.
- `lib/pipeline/stream-handler.ts` - Result metadata and provenance counts wired through synthesis, done payload, and telemetry.
- `lib/pipeline/normalize-payload.ts` - Client payload normalization preserves result type/reason.
- `lib/pipeline/__tests__/pipeline.contract.test.ts` - Done payload metadata fixture.
- `lib/pipeline/__tests__/stream-handler.test.ts` - Success, degraded, and fallback stream/telemetry coverage.
- `app/tool/page.tsx` - Compact synthesis status indicator.

## Decisions Made

- Made the migration recreate `semantic_pipeline_runs` if the remote project has migration history but the table is missing. This preserves the existing RLS policy shape and then applies Phase 4 and Phase 5 additive telemetry columns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Remote telemetry table missing during schema push**
- **Found during:** Task 1 (`supabase db push`)
- **Issue:** Remote migration history allowed Phase 5 migration to run, but `public.semantic_pipeline_runs` did not exist, causing `SQLSTATE 42P01`.
- **Fix:** Made the Phase 5 migration self-healing by creating `semantic_pipeline_runs` with the Phase 2 schema if missing, preserving RLS policy names, adding Phase 4 retrieval columns, and then adding Phase 5 synthesis columns.
- **Files modified:** `supabase/migrations/20260508060000_phase5_synthesis_provenance.sql`
- **Verification:** Re-ran `supabase db push`; it finished successfully.
- **Committed in:** `07f8a42`

**2. [Rule 2 - Missing Critical] Preserve usage when validator returns fallback**
- **Found during:** Code review gate
- **Issue:** A below-floor model graph could be converted to fallback after OpenAI returned, but throwing from `synthesizeWithOpenAI` discarded token usage in telemetry.
- **Fix:** Return provenance fallback metadata to `stream-handler.ts`, build the fallback payload there, and keep OpenAI usage counts.
- **Files modified:** `lib/pipeline/structurer.ts`, `lib/pipeline/stream-handler.ts`
- **Verification:** `npx vitest run lib/pipeline/__tests__/stream-handler.test.ts lib/pipeline/__tests__/structurer.test.ts`; `npx tsc --noEmit`
- **Committed in:** `1f36f98`

---

**Total deviations:** 2 auto-fixed (blocking migration drift, telemetry accuracy). **Impact on plan:** Both fixes preserve planned behavior and improve production reliability without expanding user-facing scope.

## Issues Encountered

- Supabase CLI reported a newer CLI version is available, but the installed CLI successfully pushed the migration.

## User Setup Required

None - migration was pushed to the configured Supabase project.

## Verification

- `npx vitest run lib/pipeline/__tests__/pipeline.contract.test.ts lib/pipeline/__tests__/stream-handler.test.ts` — passed
- `npx tsc --noEmit` — passed
- `npm test` — passed, 78 tests
- `supabase db push` — passed after self-healing migration adjustment

## Next Phase Readiness

Phase 6 can now rely on graph payloads that carry grounded link/source evidence plus result status metadata for degraded or fallback runs.

## Self-Check: PASSED

---
*Phase: 05-graph-synthesis-quality-provenance*
*Completed: 2026-05-08*
