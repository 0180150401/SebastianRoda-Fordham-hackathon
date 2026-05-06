# Pitfalls Research

**Domain:** LLM-synthesized knowledge graphs + web research automation (semantic universe product)
**Researched:** 2026-05-06
**Confidence:** HIGH (cross-referenced: production post-mortems, official docs, codebase audit)

---

## Critical Pitfalls

### Pitfall 1: Hallucinated Edges Accepted as Ground Truth

**What goes wrong:**
The LLM generates plausible-sounding but factually incorrect edges — relationships between nodes that do not exist in the source evidence. Because the output is structured JSON that passes schema validation, hallucinated edges enter the graph silently and are rendered as legitimate connections. Users see a confident, authoritative-looking graph that contains invented relationships.

**Why it happens:**
OpenAI models interpolate between training data and retrieved context. When retrieved sources are thin, contradictory, or ambiguous, the model fills gaps with plausible co-occurrences rather than refusing to draw an edge. No ground-truth check exists downstream to catch the difference. The current pipeline (`route.ts`) passes synthesis output directly to the stream with no edge-provenance validation step.

**How to avoid:**
- Require each edge to carry a `source_ids[]` array referencing the Tavily/Exa results that justify the relationship.
- Implement a post-synthesis validation pass: any edge whose `source_ids` is empty or whose sources do not contain both node entities should be flagged `confidence: low` or dropped.
- Add prompt constraints: "Only draw an edge if both entities co-appear in at least one source passage. If no evidence exists, omit the edge."
- Surface confidence scores in the UI (edge opacity or color) so users can visually audit thin relationships.

**Warning signs:**
- Graphs consistently include "famous" entity pairings regardless of query topic.
- Edges appear between entities that appear in different unrelated source documents.
- Removing a source from the prompt doesn't change the graph.
- `source_ids` arrays are absent or always point to the same few documents.

**Phase to address:**
Graph synthesis quality / retrieval-grounded synthesis phase. Must precede any public graph-sharing or provenance-display work.

---

### Pitfall 2: Silent Scraping Degradation

**What goes wrong:**
Tavily/Exa queries return HTTP 200s and structurally valid results, but the actual content has silently drifted — paywalls intercept content and return teaser text, A/B-tested layouts return different fields, or personalized responses serve bot-detected sessions junk content. The pipeline processes garbage as if it were signal. Graph quality degrades invisibly over days or weeks with no error in logs.

**Why it happens:**
The current pipeline trusts retrieved text at face value. There is no quality gate between fetch and synthesis — content length, keyword presence, or semantic coherence are not checked before the text is passed to OpenAI. Web sources are adaptive systems in 2026 (anti-bot evolution is documented as an ongoing arms race). "Succeeds operationally while returning wrong data" is now the dominant scraping failure mode.

**How to avoid:**
- Add a content-quality gate: reject any source whose retrieved text is below a minimum token threshold (e.g., < 150 tokens after HTML strip), or whose text contains signals of bot-blocking ("access denied", "subscribe to read", "enable JavaScript").
- Log source quality metrics per run (avg content length, sources rejected vs. used) — surface in the NDJSON stream so operators can detect drift.
- For critical runs, cross-validate entities found by Tavily against Exa; flag nodes that appear in only one source as `single_source`.
- Periodically spot-check source text on staging with known queries to catch silent regressions.

**Warning signs:**
- Average source text length trending down over weeks.
- Graphs becoming more generic (same top entities regardless of query).
- Source rejection rate near zero — every URL accepted, even implausible domains.
- User reports of "wrong results" with no corresponding error in logs.

**Phase to address:**
Web research pipeline hardening phase. Source quality scoring should be built before retrieval-stage expansion (adding more sources amplifies bad signal proportionally).

---

### Pitfall 3: Latency / Cost Explosion from Unguarded Retry and Fan-out

**What goes wrong:**
A retry loop or fan-out in the research pipeline — parallel Tavily + Exa calls, OpenAI retries on rate limit, image enrichment across 10 URLs — composes into an unbounded cost event. Documented production case: a retry bug generated 2.3M unintended API calls and an undetected $47,812 invoice in nine hours. Traditional APM showed green (individual calls returned 200 OK).

**Why it happens:**
The current route runs Tavily + Exa + OpenAI synthesis + up to 10 HTML image fetches in a single request with no per-run spend cap. The unauthenticated `/api/geo-chat` endpoint (already flagged in CONCERNS.md) is a separate unguarded cost vector — any caller can drive unlimited OpenAI spend. Retry logic without exponential backoff + jitter + a retry budget ceiling can fan out exponentially.

**How to avoid:**
- Add a per-run cost budget: estimate token count before OpenAI call; abort if estimated cost exceeds a configurable threshold.
- Implement per-user daily spend caps tracked in Supabase; check before each pipeline invocation.
- Require authentication on `/api/geo-chat` (Supabase `getUser()` check already present in `semantic-universe` — use the same pattern).
- Cap image enrichment concurrency at 3–4 parallel requests with a global timeout; make it a feature-flag-gated optional stage.
- Retry budgets: max 2 retries on any single external call, with jitter; never retry in a `while(true)` without a counter check.

**Warning signs:**
- OpenAI invoice spikes not correlated to user activity.
- P99 latency on `/api/semantic-universe` growing while P50 stays flat (a few runaway requests dominating).
- `/api/geo-chat` traffic in logs not correlated to authenticated sessions.
- `resolveSourceImages` timeout log lines accumulating.

**Phase to address:**
Rate limiting / abuse protection phase. Must be shipped before any traffic increase (public launch, marketing push).

---

### Pitfall 4: Observability Gap — Dashboards Green While Quality Burns

**What goes wrong:**
Classic monitoring (uptime, HTTP error rate, CPU) reports healthy while the LLM pipeline is silently: returning hallucinated graphs (200 OK, wrong content), tripling cost from prompt bloat, or hanging for 30+ seconds on specific query patterns. Teams discover the issue through user complaints or a surprise invoice, not through metrics.

**Why it happens:**
LLM failure modes don't map to classical APM signals. A hallucinated graph is a 200 OK with a valid JSON body. A cost explosion is a sequence of 200s. A quality regression after a prompt change produces no error. There are currently no automated tests for the NDJSON stream contract, no per-run cost logging, and no quality metrics tracked in the current codebase (CONCERNS.md confirms zero test files).

**How to avoid:**
Five-pillar instrumentation from day one (based on 2026 production recommendations):
1. **Latency decomposition** — log time for each stage: source fetch, synthesis, enrichment, total. Store in Supabase per run.
2. **Token + cost accounting** — log `prompt_tokens`, `completion_tokens`, estimated USD per run per user.
3. **Input/output logging** — store query + graph node/edge counts per run for quality trend analysis (no PII in sources).
4. **Quality proxy metrics** — track edge count, avg confidence, source_ids coverage rate.
5. **Kill switches** — per-user daily cap, global API spend alert webhook (Stripe-style), circuit-breaker on external API failures.

**Warning signs:**
- No structured logs per pipeline run beyond generic `console.log`.
- No way to answer: "What is the average graph size for query X?" without scraping logs.
- Cost visible only on the OpenAI/Tavily invoice, not in-app.
- Response time for `/api/semantic-universe` reported as a single number, not decomposed.

**Phase to address:**
Observability / instrumentation phase. Should be one of the first new phases — all subsequent quality improvement phases rely on being able to measure before/after.

---

### Pitfall 5: Streaming Contract Break Between Server and Client

**What goes wrong:**
The server emits NDJSON (`\n`-delimited JSON lines) and the client parses them in a `while(true)` reader loop. Any change to the server-side `emitLine` format — adding a new event type, renaming a field, changing the line terminator, or emitting a partial flush — silently breaks the client. The client either: hangs indefinitely on malformed lines, throws a silent parse error and shows an empty graph, or displays stale state from a previous event type it no longer recognizes.

**Why it happens:**
The server and client NDJSON contract is implicit — there is no shared type, schema, or contract test. The stream reader is a `while(true)` loop with an `eslint-disable` (already flagged in CONCERNS.md as fragile). Partial lines on chunk boundaries are a known failure mode with no buffer management. Mid-stream errors (rate limit hits after stream has started) are not distinguished from end-of-stream.

**How to avoid:**
- Define the stream contract as a shared TypeScript discriminated union (`type StreamEvent = { type: 'progress', ... } | { type: 'graph', ... } | { type: 'error', ... }`).
- Place the type in a shared module (`lib/semantic-universe/stream-events.ts`) imported by both the route and the page component.
- Extract the NDJSON reader to a tested utility function (`lib/semantic-universe/stream-reader.ts`) with explicit buffer management for partial lines.
- Add contract tests: a test that invokes a mock ReadableStream with known lines and asserts the client receives the expected events.
- Emit an explicit `{ type: 'done' }` terminal event; treat any parse error mid-stream as an error event with a recoverable UI state (not silent failure).

**Warning signs:**
- Client shows partial graphs or hangs after "successful" runs with no error shown.
- Adding a new server-side event type requires grep-and-replace in `page.tsx`.
- Stream format documented only in comments or commit messages, not in types.
- `eslint-disable` comments near the parsing loop (already present).

**Phase to address:**
Stream contract hardening / refactor phase. Should accompany any pipeline expansion that adds new stream event types.

---

### Pitfall 6: Thin Graph Fallback Masking Real Failures

**What goes wrong:**
The pipeline has a `buildFallback` path that returns a minimal graph when synthesis fails. This is correct as a resilience mechanism, but if the fallback path fires silently — on API timeout, malformed OpenAI response, insufficient sources — the user sees a thin-looking graph and attributes it to their query rather than an infrastructure failure. Operators never see an error rate spike because the fallback returns HTTP 200.

**Why it happens:**
Fallback paths are designed to be invisible to the user, but they obscure real failure rates from operators. Without instrumentation distinguishing "real synthesis" from "fallback result", it's impossible to know what percentage of graphs are actually meaningful versus degraded placeholder output. CONCERNS.md confirms the NDJSON stream contract and fallback logic are untested.

**How to avoid:**
- Tag every stream response with a `result_type: 'synthesized' | 'fallback'` field.
- Log fallback invocations with the triggering reason (timeout, parse error, source count below threshold) in structured server logs.
- Surface fallback state to users with a visible indicator ("Limited results — try a more specific query") rather than presenting fallback output as full synthesis.
- Add a dashboard metric: fallback rate over rolling 24h. Alert if fallback rate exceeds 10%.

**Warning signs:**
- Fallback rate metric doesn't exist or is always zero (instrument before trusting it).
- User feedback mentions "empty graph" or "generic results" with no corresponding error logs.
- `buildFallback` is called from multiple catch blocks with no structured logging in each.

**Phase to address:**
Graph synthesis quality phase; pairs with observability instrumentation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| All pipeline logic in one 1600-line route | Fast iteration, no imports | Untestable stages, single point of all failure modes, large serverless cold-start | Never for a growing pipeline |
| No shared stream event types | No upfront type design | Any schema change silently breaks client; no contract tests possible | MVP only, must be addressed before pipeline expansion |
| Image enrichment in the hot path | Single request produces visual graph | 10 HTML fetches block stream completion, adds 1–3s to P99 | Acceptable if feature-flagged and async |
| Skipping cost accounting until "it matters" | Faster initial build | Retroactive cost attribution costs quarters; surprise invoices | Never in a monetized product |
| Unauthenticated auxiliary LLM endpoints | Easier dev testing | Direct abuse vector for API quota exhaustion | Never in production |
| Non-null assertions on Stripe env vars (`!`) | Cleaner code appearance | Silent undefined price IDs cause checkout failures in misconfigured deploys | Never — validate at startup |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAI structured output | Requesting large JSON schemas without max_tokens constraint — model outputs are truncated mid-JSON, causing parse failures | Set `max_tokens` explicitly; use streaming JSON parse or validate completeness before emitting to client |
| Tavily search | Trusting result `content` field length as a quality proxy — short snippets are normal for Tavily but insufficient for graph synthesis | Use Tavily's `search_depth: 'advanced'` and filter by `content` token count; combine with Exa for full-text |
| Exa | Using `autoprompt` without query normalization — entity names with special characters produce inconsistent result counts | Normalize and canonicalize entity names before Exa queries; log result counts per source to detect misses |
| NDJSON streaming (Next.js Route Handler) | Using Edge Runtime with `async iteration` on Readable streams — breaks silently in production | Explicitly set `export const runtime = 'nodejs'`; use `ReadableStream` Web API; never rely on Node.js stream methods in Edge context |
| Supabase service role | Importing `createAdminClient` in any context that could be client-side bundled — bypasses RLS | Server-only imports enforced by file naming or explicit `'use server'` directive; audit all new routes |
| Stripe env vars | Relying on `!` non-null assertions — missing key yields `undefined` price ID passed to Stripe API | Validate all required price env vars at module init or startup; throw with descriptive message listing missing key |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential source fetch (Tavily then Exa, not parallel) | 4–6s source fetch time; P99 total latency >15s | Run Tavily and Exa in `Promise.all()`; both are independent | Any load >10 concurrent users |
| 10 image enrichment fetches in hot path | Streams appear stuck after synthesis completes | Move image enrichment to a separate async stage or feature-flag it; cap concurrency to 3 with timeout | Immediately on any slow source network |
| Full `universe` JSON in geo-chat system message | Token count grows proportionally to graph size; cost/response scales with graph complexity | Summarize or truncate universe server-side to top-N nodes before chat synthesis | Graph sizes >50 nodes |
| No per-user rate limit on `/api/semantic-universe` | Traffic spike or accidental loop exhausts all API keys simultaneously | Implement per-user request-per-minute and daily run limits checked against Supabase before invoking pipeline | Public launch or any automated client |
| No result caching for identical queries | Repeated identical queries re-run full pipeline (same cost, same latency) | Cache synthesis output in Supabase by `hash(query + sources)` with TTL | High-volume demo/trial usage; marketing events |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Unauthenticated `/api/geo-chat` endpoint | Any actor can drive unlimited OpenAI spend; no attribution, no rate limit | Add Supabase `getUser()` session check; return 401 for unauthenticated callers |
| SSRF via image enrichment (`resolveSourceImages`) | Server fetches arbitrary URLs from search results; attacker-controlled source could point at internal IPs | Block private/reserved IP ranges (127.x, 10.x, 192.168.x, 169.254.x) using an allowlist or SSRF-safe fetch helper |
| OpenAI error body forwarded to client (geo-chat) | Leaks upstream error details, API version, and internal prompt structure | Log full error server-side; return generic `{ error: 'Analysis failed' }` to client |
| Admin client (`createAdminClient`) imported in webhook without early-return guard | Missing service role key causes silent Stripe webhook processing with no profile update | Validate env at module level; treat missing key as a hard startup error or return explicit 500 with Sentry alert |
| PII in console.warn (waitlist route) | Email addresses logged to stdout in misconfigured environments | Log only event type, not the email value; use structured logging |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No streaming progress granularity — large silent gaps | User sees spinner for 10–15s with no updates during source fetch phase | Emit progress events at each pipeline stage start: `{ type: 'progress', stage: 'fetching_sources', message: 'Searching 2 sources...' }` |
| Fallback graph presented identically to full synthesis result | User trusts thin/generic graph as high-quality output | Tag fallback results visually ("Limited data available") and surface how many sources were actually usable |
| Low-confidence edges rendered with same weight as high-confidence edges | User cannot distinguish invented relationships from well-sourced ones | Map edge confidence to visual weight (opacity, line width, color saturation); show source count on hover |
| No provenance surface — users can't see where a node or edge came from | Trust gap; power users immediately ask "how do you know this?" | Each node and edge should display source URLs and snippet on click/hover |
| Error states during streaming silently terminate without user feedback | User sees partial graph with no indication of what happened | Emit `{ type: 'error', recoverable: boolean, message: string }` terminal event; display actionable error message |
| Graph renders all at once after full synthesis | Long wait with no visual progress; users abandon before completion | Emit partial graph events (`type: 'partial_graph'`) as nodes are synthesized; progressively render |

---

## "Looks Done But Isn't" Checklist

- [ ] **Graph synthesis:** Appears to show relationships — verify every edge has `source_ids` referencing at least one document that mentions both entities
- [ ] **Streaming works:** Demo completes — verify mid-stream error handling: what happens if OpenAI returns 429 after 5s of streaming?
- [ ] **Cost controls:** No errors in normal runs — verify what happens with a deliberately broad query (e.g., "Apple") that generates max source results + max image fetches
- [ ] **Fallback path:** Graph renders — verify that `buildFallback` is distinguishable from a real synthesis result in logs and UI
- [ ] **Rate limiting:** API works in testing — verify a single user can't exhaust daily API quota in one session through rapid repeat submissions
- [ ] **Auth on aux endpoints:** `/api/geo-chat` returns data — verify unauthenticated request is rejected (currently it is not)
- [ ] **Stream contract:** Client parses correctly — verify behavior when server emits a new event type the client doesn't recognize (should degrade gracefully, not hang)
- [ ] **Source quality gate:** Pipeline runs — verify what a run looks like when all Tavily/Exa results are bot-blocked (paywalled snippets)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hallucinated edges in production graph data | MEDIUM | Add `confidence` field retroactively; re-run synthesis with grounded prompt on cached source data; add UI disclaimer while rollout |
| Cost explosion from runaway retry | HIGH | Kill API keys immediately; audit logs for affected user sessions; restore from daily token budget once loop identified and fixed; communicate to affected users |
| Streaming contract break after deployment | MEDIUM | Roll back route to last working version; client is stateless (reload recovers); extract contract types before next deploy |
| Silent scraping degradation (weeks of bad data) | HIGH | No rollback possible for past graphs; add quality gate going forward; consider a "regenerate" button for users; audit logs for date of onset |
| SSRF via image enrichment | HIGH | Disable `resolveSourceImages` immediately via feature flag; patch IP allowlist; audit for any requests to internal ranges in logs |
| Unauthenticated geo-chat abuse | MEDIUM | Rotate OpenAI key; add auth check; monitor for continued abuse post-patch |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Hallucinated edges accepted as ground truth | Graph synthesis quality — grounded synthesis with source attribution | Every graph in test suite has all edges traceable to source doc containing both entities |
| Silent scraping degradation | Web research pipeline hardening — content quality gate | Quality gate rejects known bot-blocked URLs in integration test; source stats logged per run |
| Latency / cost explosion | Rate limiting + cost controls phase | Load test shows per-user cap fires before API quota is hit; `/api/geo-chat` returns 401 for unauthenticated caller |
| Observability gap | Instrumentation / observability phase (early — precedes pipeline expansion) | Dashboard shows per-run token cost, latency breakdown, and fallback rate; all sourced from structured logs |
| Streaming contract break | Stream refactor + contract test phase | Shared `StreamEvent` discriminated union exists; stream reader unit tests pass; new event type addition doesn't require client grep |
| Thin fallback masking failures | Graph synthesis quality + observability | `result_type` field present in all responses; fallback rate metric exists in dashboard; fallback never presented as full synthesis |

---

## Sources

- Production post-mortem: $47,812 undetected cost explosion — https://tianpan.co/blog/2026-04-10-batch-llm-pipeline-blind-spot (MEDIUM confidence — reported case study, credible domain)
- LLM observability gaps survey — https://inference.net/content/llm-observability-monitoring-production-deployments/ (MEDIUM confidence)
- Cost attribution failure patterns — https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026 (MEDIUM confidence)
- Web scraping brittleness 2026 — https://www.promptcloud.com/blog/web-scraping-challenges-and-solutions-2026/ (MEDIUM confidence)
- NDJSON / streaming contract pitfalls — https://claudelab.net/en/articles/api-sdk/claude-api-streaming-pitfalls (MEDIUM confidence)
- Next.js Edge vs Node runtime streaming — https://www.eaures.online/streaming-llm-responses-in-next-js (MEDIUM confidence)
- KG hallucination research — ACL Anthology 2025 systematic review (HIGH confidence — peer-reviewed)
- Codebase audit (CONCERNS.md, 2026-05-06) — HIGH confidence, direct code inspection

---
*Pitfalls research for: LLM-synthesized knowledge graphs + web research automation (6-degrees / semantic universe)*
*Researched: 2026-05-06*
