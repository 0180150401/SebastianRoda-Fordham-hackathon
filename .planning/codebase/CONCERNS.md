# Codebase Concerns

**Analysis Date:** 2026-05-06

## Tech Debt

**Monolithic tool page:**
- Issue: The interactive semantic tool UI, streaming client logic, types, and canvas behavior live in a single client file (~1700+ lines), making changes risky and hard to review.
- Files: `app/tool/page.tsx`
- Impact: Higher regression risk, difficult refactors, duplicated type definitions versus `app/api/semantic-universe/route.ts`.
- Fix approach: Extract hooks (e.g. stream reader, paywall state), subcomponents, and shared types into `components/tool/` or `lib/semantic-universe/`; align types with a single shared module.

**Monolithic API route:**
- Issue: `app/api/semantic-universe/route.ts` bundles env parsing, Tavily/Exa/OpenAI calls, HTML fetching for images, graph building, normalization, and streaming NDJSON in one module (~1600+ lines).
- Files: `app/api/semantic-universe/route.ts`
- Impact: Hard to test in isolation, large serverless bundle, single place for many failure modes.
- Fix approach: Split into `lib/semantic-universe/` modules (sources, synthesis, enrichment, stream) and keep `route.ts` as a thin orchestrator.

**Deprecated Stripe export pattern:**
- Issue: `stripe` is a Proxy marked deprecated; callers may still use `import { stripe }` and hit lazy init errors only at runtime.
- Files: `lib/stripe.ts`
- Impact: Confusing API surface; build-time vs runtime env validation inconsistency.
- Fix approach: Migrate all imports to `getStripe()` and remove the Proxy once usages are updated.

**Fragile Stripe price configuration:**
- Issue: `PRICE_IDS` uses `process.env.STRIPE_PRICE_*!` non-null assertions; missing envs yield `undefined` price IDs at runtime.
- Files: `lib/stripe.ts`, `app/api/stripe/checkout/route.ts`
- Impact: Checkout failures or Stripe API errors in production if a variable is omitted.
- Fix approach: Validate required price env vars at startup or in `checkout` with explicit 500 responses listing which key is missing.

## Known Bugs

**Webhook profile updates skipped when service role missing:**
- Symptoms: Stripe returns `received: true` but `profiles` are never updated when `SUPABASE_SERVICE_ROLE_KEY` is unset.
- Files: `app/api/stripe/webhook/route.ts`
- Trigger: Deploy without service role key; customer completes checkout.
- Workaround: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in production; monitor webhook logs.

**Middleware auth bypass when Supabase is unconfigured:**
- Symptoms: `updateSession` returns `NextResponse.next()` without redirect when `getSupabasePublicConfig()` is null, so `/tool` may not redirect to sign-in if public env vars are missing.
- Files: `lib/supabase/middleware.ts`, `lib/supabase/env.ts`
- Trigger: Missing `NEXT_PUBLIC_SUPABASE_URL` or browser key in the deployment environment.
- Workaround: Always set public Supabase vars; consider failing closed (redirect to an error page) for `/tool` when config is absent.

Demo usage race (edge case):
- Symptoms: If a user abandons a run before the stream finishes, `markFreeDemoUsed` may not run while the client still shows paywall logic inconsistently vs server.
- Files: `app/api/semantic-universe/route.ts` (`markFreeDemoUsed` after successful pipeline), `app/tool/page.tsx` (localStorage/cookie fallbacks)
- Workaround: Rely on cookie `semantic_demo_used` and `free_demo_used_at`; document expected ordering.

## Security Considerations

**Unauthenticated OpenAI proxy (`/api/geo-chat`):**
- Risk: Any caller can POST with arbitrary `brand`, `universe`, and `messages`, consuming `OPENAI_API_KEY` quota and increasing cost/abuse surface.
- Files: `app/api/geo-chat/route.ts`
- Current mitigation: Input trimming and structure limits (`normalizeMessages` slice, content length); no auth.
- Recommendations: Require the same session checks as `semantic-universe` (Supabase `getUser()`), or add API key, rate limiting, or Edge middleware IP/throttle.

**Error responses may leak upstream details:**
- Risk: `geo-chat` returns OpenAI error body text to the client on failure.
- Files: `app/api/geo-chat/route.ts`
- Current mitigation: Generic status codes only partially hide internals.
- Recommendations: Log server-side; return a generic message to clients in production.

**PII in logs (waitlist):**
- Risk: When `RESEND_API_KEY` is unset, email is logged via `console.warn` with the destination address context.
- Files: `app/api/waitlist/route.ts`
- Current mitigation: Only in misconfigured environments.
- Recommendations: Log only that delivery was skipped, not the email value.

**Server-side fetch to arbitrary URLs (image enrichment):**
- Risk: `resolveSourceImages` fetches URLs derived from search results; a malicious or compromised source could point at internal IPs (SSRF class risk) though URLs are normalized to http(s) only.
- Files: `app/api/semantic-universe/route.ts` (`resolveSourceImages`, `enrichVisualCorrelationsWithImages`)
- Current mitigation: 3.5s timeout, http(s) only, skips example.com.
- Recommendations: Block private/reserved IP ranges where feasible (e.g. via allowlist or SSRF-safe fetch helper).

**Service role usage:**
- Risk: Admin client bypasses RLS; incorrect use could expose or corrupt all rows.
- Files: `lib/supabase/admin.ts`, `app/api/waitlist/route.ts`, `app/api/stripe/webhook/route.ts`, `app/api/semantic-universe/route.ts` (`markFreeDemoUsed`)
- Current mitigation: Server-only routes; `createAdminClient` throws if env missing (except webhook early-return path).
- Recommendations: Never import `createAdminClient` in client components; audit new routes.

## Performance Bottlenecks

**Heavy sequential and parallel external I/O in one request:**
- Problem: Semantic analysis runs Tavily + Exa, then OpenAI synthesis, then up to 10 HTML fetches for images.
- Files: `app/api/semantic-universe/route.ts`
- Cause: Cold starts plus multiple network round-trips per analysis.
- Improvement path: Cache Tavily/Exa per brand window, reduce image fetch concurrency, or move image enrichment behind a feature flag.

**Large JSON in chat completion (`geo-chat`):**
- Problem: Full `universe` object is `JSON.stringify`’d into a system message.
- Files: `app/api/geo-chat/route.ts`
- Cause: Token growth as graph data grows.
- Improvement path: Summarize or truncate universe server-side before sending to the model.

## Fragile Areas

**Demo / paywall enforcement across cookie, localStorage, and DB:**
- Files: `app/api/tool/access/route.ts`, `app/api/semantic-universe/route.ts`, `app/tool/page.tsx`, `lib/tool-access.ts`
- Why fragile: Three layers (`semantic_demo_used` cookie, `DEMO_STORAGE_KEY` in `localStorage`, `free_demo_used_at` in `profiles`) can drift if one write fails.
- Safe modification: Change access rules in `canUseSemanticTool` / `hasDemoCookie` together with client handling in `app/tool/page.tsx`.
- Test coverage: No automated tests for these paths.

**Stream parsing loop in the browser:**
- Files: `app/tool/page.tsx` (NDJSON reader with `eslint-disable` for `while (true)`)
- Why fragile: Partial lines, parse errors, and stream errors must stay in sync with server `emitLine` format.
- Safe modification: Extract to a tested utility; add contract tests for NDJSON events.

## Scaling Limits

**Third-party API quotas:**
- Current capacity: Bounded by OpenAI, Tavily, Exa, and Stripe rate limits per deployment.
- Limit: Traffic spikes exhaust keys or incur cost spikes before app-level throttling exists.
- Scaling path: Per-user rate limits, queueing, or caching of source results.

**No CI pipeline in repo:**
- Current capacity: No `.github/workflows` detected; quality gates depend on local `npm run lint` / `npm run build`.
- Limit: Regressions merge undetected.
- Scaling path: Add CI running lint and `next build`.

## Dependencies at Risk

**Stripe API version pinned in code:**
- Risk: `apiVersion = "2026-03-25.dahlia"` in `lib/stripe.ts` may require updates when Stripe deprecates versions.
- Impact: Future API incompatibility or forced upgrades.
- Migration plan: Follow Stripe changelog; test webhook and checkout after bumps.

**Next.js 16 / React 19 stack:**
- Risk: Fast-moving majors can introduce subtle SSR/client bugs in auth and streaming.
- Impact: Auth cookie races (already documented in middleware comments) need re-validation on upgrades.
- Migration plan: Use Next upgrade guides and test `/auth/callback` and `/tool` flows.

## Missing Critical Features

**Automated tests:**
- Problem: No `*.test.*` or `*.spec.*` files detected; `package.json` has no `test` script.
- Blocks: Safe refactoring of paywall, webhooks, and streaming.

**Rate limiting / abuse protection:**
- Problem: No application-level rate limits on expensive routes.
- Blocks: Sustainable public launch under attack or accidental loops.

## Test Coverage Gaps

**Payment webhook logic:**
- What's not tested: Signature verification branches, profile linking by email vs customer ID, subscription status updates.
- Files: `app/api/stripe/webhook/route.ts`
- Risk: Silent data mismatch between Stripe and Supabase profiles.
- Priority: High

**Semantic universe pipeline:**
- What's not tested: `buildFallback`, normalization, NDJSON stream contract.
- Files: `app/api/semantic-universe/route.ts`
- Risk: Silent degradation to fallback payload on parse errors.
- Priority: Medium

**Access API and middleware:**
- What's not tested: `GET /api/tool/access` responses, redirect behavior when Supabase env is missing.
- Files: `app/api/tool/access/route.ts`, `lib/supabase/middleware.ts`
- Risk: Users see wrong paywall state or bypass redirects in misconfiguration.
- Priority: Medium

---

*Concerns audit: 2026-05-06*
