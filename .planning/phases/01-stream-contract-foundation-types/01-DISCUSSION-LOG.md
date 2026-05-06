# Phase 1: Stream Contract & Foundation Types - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.  
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-06  
**Phase:** 1 — Stream Contract & Foundation Types  
**Areas discussed:** Malformed lines, Validation strictness, Contract test runner, FSM hook scope  

---

## Malformed lines

| Option | Description | Selected |
|--------|-------------|----------|
| Keep skip | Skip bad lines, continue (matches current production client) | |
| Fail run | Any bad line aborts and surfaces an error | ✓ |
| Skip + dev warn | Skip in prod; console.warn in development | |

**User's choice:** Fail the run  
**Notes:** Tightens contract versus today’s `SyntaxError`-per-line ignore; happy path unchanged if server only emits valid JSON.

---

## Validation strictness

| Option | Description | Selected |
|--------|-------------|----------|
| zod every line | Shared schemas; validate every event in the hook | ✓ |
| Types + tests only | Narrowing + JSON.parse; schemas enforced in CI fixtures only | |
| zod in tests only | zod on server/tests; light guards on client | |

**User's choice:** zod every line (client)  
**Notes:** Aligns with fail-fast stream handling.

---

## Contract test runner

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest | Add Vitest for Next-aligned DX | |
| node:test | Node built-in tests, minimal deps | |
| Implementer choice | Lightest approach that satisfies no-server contract tests | ✓ |

**User's choice:** Implementer / Claude discretion  
**Notes:** Recorded under CONTEXT “Claude’s discretion”; planner picks runner.

---

## FSM hook scope

| Option | Description | Selected |
|--------|-------------|----------|
| Parse + FSM only | Page keeps fetch, paywall, payload application | ✓ |
| Include fetch | Hook owns full HTTP + reader lifecycle | |

**User's choice:** Parse + FSM only  
**Notes:** Minimizes refactor surface for Phase 1.

---

## Claude's Discretion

- Test runner selection and concrete test file layout  
- Sub-file layout under `lib/pipeline/`  
- User-facing error copy for validation failures  

## Deferred Ideas

None.
