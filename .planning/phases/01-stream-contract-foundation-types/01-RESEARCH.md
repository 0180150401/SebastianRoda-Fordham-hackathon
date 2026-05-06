# Phase 1: Stream Contract & Foundation Types - Research

**Researched:** 2026-05-06  
**Domain:** NDJSON streaming, TypeScript discriminated unions, Zod validation, lightweight contract testing in Next.js 16  
**Confidence:** MEDIUM-HIGH — event shapes and codebase patterns verified locally; Zod APIs verified against official docs; full end-to-end “zero regression” depends on manual `/tool` UAT unless Playwright added later `[CITED: zod.dev/api]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**(From `<decisions>` / Implementation Decisions in `01-CONTEXT.md`)**

- **Malformed or invalid stream lines (D-01):** Any line that is not valid JSON, or any event that fails validation, **must abort the run** and surface a clear error to the user (no silent per-line skip). This supersedes the previous `SyntaxError` swallow pattern in the stream loop.

- **Runtime validation (D-02):** Use **zod** (or schemas derived from the same definitions) to **validate every successfully parsed NDJSON event on the client** before the FSM handles it. Shared schemas should live alongside the typed union so server emission and client consumption stay aligned.

- **FSM hook responsibilities (D-03):** The hook encapsulates **NDJSON incremental parsing, validation, and FSM transitions** (`step` / `done` / `error`). The **page keeps** `fetch` to `/api/semantic-universe`, credentials, paywall/access pre-checks, and domain-specific side effects (e.g. `applyUniversePayload`, demo localStorage, task UI wiring).

- **Contract tests (D-04):** Add automated contract tests that exercise **every variant** of the shared event union over fixture NDJSON (multi-line chunks, partial buffers) **without a live server**. Choice of runner (**Vitest** vs **Node `node:test`** + TypeScript execution) is left to the planner/implementer — pick the **lightest** approach that meets success criterion 3 and scales to later phases.

### Claude's Discretion

**(From `01-CONTEXT.md` — includes items under “### Claude's Discretion” inside `<decisions>`)**

- Exact file layout under `lib/pipeline/` (e.g. `types.ts` vs split `events.ts` / `schemas.ts`) as long as SC2 holds: new event types extend one shared module.
- Test runner and file naming for contract tests.
- How error messages are phrased for validation failures (must be user-legible, not raw zod dumps).

### Deferred Ideas (OUT OF SCOPE)

**(From `<deferred>` in `01-CONTEXT.md`)**

- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STREAM-01 | Typed `PipelineEvent` defines the NDJSON contract shared by `semantic-universe` and `/tool` without breaking existing step semantics. | Canonical server events today: `{ type: "step", ... }`, `{ type: "done", payload }`, `{ type: "error", message }` emitted via `emitLine` `[VERIFIED: codebase]`; map 1:1 to `z.discriminatedUnion("type", ...)` `[CITED: zod.dev/api]` + `z.infer` for TS types; keep discriminator key `type` stable. |
| STREAM-02 | Client handling encapsulated (FSM hook), replacing ad-hoc parsing so new events are safe to add. | Extract `TextDecoder` + buffer + newline split `[VERIFIED: app/tool/page.tsx]` into a hook; consume `PipelineEvent` only after `schema.safeParse` / `parse`; replace `if (event.type === "step")` string checks with **narrowed** branches after parse (not ad-hoc `JSON.parse` + cast). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Actionable directives the planner must not contradict:

| Constraint | Source |
|------------|--------|
| Stay on Next.js 16, React 19, Supabase, Stripe, existing APIs unless narrowly scoped exception. | CLAUDE.md Project Constraints |
| No secrets in repo or planning docs. | CLAUDE.md |
| **Streaming:** Preserve or improve incremental UX (steps visible during long runs). | CLAUDE.md |
| TypeScript strict; `@/*` imports; hooks under `hooks/` with `use-` prefix; new helpers in `lib/` when extracting from large files. | CLAUDE.md conventions (STACK/CONVENTIONS) |
| Approved additive dependency per STATE: **`zod@^4`** (not yet in root `package.json` — install required) `[VERIFIED: package.json]` + `[VERIFIED: .planning/STATE.md]` |

## Summary

Phase 1 formalizes what the product already does: the server streams newline-delimited JSON objects with `Content-Type: application/x-ndjson` `[VERIFIED: app/api/semantic-universe/route.ts]`, and the client incrementally decodes, splits on `\n`, and handles three event kinds (`step`, `done`, `error`) `[VERIFIED: app/tool/page.tsx]`. The research gap is not “what to stream” but **how to lock the contract**: a single shared discriminated union (types + Zod schemas), a **fail-fast** consumer (locked in CONTEXT), and **offline** contract tests that chunk fixtures the same way browsers chunk network reads.

**Primary recommendation:** Put `PipelineEvent` + `pipelineEventSchema` in `lib/pipeline/types.ts` (or split files if large), use **`z.discriminatedUnion("type", [...])`** for efficient, correct parsing `[CITED: zod.dev/api]`, implement `useSemanticUniverseStream` (name at planner discretion) that owns buffer/parse/validate/FSM callbacks, and add **Vitest** contract tests in Node (no browser) with `@/*` path resolution. Treat the **`done.payload`** subtree as the main complexity: today's UI relies on permissive parsing + `normalizePayload` **`[VERIFIED: app/tool/page.tsx]`** — the planner must either lift normalization into `lib/` and wrap it with Zod `.transform`/`.pipe`, or define a pragmatic Zod level that preserves identical normalized output (see Pitfalls).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | `^4.4.3` | Runtime validation + inferred `PipelineEvent` type | Locked by CONTEXT/STATE; stable v4 `[VERIFIED: npm registry]` |
| Native `ReadableStream` + `TextDecoder` | built-in | NDJSON incremental decode | Already used; no dependency |
| TypeScript `strict` | `^5` (dev) | Shared types across route + client | Repo standard `[VERIFIED: package.json]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|-------------|-------------|
| `vitest` | `^4.1.5` | Contract test runner, TS/ESM, fast Node pool | Recommended default per D-04 “lightest scalable” `[VERIFIED: npm registry]` |
| `tsx` | (optional) | Run TS files with `node:test` without Vitest | Only if choosing `node:test` over Vitest `[ASSUMED]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | `node:test` + `tsx` | Fewer deps; more manual TS wiring and path aliases |
| `z.discriminatedUnion` | `z.union([...])` in order | Slower on large unions; risk of first-match ambiguity `[CITED: zod.dev/api]` |
| Shared Zod schemas | Hand-rolled parsers | Violates locked D-02; more bug surface |

**Installation (planner task):**

```bash
npm install zod@^4
npm install -D vitest@^4
```

**Version verification:** `npm view zod version` → `4.4.3`; `npm view vitest version` → `4.1.5` (2026-05-06) `[VERIFIED: npm registry]`.

## Architecture Patterns

### Recommended module layout

```
lib/pipeline/
├── types.ts              # PipelineEvent types, z.infer exports, constants (discriminator)
├── schemas.ts            # optional: pipelineEventSchema only, re-export types
├── ndjson.ts             # optional: parseNdjsonChunks(buffer, chunk) pure helper for tests + hook
hooks/
└── use-semantic-universe-stream.ts   # parse + validate + callbacks / FSM (name discretionary)
```

**When to merge vs split:** If `schemas.ts` stays under ~150 lines, a single `types.ts` is acceptable per CONTEXT discretion.

### Pattern 1: Discriminated union schema (`type` key)

**What:** Mirror TypeScript narrowing with Zod using the same discriminator the wire format already uses (`type`).  
**When to use:** All stream events share `type`; options are mutually exclusive shapes.

**Example:**

```typescript
// Source: https://zod.dev/api (Discriminated unions)
import * as z from "zod";

const pipelineEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("step"),
    id: z.enum(["sources", "synthesis", "images"]),
    status: z.enum(["running", "done", "error"]),
    detail: z.string().optional(),
  }),
  z.object({
    type: z.literal("done"),
    payload: z.unknown(), // tighten in plan: see Pitfalls / done payload
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);

export type PipelineEvent = z.infer<typeof pipelineEventSchema>;
```

`[CITED: zod.dev/api]`

### Pattern 2: NDJSON incremental parsing (test + hook share core)

**What:** Accumulate bytes, decode with `stream: true`, split on `\n`, keep tail in buffer until the next chunk; each **complete** line is `JSON.parse` then `pipelineEventSchema.parse`.  
**When to use:** Any streaming NDJSON consumer (browser `fetch` body or contract tests feeding arbitrary chunk boundaries).  
**Reference implementation:** `[VERIFIED: app/tool/page.tsx]` lines 1030–1043 (buffer + split + tail).

### Pattern 3: Fail-fast (CONTEXT D-01)

**What:** On invalid JSON **or** failed Zod parse, **stop** processing and propagate a user-legible error; do **not** `continue` on `SyntaxError`.  
**Anti-pattern to remove:** `catch (parseError) { if (parseError instanceof SyntaxError) continue; }` `[VERIFIED: app/tool/page.tsx]`.

### Anti-Patterns to Avoid

- **Dual sources of truth:** Defining TS types separately from Zod without `z.infer` — drift risk; prefer single schema→type.  
- **Stringly-typed dispatch before validation:** `JSON.parse` + cast + `event.type` checks without `safeParse` — violates D-02.  
- **Validating only some events:** Skipping validation on `done` to save time — violates D-02 unless the schema explicitly includes the full payload contract.  
- **Hook doing `fetch`:** Violates D-03; keeps cookies/paywall logic untestable in isolation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tagged union validation | `switch` on raw JSON | `z.discriminatedUnion("type", ...)` | Correct, efficient discrimination `[CITED: zod.dev/api]` |
| NDJSON framing | Regex line splitting | Buffer + `\n` + carried tail | Standard pattern; already in codebase |
| Test runner boilerplate | Custom harness | Vitest or `node:test` | Table-driven fixtures, watch mode, CI one-liner |

**Key insight:** The complexity is in **payload normalization**, not NDJSON framing; reuse established framing, invest design in `done.payload` validation strategy.

## Common Pitfalls

### Pitfall 1: `done.payload` strictness vs zero regression (SC4)

**What goes wrong:** A tight Zod schema for the full graph payload rejects real server output or changes field coercion vs `normalizePayload`, breaking graphs or emptying arrays.  
**Why it happens:** Server types in `route.ts` and client `normalizePayload` are permissive and repair partial model output `[VERIFIED: app/tool/page.tsx]`.  
**How to avoid:** Planner chooses one: (a) Zod schema `.transform` that **calls extracted** `normalizePayload` (moved to `lib/pipeline/normalize-payload.ts`), or (b) loose `unknown` + separate **output** schema on the **normalized** result only (still validates envelope + runs normalization).  
**Warning signs:** Contract tests pass on minimal fixtures but `/tool` fails on real OpenAI output.

### Pitfall 2: Stream ends with incomplete line

**What goes wrong:** Buffer non-empty when `reader.read()` returns `done: true`; silent ignore drops last event or hides corruption.  
**Why it happens:** Network truncation or server bug.  
**How to avoid:** Under D-01, treat non-empty tail after stream end as **fatal** (unless documented exception for trailing blank-only whitespace).  
**Warning signs:** Intermittent missing `done` event.

### Pitfall 3: Empty lines and whitespace

**What goes wrong:** Over-strict line handling fails on `\n\n` between events.  
**Why it happens:** NDJSON allows blank lines; client already skips `trim() === ""` `[VERIFIED: app/tool/page.tsx]`.  
**How to avoid:** Keep blank-line skip; fail only on **non-empty** invalid lines.

### Pitfall 4: Vitest + Next.js path aliases

**What goes wrong:** Tests `import '@/lib/...'` fail resolution.  
**Why it happens:** No `vitest.config.ts`/`resolve.alias` wired to `tsconfig` paths `[ASSUMED]` — typical fix pattern.  
**How to avoid:** Configure `vitest.config.ts` with `resolve.alias` matching `tsconfig` `"paths": { "@/*": ["./*"] }"` `[VERIFIED: tsconfig pattern from CLAUDE.md]`.

### Pitfall 5: Server-only imports in shared module

**What goes wrong:** Accidental import of `next/server` or Node-only APIs into a module imported by Vitest/browser.  
**Why it happens:** `lib/pipeline/` is shared.  
**How to avoid:** Keep Zod/schemas/pure parsers only in shared files; route imports schemas for typing `emitLine`.

## Code Examples

### Server: typing `emitLine` (minimal change surface)

```typescript
// Pattern only — planner places types import
function emitLine(controller: ReadableStreamDefaultController, event: PipelineEvent) {
  controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
}
```

Derived from `[VERIFIED: app/api/semantic-universe/route.ts]` `emitLine` currently taking `object`.

### Contract test outline (Vitest)

```typescript
import { describe, expect, it } from "vitest";
import { parseNdjsonEvents } from "@/lib/pipeline/ndjson"; // planner names

describe("pipeline NDJSON contract", () => {
  it("parses every event variant with chunked input", () => {
    const lines = [
      JSON.stringify({ type: "step", id: "sources", status: "running" }),
      JSON.stringify({ type: "done", payload: {/* minimal valid */} }),
    ];
    const raw = lines.join("\n") + "\n";
    const chunks = [raw.slice(0, 11), raw.slice(11)]; // arbitrary split
    const events = [...parseNdjsonEvents(chunks)];
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("step");
  });
});
```

Planner implements `parseNdjsonEvents` to match hook logic `[ASSUMED: test API shape]`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cast after `JSON.parse` | Parse → Zod → narrow | Phase 1 (planned) | Safer evolution for STREAM-02 |
| Silent `SyntaxError` skip | Fail-fast abort | Phase 1 (planned) | Corrupt streams surface as errors (locked) |
| Inline stream loop in page | Hook + page fetch | Phase 1 (planned) | Testability |

**Deprecated/outdated:**

- Swallowing `SyntaxError` in the NDJSON loop — explicitly superseded by D-01 `[VERIFIED: CONTEXT.md]`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Vitest resolves `@/*` with a small `vitest.config.ts` alias tweak | Pitfalls | Tests fail CI until config fixed |
| A2 | `node:test` + `tsx` remains viable second choice under D-04 | Standard Stack | Slightly slower team onboarding |

**If planner proves A1/A2 wrong:** Adjust config or runner choice — no architectural change.

## Open Questions

1. **`done.payload` validation depth for Phase 1**
   - What we know: Full strict graph schema mirrors large server types; client already normalizes `[VERIFIED: normalizePayload usage]`.
   - What's unclear: Whether product accepts “envelope validated + normalization function” as satisfying D-02 literally for inner payload fields.
   - Recommendation: Interpret D-02 as “no unvalidated event objects reach FSM”; implement validation at the boundary with explicit strategy documented in PLAN.md.

2. **Should the server optionally `schema.parse` before `emitLine`?**
   - What we know: CONTEXT mandates client validation; server validation is additive hardening.
   - What's unclear: Performance vs dual-parse cost on large `done` payloads.
   - Recommendation: Planner defaults to client-only validation; optional Wave 2 task for server assert in development.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next, Vitest, Zod | ✓ | Matches Next 16 (verify locally) `[ASSUMED]` | — |
| `npm` | install deps | ✓ | from `package-lock` `[VERIFIED: repo]` | — |
| Vitest | D-04 contract tests | ✗ not installed | — | Add devDependency `[VERIFIED: package.json]` |
| Zod | D-02 | ✗ not installed | — | Add dependency `[VERIFIED: package.json]` |

**Missing dependencies with no fallback:** `zod` (locked).  
**Missing dependencies with no fallback:** `vitest` **or** alternative agreed under D-04.

**Step 2.6 note:** Phase is code-heavy; external services (OpenAI/Tavily/Exa) are **not** required for contract tests if fixtures cover event shapes `[VERIFIED: success criterion 3 in ROADMAP]`.

## Validation Architecture

Concrete verification dimensions for VALIDATION.md / Nyquist workflow (`workflow.nyquist_validation`: true `[VERIFIED: .planning/config.json]`):

### Test Framework (Wave 0 — to be introduced)

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.5 `[VERIFIED: npm registry]` |
| Config file | `vitest.config.ts` (new) `[ASSUMED]` |
| Quick run command | `npx vitest run lib/pipeline` (or narrower glob once files exist) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|----------------|
| STREAM-01 | Every server-emitted variant (`step` all ids/statuses, `done`, `error`) round-trips parse+Zod | contract (pure) | `npx vitest run path/to/pipeline.contract` | ❌ Wave 0 |
| STREAM-01 | Discriminator exhaustion: unknown `type` fails fast | contract | same | ❌ |
| STREAM-02 | Chunk-splitting invariant: chunked vs single-string produce identical event array | contract | same | ❌ |
| STREAM-02 | Incomplete trailing buffer at EOF errors | contract | same | ❌ |
| SC4 (roadmap) | `/tool` happy path incremental steps + final graph identical (manual baseline) | manual UAT / smoke | guided checklist in VALIDATION.md | ✅ human |
| Regression | ESLint passes | static | `npm run lint` | ✅ `[VERIFIED: package.json]` |

### Sampling Rate

- **Per task commit:** `npm run lint` + targeted `vitest run` for touched pipeline tests.
- **Per wave merge:** `npx vitest run` green.
- **Phase gate:** Full Vitest slice green + `/tool` streaming UAT passes + no new ESLint errors.

### Wave 0 Gaps

- [ ] No `vitest` or test script in `package.json` today `[VERIFIED: package.json]`.
- [ ] No `vitest.config.ts` — add alias resolution for `@/*`.
- [ ] No pipeline contract files — create under `lib/pipeline/**/*.test.ts` (path discretionary).

**None — existing automated coverage:** Lint only; no unit tests `[VERIFIED: package.json]`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no (Phase 1) | Pre-existing middleware + route auth unchanged |
| V3 Session Management | no | — |
| V4 Access Control | no | 402/PAYWALL remains in fetch layer `[VERIFIED: app/tool/page.tsx]` |
| V5 Input Validation | yes | Zod validates stream events; rejects malformed/control data before UI/state updates `[CITED: zod.dev/api]` |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/stream-smuggling payloads | Tampering | Fail-fast parsing + schema rejection (D-01/D-02) |
| Oversized lines / memory exhaustion | Denial of Service | Planner adds **max line length** / max buffered bytes guard `[ASSUMED: not in codebase today — recommend in PLAN]` |

## Sources

### Primary (HIGH confidence)

- **[VERIFIED: codebase]** — `app/api/semantic-universe/route.ts` (`emitLine`, headers, emitted shapes); `app/tool/page.tsx` (`StreamEvent`, reader loop, `applyStepEvent`, `normalizePayload`).
- **[VERIFIED: npm registry]** — `npm view zod version`, `npm view vitest version` (2026-05-06).
- **[CITED: zod.dev/api]** — Discriminated unions (`z.discriminatedUnion`), Zod 4 stable note on zod.dev.
- **[VERIFIED: .planning/config.json]** — `nyquist_validation: true`.
- **[VERIFIED: CONTEXT/STATE]** — `.planning/phases/01-stream-contract-foundation-types/01-CONTEXT.md`, `.planning/STATE.md` for zod/fsm decisions.

### Secondary (MEDIUM confidence)

- TypeScript narrowing behavior for discriminated unions — aligns with TS handbook linked from Zod docs `[CITED: zod.dev/api]`.

### Tertiary (LOW confidence)

- Exact Vitest alias configuration snippet for this repo — verify during implementation `[ASSUMED]`.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — versions from npm + locked zod requirement.
- Architecture: **HIGH** — aligns with verified current stream implementation.
- Pitfalls: **MEDIUM** — `done.payload` depth is the dominant execution risk.

**Research date:** 2026-05-06  
**Valid until:** ~2026-06-06 (confirm Zod minor releases if upgrading past 4.4.x).

## RESEARCH COMPLETE
