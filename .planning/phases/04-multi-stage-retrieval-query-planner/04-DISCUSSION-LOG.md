# Phase 4: Multi-Stage Retrieval & Query Planner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 04-multi-stage-retrieval-query-planner
**Areas discussed:** Query plan shape, Stream visibility, Failure behavior, Source quality gates, Control limits

---

## Query Plan Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Structured query objects | Each sub-query has a user-facing label, search phrase, intent, provider hints, and success criteria; best for debugging and stream visibility. | ✓ |
| Plain sub-questions | Easier to inspect and explain, but planner/retriever has to translate them into search calls later. | |
| Search phrases only | Fastest to implement, but least transparent and easier to drift into shallow keyword fanout. | |

**User's choice:** Structured query objects.
**Notes:** Follow-up choices locked adaptive 5-12 objects per run, target around 8; competitive-universe coverage; and 1-2 bounded recency-sensitive query objects.

---

## Stream Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly plan summary | Show labels and intent, not raw search syntax; keeps user-facing stream readable. | ✓ |
| Full transparent plan | Show labels, intent, and exact search phrases; best for trust, but potentially noisy or awkward. | |
| Minimal progress copy | Show only planning/searching status and maybe query count; simplest UX, least educational. | |

**User's choice:** Friendly plan summary.
**Notes:** Follow-up choices locked preserving the plan in the trace panel, carrying full internal objects plus sanitized display fields in the event payload, and avoiding per-query progress streaming in favor of aggregate counts.

---

## Failure Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Continue with partial results | Isolate failed sub-query, log/count it, and keep the run moving. | ✓ |
| Retry once, then continue | Better recovery, but adds latency and moving parts. | |
| Fail only if critical query fails | Planner marks some query objects as required; failure of optional ones is okay. | |

**User's choice:** Continue with partial results.
**Notes:** Follow-up choices locked minimum viable evidence threshold; degraded run with visible reason when evidence is thin; failures recorded in telemetry plus concise stream detail.

---

## Source Quality Gates

| Option | Description | Selected |
|--------|-------------|----------|
| Thin/bot-block/noise filter | Filter sources with too little useful content, bot-block language, access-denied pages, obvious boilerplate, or missing URL/title. | ✓ |
| Strict credibility filter | Also down-rank or remove content farms, low-authority blogs, and untrusted domains; better quality, but harder to define fairly. | |
| Minimal filter | Only remove empty/malformed results; let scorer/synthesis handle quality. | |

**User's choice:** Thin/bot-block/noise filter.
**Notes:** Follow-up choices locked filter after merge/dedupe and before scoring; count filtered sources and sample safe reasons only; implement deterministic reason codes with tests.

---

## Control Limits

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative production caps | 5-12 query objects, max 8 provider searches per run per provider, 8s per provider request, 45s retrieval budget. | ✓ |
| Aggressive research caps | Allow more fanout and longer retrieval for richer graphs; higher latency/cost. | |
| Minimal caps only | Preserve existing route max duration and daily budget, defer detailed fanout caps to tuning. | |

**User's choice:** Conservative production caps.
**Notes:** Follow-up choices locked env-configurable limits with safe defaults and no adaptive expansion loop in Phase 4.

---

## the agent's Discretion

- Exact TypeScript names for planner modules and event fields.
- Exact minimum viable evidence threshold, provided it is deterministic and tested.
- Exact implementation of provider hints within hard caps.

## Deferred Ideas

- Adaptive rescue/expansion loop for thin evidence.
- Full provenance schema and evidence arrays.
- UI warning panel for degraded retrieval.
- New retrieval providers or domain credibility ranking.
