---
phase: 04
slug: multi-stage-retrieval-query-planner
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 4 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + TypeScript |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run lib/pipeline/__tests__/pipeline.contract.test.ts` |
| **Full suite command** | `npm test && npx tsc --noEmit` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task-specific `npx vitest run ...` command in the plan.
- **After every plan wave:** Run `npm test && npx tsc --noEmit`.
- **Before `$gsd-verify-work`:** Full suite must be green and manual `/tool` smoke must be recorded.
- **Max feedback latency:** 30 seconds for focused tests, 90 seconds for full suite.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | RTRY-02 | T-04-01 | Strict event parsing rejects malformed plan events | contract | `npx vitest run lib/pipeline/__tests__/pipeline.contract.test.ts` | yes | pending |
| 04-01-02 | 01 | 1 | RTRY-02 | T-04-02 | Raw search syntax is not primary UI copy | unit | `npx vitest run lib/pipeline/__tests__/pipeline.contract.test.ts` | yes | pending |
| 04-02-01 | 02 | 1 | RTRY-01 | T-04-03 | Planner stays inside hard query caps | unit | `npx vitest run lib/pipeline/__tests__/query-planner.test.ts` | wave 1 | pending |
| 04-02-02 | 02 | 1 | RTRY-01 | T-04-04 | Planner fallback avoids malformed LLM output | unit | `npx vitest run lib/pipeline/__tests__/query-planner.test.ts` | wave 1 | pending |
| 04-03-01 | 03 | 2 | RTRY-01 | T-04-05 | Provider fanout is bounded by caps and timeouts | unit | `npx vitest run lib/pipeline/__tests__/retriever.test.ts` | yes | pending |
| 04-03-02 | 03 | 2 | RTRY-01 | T-04-06 | Low-quality sources never reach scorer/synthesis | unit | `npx vitest run lib/pipeline/__tests__/source-quality.test.ts` | wave 2 | pending |
| 04-04-01 | 04 | 3 | RTRY-01, RTRY-02 | T-04-07 | Thin evidence emits degraded reason and telemetry | unit | `npx vitest run lib/pipeline/__tests__/stream-handler.test.ts` | wave 3 | pending |
| 04-04-02 | 04 | 3 | RTRY-01, RTRY-02 | T-04-08 | Run stats persistence remains additive | full | `npm test && npx tsc --noEmit` | wave 3 | pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trace panel preserves friendly query plan | RTRY-02 | Requires browser stream observation | Run `/tool` with a known brand; confirm the plan appears before retrieval and remains visible after completion. |
| Degraded retrieval wording is legible | RTRY-01 | User-facing copy quality is subjective | Force mocked thin evidence or temporarily reduce provider results; confirm stream detail states the thin-evidence reason without raw stack traces. |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or existing Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Wave 0 covers all missing test infrastructure references.
- [x] No watch-mode flags.
- [x] Feedback latency target under 90 seconds.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-06
