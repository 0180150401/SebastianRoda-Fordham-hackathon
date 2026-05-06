# External Integrations

**Analysis Date:** 2026-05-06

## APIs & External Services

**Search & research (semantic universe pipeline):**
- **Tavily** — web search for brand/source snippets  
  - Client: `fetch` to `https://api.tavily.com/search` in `app/api/semantic-universe/route.ts`  
  - Auth: `TAVILY_API_KEY` or legacy alias `TAVILY_API` (cleaned in code)

- **Exa** — neural search for additional snippets  
  - Client: `fetch` to `https://api.exa.ai/search` in `app/api/semantic-universe/route.ts`  
  - Auth: `EXA_API_KEY` header `x-api-key`

**LLM:**
- **OpenAI** — JSON graph synthesis and geo advisor chat  
  - Client: `fetch` to `https://api.openai.com/v1/chat/completions` in `app/api/semantic-universe/route.ts` and `app/api/geo-chat/route.ts`  
  - Auth: `OPENAI_API_KEY` or `OPENAI_API` (Bearer token)  
  - Model: `gpt-4.1-mini` in both routes

**Payments:**
- **Stripe** — subscriptions, customer portal, webhooks  
  - SDK: `stripe` package; lazy init in `lib/stripe.ts` (`getStripe()`), API version `2026-03-25.dahlia`  
  - Auth: `STRIPE_SECRET_KEY`  
  - Price IDs: `STRIPE_PRICE_SOLO_MONTHLY` / `YEARLY`, `STRIPE_PRICE_TEAMS_MONTHLY` / `YEARLY` with optional legacy fallbacks (`STRIPE_PRICE_PLUS_*`, `STRIPE_PRICE_ADVANCED_*`) in `lib/stripe.ts`  
  - Checkout: `app/api/stripe/checkout/route.ts`  
  - Billing portal: `app/api/stripe/portal/route.ts`  
  - Webhook verification: `STRIPE_WEBHOOK_SECRET` in `app/api/stripe/webhook/route.ts`

**Email:**
- **Resend** — waitlist notification emails  
  - SDK: `Resend` from `resend` in `app/api/waitlist/route.ts`  
  - Auth: `RESEND_API_KEY`; `RESEND_FROM`, `CONTACT_TO_EMAIL` for addressing

**Arbitrary HTTP (image enrichment):**
- **Origin pages** — server-side `fetch` to evidence URLs to resolve `og:image` / `<img>` for visual correlation enrichment in `app/api/semantic-universe/route.ts` (`resolveSourceImages`); user-influenced URLs from search results

## Data Storage

**Databases:**
- **Supabase (PostgreSQL)** — hosted project; accessed only through Supabase clients  
  - Public/browser and cookie sessions: `NEXT_PUBLIC_SUPABASE_URL` + anon or publishable key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) — `lib/supabase/env.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`  
  - Admin (bypass RLS): `SUPABASE_SERVICE_ROLE_KEY` — `lib/supabase/admin.ts`  
  - Tables referenced in code: `profiles` (Stripe fields, `free_demo_used_at`, `email`), `waitlist` (`app/api/waitlist/route.ts`, webhook email lookup in `app/api/stripe/webhook/route.ts`)

**File Storage:**
- Local / static assets only under `public/` (e.g. favicon references in `app/layout.tsx`); no cloud blob SDK in `package.json`

**Caching:**
- None as a dedicated service; Next.js and `Cache-Control` on streaming response in `app/api/semantic-universe/route.ts` (`no-cache` for NDJSON stream)

## Authentication & Identity

**Auth Provider:**
- **Supabase Auth** — email/OAuth; session in HTTP-only cookies via `@supabase/ssr`  
  - Middleware refresh and `/tool` gate: `lib/supabase/middleware.ts`, root `middleware.ts`  
  - OAuth PKCE exchange: `app/auth/callback/route.ts`  
  - Google OAuth setup described in `.env.example` (Google Cloud redirect to `https://<project-ref>.supabase.co/auth/v1/callback`)

## Monitoring & Observability

**Error Tracking:**
- Not detected — no Sentry/Datadog packages in `package.json`

**Logs:**
- `console.error` / `console.warn` in API routes and webhook (`app/api/stripe/webhook/route.ts`, `app/api/waitlist/route.ts`, `app/api/semantic-universe/route.ts`, `app/api/tool/access/route.ts`)

## CI/CD & Deployment

**Hosting:**
- Vercel implied by `.env.example` production notes; no `vercel.json` in repo

**CI Pipeline:**
- Not detected — no `.github/workflows` in repository

## Environment Configuration

**Required env vars (by feature):**
- Supabase (app + auth): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key variants per `lib/supabase/env.ts`)
- Supabase admin paths: `SUPABASE_SERVICE_ROLE_KEY` for waitlist insert, webhook profile updates, optional admin profile demo flag in `app/api/semantic-universe/route.ts`
- Stripe billing: `STRIPE_SECRET_KEY`, price env vars per plan, `STRIPE_WEBHOOK_SECRET` for webhook route
- Semantic universe: `OPENAI_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`
- Geo chat: `OPENAI_API_KEY`
- Waitlist email: `RESEND_API_KEY` (optional degraded path without send)
- Site URLs: `NEXT_PUBLIC_SITE_URL` (and optional `AUTH_URL`) for redirects — `lib/site-url.ts`, Stripe success/cancel URLs

**Secrets location:**
- Local: `.env` (not documented here; never commit); production: host env UI (e.g. Vercel) per `.env.example`

## Webhooks & Callbacks

**Incoming:**
- `POST` `app/api/stripe/webhook/route.ts` — Stripe signed events (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`)
- `GET` `app/auth/callback/route.ts` — Supabase OAuth `code` exchange

**Outgoing:**
- None registered as webhook subscriptions from this app beyond client-initiated API calls above

---

*Integration audit: 2026-05-06*
