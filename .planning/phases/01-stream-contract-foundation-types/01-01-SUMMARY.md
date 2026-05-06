# Plan 01-01 Summary — Tooling & shared pipeline types

**Completed:** 2026-05-06  
**Wave:** 1

## Installed

- `zod@^4`, `vitest@^4`, `@vitest/coverage-v8@^4` (dev)
- Scripts: `test`, `test:contract`, `test:watch`

## Artifacts

| File | Purpose |
|------|---------|
| `vitest.config.ts` | `@` → repo root; `passWithNoTests: true` |
| `lib/pipeline/types.ts` | `PipelineEvent`, `pipelineEventSchema`, `STEP_IDS`, `MAX_NDJSON_LINE_BYTES` |
| `lib/pipeline/normalize-payload.ts` | `normalizePayload(unknown)` + `buildGraph` + seed fixtures (extracted from `app/tool/page.tsx`; page unchanged this wave) |

## Key exports

- `pipelineEventSchema`, `PipelineEvent`, `StepId`, `StepStatus`, `MAX_NDJSON_LINE_BYTES`
- `normalizePayload`, `SemanticUniversePayload`

## Self-Check: PASSED

- `npx tsc --noEmit` clean
- `npm test` exits 0
