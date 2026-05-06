# Phase 2: Observability, Security & Cost Controls - Context

**Gathered:** 2026-05-06  
**Status:** Ready for planning

<domain>
## Phase Boundary

Every semantic (and related) run is **measured**, **bounded**, and **secured** before pipeline complexity grows: Langfuse + durable per-run records for querying latency and cost proxies; per-user daily spend/budget enforcement with a clear rejection path; **`/api/geo-chat`** aligned with the same authenticated posture as **`/api/semantic-universe`**; operational **kill switch** so long-running or anomalous spend can be stopped without code deploy logic changes.

**Scope does not include** pipeline modularization (Phase 3), retrieval planner (Phase 4), or graph UI upgrades (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Telemetry and queryability (OBS-01, roadmap SC1)
- **D-01:** Use **both** (a) **Langfuse** for LLM-centric traces — `observeOpenAI()` (or equivalent documented wrapper) on OpenAI client usage so token/latency/metadata are visible in the Langfuse UI — and (b) a **Supabase-backed per-run log** (table or tables) so developers can SQL/query **per-run latency by stage**, **token or cost-proxy fields**, **node/edge/source counts**, and **`result_type`** without relying solely on Langfuse. Roadmap success criterion is satisfied if either store is queryable; **dual-write is the locked product intent** for redundancy and SQL access.
- **D-02:** Correlate server logs and Langfuse traces with a **`run_id`** (UUID) emitted in the stream metadata (or first event) and stored on the Supabase row — planner chooses exact event shape; **ID must be consistent** across Langfuse trace, DB row, and stream for support debugging.

### Per-user daily spend cap (OBS-02, roadmap SC2)
- **D-03:** Enforce a **per-user daily budget** in **`semantic-universe`** at **POST entry**, after auth and before any paid upstream calls (Tavily, Exa, OpenAI). **`/api/geo-chat`** must apply the **same cap check** after auth (so anonymous callers never consume paid quota).
- **D-04:** Budget accounting uses a **single UTC calendar day** window for “daily.” **Persist cumulative usage** in Supabase (dedicated table or columns on `profiles` — planner chooses). **Default cap** comes from **environment variables** (documented in `.env.example`); no admin UI in this phase.
- **D-05:** The “spend” proxy for the cap is **primarily OpenAI-reported token usage** summed per day, with **optional fixed “units”** charged per Tavily/Exa call for coarse retrieval cost — exact weights are **Claude’s discretion** as long as the cap is deterministic and documented.
- **D-06:** When the cap is exceeded, return **HTTP 429** with a **stable machine-readable `code` (e.g. `DAILY_CAP`)** and a **short human-readable `error` message** — **not** `402 PAYWALL` (that remains subscription/demo gating only).

### Kill switch and long-run protection (OBS-02, roadmap SC4)
- **D-07:** Provide an **environment-variable kill switch** (e.g. `SEMANTIC_PIPELINE_DISABLED` or equivalent name) that causes **`/api/semantic-universe`** to reject **new** requests immediately with **503** (or **503**-class) and a **clear JSON body** indicating maintenance / disabled pipeline. **`geo-chat`** should honor the **same flag** if it performs paid OpenAI work. Document the variable in `.env.example`; ops flips it in the host (e.g. Vercel) without redeploying logic.
- **D-08:** **In-flight** runs may not stop instantly; success criterion “stoppable before financial damage” is met by **blocking new work** via D-07 plus **platform/route max duration** and **best-effort abort** of downstream requests where feasible — **implementation detail** left to planner (Claude’s discretion on AbortController wiring).

### Auth hardening for paid routes (OBS-03, roadmap SC3)
- **D-09:** **`/api/geo-chat`** must return **401** for requests **without a valid Supabase session** — mirror the **`createClient` + `getUser()`** pattern used at the start of **`/api/semantic-universe`** (same cookie-based session semantics).
- **D-10:** **In-scope audit for this phase:** only **`geo-chat`** and confirmation that **`semantic-universe`** remains gated. **`/api/waitlist`** and other intentionally public endpoints are **out of scope**. No new auth model (e.g. API keys for third parties) in this phase.

### Claude's Discretion
- Langfuse project naming, span naming, and which non-OpenAI stages get custom Langfuse events vs DB-only stage timings.
- Exact Supabase schema (`semantic_runs` vs `usage_daily` + FK), migration shape, and indexes for dashboards.
- Numeric cap defaults and retrieval “unit” weights; rate-limit headers on 429 (optional).
- How/whether to expose `run_id` to the `/tool` client (console-only vs stream event) as long as server-side correlation works.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and requirements
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria (SC1–SC4), dependencies on Phase 1
- `.planning/REQUIREMENTS.md` — OBS-01, OBS-02, OBS-03 acceptance language
- `.planning/STATE.md` — Approved dependency `langfuse@^3`, stack notes
- `.planning/phases/01-stream-contract-foundation-types/01-CONTEXT.md` — Phase 1 stream contract; telemetry must not break typed NDJSON

### Research (stack and observability)
- `.planning/research/STACK.md` — Langfuse `observeOpenAI()`, env keys, CI guard patterns
- `.planning/research/SUMMARY.md` — Phase 2 delivery sketch (Langfuse + per-run logging, rate limits, geo-chat auth)

### Implementation touchpoints
- `app/api/semantic-universe/route.ts` — Existing `getUser`, paywall (`402` / `PAYWALL`), streaming NDJSON
- `app/api/geo-chat/route.ts` — Today unauthenticated; must gain session check
- `lib/supabase/server.ts` — Server client for session resolution in route handlers
- `lib/tool-access.ts` — Subscription/demo rules (orthogonal to daily cap; both apply where relevant)

No standalone external spec — requirements live in the files above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`createClient`** from `@/lib/supabase/server` — Session resolution in route handlers (same as semantic route).
- **`PipelineEvent` / stream** — `run_id` can extend metadata on existing events or a dedicated envelope; must stay zod-valid per Phase 1.

### Established Patterns
- **Paywall:** `402` + `{ code: "PAYWALL" }` — preserve for subscription/demo; separate from **429 `DAILY_CAP`**.
- **Bracketed logging:** e.g. `[semantic-universe]` — extend for observability errors without new logging framework in this phase unless planner chooses one.

### Integration Points
- **Semantic route POST** — Early guards (kill switch, cap, auth order), mid-pipeline stage timings, final Supabase insert + Langfuse flush behavior.
- **Geo-chat POST** — Auth first, then cap, then OpenAI.

</code_context>

<specifics>
## Specific Ideas

User chose to discuss **all** Phase 2 gray areas in one pass; defaults above align with `.planning/research/SUMMARY.md` (Langfuse + Supabase logging, per-user limits, geo-chat auth) and roadmap success criteria.

</specifics>

<deferred>
## Deferred Ideas

- **Admin UI** for caps, usage dashboards for end users, or tiered limits by Stripe plan — future; this phase uses env + DB accumulation only.
- **Third-party API keys** or service accounts for programmatic access — not in OBS-03 scope.
- **Full audit** of every `app/api` route beyond the two OpenAI consumers — defer unless a new paid route appears.

</deferred>

---

*Phase: 02-observability-security-cost-controls*  
*Context gathered: 2026-05-06*
