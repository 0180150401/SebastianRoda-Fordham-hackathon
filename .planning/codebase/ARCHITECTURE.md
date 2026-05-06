# Architecture

**Analysis Date:** 2026-05-06

## Pattern Overview

**Overall:** Next.js App Router monolith — server-first rendering with selectively marked client islands, Route Handlers for HTTP APIs, and Edge-capable middleware for session refresh and route protection.

**Key Characteristics:**
- File-system routing under `app/` with nested layouts (`app/layout.tsx`) and co-located Route Handlers (`app/api/**/route.ts`).
- Supabase Auth sessions carried in cookies via `@supabase/ssr`, with separate browser and server client factories.
- Heavy interactive UI (semantic graph tool) lives in client components; marketing pages can remain server components.
- Long-running analysis uses a **streaming NDJSON** response from `app/api/semantic-universe/route.ts` instead of a single JSON body.

## Layers

**Presentation (routes & layout):**
- Purpose: HTTP entry for HTML pages, metadata, and global shell (fonts, providers).
- Location: `app/`
- Contains: `layout.tsx`, `page.tsx` files, `globals.css`, auth callback Route Handler under `app/auth/callback/route.ts`
- Depends on: `@/app/providers`, `@/components/*`, Next.js `next/font`, `next/link`, `next/image`
- Used by: Browser navigations to `/`, `/sign-in`, `/tool`, `/policy`

**Presentation (shared UI):**
- Purpose: Reusable React components — marketing UI, design primitives, tool-specific panels, auth gates.
- Location: `components/ui/`, `components/auth/`, `components/tool/`
- Contains: Buttons, dialogs, sign-in flow, `RequireToolAuth`, `ToolAccessGate`, graph and dashboard widgets
- Depends on: `@/lib/utils` (`cn`), Supabase browser client where needed, Motion for animation on the tool page
- Used by: `app/page.tsx`, `app/tool/page.tsx`, `app/sign-in/page.tsx`

**API (Route Handlers):**
- Purpose: JSON/stream endpoints for product features, billing, and lead capture.
- Location: `app/api/**/route.ts`
- Contains: Semantic analysis pipeline, tool access probe, Stripe checkout/portal/webhook, waitlist, geo chat helper
- Depends on: `@/lib/supabase/server`, `@/lib/supabase/admin`, `@/lib/stripe`, `@/lib/tool-access`, third-party HTTP APIs (OpenAI, Tavily, Exa, Resend)
- Used by: `fetch()` from client components (`credentials: "include"` where cookies matter)

**Domain & integration library:**
- Purpose: Thin, reusable server/browser helpers — no heavy domain service layer; logic often lives in Route Handlers or large client pages.
- Location: `lib/`
- Contains: Supabase env normalization, Stripe lazy client, site URL helpers for OAuth redirects, subscription/demo rules
- Depends on: Environment variables (documented in `.env.example` — do not commit secrets)
- Used by: Middleware, Route Handlers, and client auth components

**Cross-cutting middleware:**
- Purpose: Refresh Supabase session on navigations; redirect unauthenticated users away from `/tool`.
- Location: `middleware.ts` delegating to `lib/supabase/middleware.ts`
- Contains: Cookie read/write bridging, `getUser()`, path-based redirect to `/sign-in?redirect=/tool`
- Depends on: `NEXT_PUBLIC_SUPABASE_*` keys via `getSupabasePublicConfig()` in `lib/supabase/env.ts`

## Data Flow

**OAuth / email sign-in (PKCE):**

1. User initiates auth in `components/ui/sign-in-flo.tsx` (client), using `buildAuthCallbackUrl()` from `lib/site.ts` for `redirectTo`.
2. Supabase redirects to `app/auth/callback/route.ts` with `code` and optional `next` path.
3. Route Handler exchanges the code via `createServerClient` (`@supabase/ssr`), writing session cookies on the redirect response (`NextResponse.redirect`).
4. `middleware.ts` runs on subsequent requests; `updateSession()` in `lib/supabase/middleware.ts` refreshes the session and may set cookies on `NextResponse.next()`.
5. `components/auth/supabase-auth-refresh.tsx` listens for `TOKEN_REFRESHED` / `SIGNED_IN` / `SIGNED_OUT` and calls `router.refresh()` to keep RSC payloads aligned with the browser session.

**Protected tool page (`/tool`):**

1. Middleware: if path starts with `/tool` and `getUser()` returns no user, redirect to `/sign-in` with `redirect` query — `lib/supabase/middleware.ts`.
2. Client gate: `RequireToolAuth` in `components/auth/require-tool-auth.tsx` double-checks session via browser Supabase client; redirects if missing.
3. Access context: `ToolAccessGate` in `components/tool/tool-access-gate.tsx` GETs `app/api/tool/access/route.ts`, which loads `profiles.free_demo_used_at` and `profiles.stripe_status` and derives `subscriptionActive` / `hasFreeDemoRemaining` (also honors `semantic_demo_used` cookie for demo enforcement).
4. Analysis: `app/tool/page.tsx` POSTs to `app/api/semantic-universe/route.ts` with `credentials: "include"`. Handler returns **401** if no user, **402** if paywalled, or a **newline-delimited JSON** stream of `step`, `done`, and `error` events. On first completed demo run, handler sets HttpOnly `semantic_demo_used` and updates `profiles.free_demo_used_at` when possible.

**Semantic universe pipeline (server stream):**

1. `POST` in `app/api/semantic-universe/route.ts` validates user, profile, and required env vars (`OPENAI_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`).
2. Stream `start`: parallel Tavily + Exa fetches → deduped `SourceItem[]`.
3. OpenAI Chat Completions synthesize graph payload (`synthesizeWithOpenAI`); on failure, `buildFallback` produces a deterministic substitute.
4. `enrichVisualCorrelationsWithImages` fetches source pages and extracts OG/Twitter images (see `resolveSourceImages` helpers in the same file).
5. Terminal `done` event carries enriched payload; client in `app/tool/page.tsx` parses NDJSON, updates React state, and drives `AgentPlan` step UI.

**Stripe subscription state:**

1. Checkout: `app/api/stripe/checkout/route.ts` (pattern: uses `getStripe()` / metadata — not fully expanded in mapper pass; webhook is source of truth for status).
2. Webhook: `app/api/stripe/webhook/route.ts` verifies signature, maps Stripe customer/email to `profiles`, updates `stripe_*` columns via `createAdminClient()` in `lib/supabase/admin.ts`.

**Waitlist:**

1. `POST` `app/api/waitlist/route.ts` inserts into Supabase `waitlist` with service role when configured, sends notification email via Resend.

**State Management:**
- Server: no global Redux — Supabase session in cookies; profile rows in Postgres (`profiles`, `waitlist`).
- Client: React `useState` / `useMemo` / `useContext` (`ToolAccessGate`) for tool UI; localStorage key `semantic_demo_used` in `app/tool/page.tsx` as a client-side fallback guard.

## Key Abstractions

**Supabase clients:**
- Purpose: Typed boundaries between browser SSR helper, server cookie-bound client, and privileged admin client.
- Examples: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/middleware.ts`
- Pattern: `createServerClient` / `createBrowserClient` from `@supabase/ssr` with shared `supabaseCookieOptions` from `lib/supabase/cookie-options.ts`

**Access rules:**
- Purpose: Single place to interpret Stripe status and one-time demo eligibility.
- Examples: `lib/tool-access.ts` (`isSubscriptionActive`, `canUseSemanticTool`)
- Pattern: Pure functions consumed by `app/api/tool/access/route.ts` and `app/api/semantic-universe/route.ts`

**Site origin for OAuth:**
- Purpose: Avoid broken `redirectTo` when env lacks scheme or dev vs prod hosts differ.
- Examples: `lib/site-url.ts` (`normalizeSiteOrigin`, `getOAuthSiteOrigin`, `buildAuthCallbackUrl`)
- Pattern: Prefer `window.location.origin` in the browser; fall back to env or hardcoded production default inside `getOAuthSiteOrigin()`

**UI class merging:**
- Purpose: Tailwind class composition without conflicts.
- Examples: `lib/utils.ts` (`cn` using `clsx` + `tailwind-merge`)
- Pattern: Import `cn` wherever conditional classes are needed (e.g. `app/tool/page.tsx`)

## Entry Points

**Next.js request pipeline:**
- Location: `middleware.ts`
- Triggers: All matched paths except static assets (see `config.matcher`)
- Responsibilities: Session maintenance; hard gate on `/tool` for anonymous users

**Root layout:**
- Location: `app/layout.tsx`
- Triggers: Every document request
- Responsibilities: HTML shell, fonts (`Geist`, `Geist_Mono`), wraps children in `app/providers.tsx`

**Global client providers:**
- Location: `app/providers.tsx`
- Triggers: Inclusion from root layout
- Responsibilities: Mount `components/auth/supabase-auth-refresh.tsx` app-wide

**Public marketing home:**
- Location: `app/page.tsx`
- Triggers: `GET /`
- Responsibilities: Static marketing sections; links to `/sign-in?redirect=/tool`

**Interactive product tool:**
- Location: `app/tool/page.tsx`
- Triggers: `GET /tool` (after middleware + client auth)
- Responsibilities: Semantic graph UI, streaming analysis client, paywall UX, evidence and discourse panels

**Sign-in surface:**
- Location: `app/sign-in/page.tsx` → `components/ui/sign-in-flo.tsx`
- Triggers: `GET /sign-in`
- Responsibilities: Auth UI and redirect parameter handling

**Auth callback:**
- Location: `app/auth/callback/route.ts`
- Triggers: OAuth provider redirect
- Responsibilities: `exchangeCodeForSession`, safe `next` path validation, error redirects to `/sign-in`

## Error Handling

**Strategy:** HTTP status codes for API failures; streaming errors as a final NDJSON `error` object before closing the stream; `console.error` in handlers for server-side diagnostics.

**Patterns:**
- JSON errors: `NextResponse.json({ error: "..." }, { status: 4xx|5xx })` in Route Handlers (`app/api/tool/access/route.ts`, `app/api/semantic-universe/route.ts`, etc.)
- Paywall: **402** with `{ code: "PAYWALL" }` from semantic route; client opens `ToolPaywall` in `app/tool/page.tsx`
- Stream parse resilience: Client in `app/tool/page.tsx` skips malformed lines (`SyntaxError`), rethrows other errors
- Stripe webhook: **400** on bad signature; warn and short-circuit if service role key missing

## Cross-Cutting Concerns

**Logging:** `console.error` / `console.warn` in Route Handlers (e.g. `[semantic-universe]`, `[stripe webhook]`, `[waitlist]`) — no centralized logger abstraction.

**Validation:** Ad-hoc validation in each route (JSON shape checks, email regex in waitlist, brand string trim, NDJSON event parsing on the client).

**Authentication:** Supabase Auth (cookies); middleware + `RequireToolAuth` redundancy for `/tool`; `getUser()` in API routes for server-side authorization.

---

*Architecture analysis: 2026-05-06*
