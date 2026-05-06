# Phase 2 Research — Observability, Security & Cost Controls

**Phase:** 2  
**Date:** 2026-05-06  
**Scope:** Langfuse tracing, Supabase run telemetry, daily caps, kill switch, geo-chat auth.

---

## Summary

| Topic | Recommendation |
|-------|------------------|
| LLM observability | `langfuse@^3` with **`observeOpenAI()`** wrapping an **`openai@^6`** `OpenAI` client — replaces raw `fetch("https://api.openai.com/...")` in `semantic-universe` and `geo-chat` so token counts and latency are captured without bespoke parsers |
| Durable query store | Supabase tables **`semantic_pipeline_runs`** (per-run facts + stage durations + counts + `result_type`) and **`user_daily_usage`** (UTC-date rollup for caps), RLS so users read only their rows |
| Correlation | First NDJSON line emits **`run_meta`** `{ type: "run_meta", run_id: "<uuid>" }` — extends shared zod union in `lib/pipeline/types.ts`; client hook ignores type for UI callbacks |
| Daily cap | Env **`SEMANTIC_DAILY_TOKEN_BUDGET`** (integer, sum of input+output tokens per UTC day); optional **`SEMANTIC_RETRIEVAL_UNIT_TOKEN_CHARGE`** applied once per semantic-universe run that performs Tavily+Exa pair; geo-chat charges tokens only |
| Kill switch | Env **`SEMANTIC_PIPELINE_DISABLED`** — when truthy, `semantic-universe` and `geo-chat` return **503** `{ code: "PIPELINE_DISABLED" }` before session-heavy work where practical |

---

## Validation Architecture

**Nyquist / executor feedback loop**

| Dimension | Approach |
|-----------|----------|
| Automated fast loop | `npm test` / `npx vitest run` — unit tests for cap math, `run_meta` schema parsing, kill-switch helpers |
| Integration | Manual: flip env vars locally; confirm 401/429/503 JSON shapes via `curl` with cookies |
| Langfuse | Manual spot-check in dashboard when keys present; CI sets `LANGFUSE_ENABLED=false` |

Verification sampling after each task (see `02-VALIDATION.md`): run Vitest subset touching changed `lib/` modules.

---

## Pitfalls

1. **Raw fetch bypasses Langfuse** — Both routes currently use REST fetch; migration to SDK + observer is required for OBS-01.
2. **RLS vs service role** — Prefer **`createClient()` (user JWT)** for inserts so `auth.uid()` policies apply; avoid accidental service-role bypass unless documenting rationale.
3. **Cap races** — Two concurrent POSTs may both pass pre-check; mitigate later with transactional increments; Phase 2 acceptable per CONTEXT ("deterministic documented proxy").
4. **Phase 1 contract** — New `run_meta` must be added to `pipelineEventSchema` and contract tests updated.

---

## RESEARCH COMPLETE
