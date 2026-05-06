# Phase 1: Stream Contract & Foundation Types - Context

**Gathered:** 2026-05-06  
**Status:** Ready for planning

<domain>
## Phase Boundary

Typed `PipelineEvent` (discriminated union) shared by the semantic-universe NDJSON stream and the `/tool` client; client consumption moves into an FSM-oriented hook; contract tests prove parsing for every event shape without a running server. **Scope does not include** new pipeline stages, observability, or UI copy changes beyond what falls out of stricter parse behavior.

**Intentional behavior change:** The client today skips individual lines that fail `JSON.parse`. The locked decision is to **fail the run** when the stream is structurally invalid or fails schema validation. For a well-behaved server emitting only valid lines, user-visible happy-path behavior remains the same; corrupt or mismatched lines surface as errors instead of being silently dropped.

</domain>

<decisions>
## Implementation Decisions

### Malformed or invalid stream lines
- **D-01:** Any line that is not valid JSON, or any event that fails validation, **must abort the run** and surface a clear error to the user (no silent per-line skip). This supersedes the previous `SyntaxError` swallow pattern in the stream loop.

### Runtime validation
- **D-02:** Use **zod** (or schemas derived from the same definitions) to **validate every successfully parsed NDJSON event on the client** before the FSM handles it. Shared schemas should live alongside the typed union so server emission and client consumption stay aligned.

### FSM hook responsibilities
- **D-03:** The hook encapsulates **NDJSON incremental parsing, validation, and FSM transitions** (`step` / `done` / `error`). The **page keeps** `fetch` to `/api/semantic-universe`, credentials, paywall/access pre-checks, and domain-specific side effects (e.g. `applyUniversePayload`, demo localStorage, task UI wiring).

### Contract tests
- **D-04 (Claude’s discretion):** Add automated contract tests that exercise **every variant** of the shared event union over fixture NDJSON (multi-line chunks, partial buffers) **without a live server**. Choice of runner (**Vitest** vs **Node `node:test`** + TypeScript execution) is left to the planner/implementer—pick the **lightest** approach that meets success criterion 3 and scales to later phases.

### Claude's Discretion
- Exact file layout under `lib/pipeline/` (e.g. `types.ts` vs split `events.ts` / `schemas.ts`) as long as SC2 holds: new event types extend one shared module.
- Test runner and file naming for contract tests.
- How error messages are phrased for validation failures (must be user-legible, not raw zod dumps).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning & requirements
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, STREAM-01/02 traceability
- `.planning/REQUIREMENTS.md` — STREAM-01, STREAM-02 acceptance language
- `.planning/STATE.md` — Stack decisions, approved deps (`zod@^4`), phase order
- `.planning/PROJECT.md` — Core product context, streaming constraint

### Current implementation (pre-refactor)
- `app/api/semantic-universe/route.ts` — `emitLine`, NDJSON response headers, event shapes today
- `app/tool/page.tsx` — Stream reader loop, local `StreamEvent` / `StepId`, step and done handling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **`emitLine` + `ReadableStream`** in `app/api/semantic-universe/route.ts` — pattern for newline-delimited JSON objects; types should wrap these payloads.
- **Local `StreamEvent` and `StepId`** in `app/tool/page.tsx` — behavioral reference for FSM inputs; should migrate to shared `PipelineEvent`.

### Established patterns
- **Incremental decode**: `TextDecoder` + buffer split on `\n` + carry incomplete tail (standard NDJSON client pattern).
- **Step updates**: `setAgentTasks` + `applyStepEvent` for progress UI — hook should feed the same conceptual events without rewriting the task model in Phase 1 unless unavoidable.

### Integration points
- **POST `/api/semantic-universe`** — stream consumer on `/tool` remains the primary integration surface.
- **402 / auth errors** — stay in the page’s fetch layer before the hook sees bytes.

</code_context>

<specifics>
## Specific Ideas

- User prefers **strict** stream handling (fail fast) paired with **zod** validation on the client.
- Hook stays **narrow** (parse + FSM); fetch and product logic stay in the page.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-stream-contract-foundation-types*  
*Context gathered: 2026-05-06*
