# Phase 2: Observability, Security & Cost Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.  
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06  
**Phase:** 2 — Observability, Security & Cost Controls  
**Areas discussed:** Topic selection (all areas), Telemetry, Daily cap, Kill switch, Auth hardening

---

## Topic selection

| Option | Description | Selected |
|--------|-------------|----------|
| Telemetry | Langfuse vs Supabase vs both | ✓ |
| Daily spend cap | Definition, storage, error UX | ✓ |
| Kill switch | Env flag, long-run / 10+ min criterion | ✓ |
| Auth | geo-chat + paid routes in phase | ✓ |
| All of the above | Walk through each in order | ✓ |

**User's choice:** All of the above — walk through each in order.  
**Notes:** Resolved each area with roadmap + research defaults captured in CONTEXT.md (dual telemetry, UTC daily cap with 429, env kill switch, geo-chat 401/401+session pattern).

---

## Telemetry (Langfuse vs durable log)

| Option | Description | Selected |
|--------|-------------|----------|
| Langfuse only | Traces in dashboard; no first-class SQL store | |
| Supabase only | Rows in Postgres; no Langfuse | |
| Both | Langfuse for LLM spans + Supabase per-run query table | ✓ |

**User's choice:** Both (aligned with `.planning/research/SUMMARY.md` and roadmap SC1 “log store or Langfuse”).  
**Notes:** `run_id` must correlate stream, DB, and Langfuse.

---

## Daily spend cap

| Option | Description | Selected |
|--------|-------------|----------|
| Soft cap | Log only | |
| Hard cap — 402 | Same as paywall | |
| Hard cap — 429 + code | Distinct from PAYWALL | ✓ |

**User's choice:** Hard enforcement with **429** and structured **`DAILY_CAP`** (or equivalent), not `402`.  
**Notes:** UTC day; Supabase persistence; env-driven defaults; apply on semantic-universe and geo-chat after auth.

---

## Kill switch & long runs

| Option | Description | Selected |
|--------|-------------|----------|
| Deploy-only | No runtime toggle | |
| Env kill switch | Flip in host env; reject new requests | ✓ |
| DB flag only | Requires read on every request | |

**User's choice:** **Environment-variable** kill switch for new requests; complement with **route max duration** and best-effort abort (planner detail).  
**Notes:** Satisfies SC4 together with blocking new work.

---

## Auth hardening

| Option | Description | Selected |
|--------|-------------|----------|
| geo-chat only | Add session check to this route | ✓ |
| Full API sweep | Every route in `app/api` | |
| geo-chat + new routes | — | |

**User's choice:** **`/api/geo-chat`** must match tool auth posture (**401** without session); **`semantic-universe`** already gated — verify unchanged. Public routes (e.g. waitlist) explicitly out of scope.

---

## Claude's Discretion

- Langfuse naming, span granularity, optional custom events for non-LLM stages.
- Supabase schema and migration; retrieval “unit” weights in daily budget.
- Abort/timeouts and exact env var names (must be documented in `.env.example`).

## Deferred Ideas

- Admin UI for limits; per-tier cap by Stripe product; API-key auth for external callers.
