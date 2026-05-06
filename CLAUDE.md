<!-- GSD:project-start source:PROJECT.md -->
## Project

**6-degrees**

**6-degrees** (`6degree.noemtech.com`) is a web app where signed-in users run a **semantic universe** analysis: the system gathers web sources (Tavily + Exa), synthesizes a structured **node–edge graph** with OpenAI, streams progress over **NDJSON**, and renders an interactive **network visualizer** behind auth, access control, and Stripe-backed subscription/demo rules. This planning cycle targets **stronger graph UX**, **more convincing model outputs**, and a **more sophisticated multi-stage web-research pipeline** on top of the existing Next.js stack.

**Core Value:** Users get a **trustworthy, explorable graph** of entities and relationships grounded in **fresh web evidence**, not a static summary — with clear provenance and an interface that makes the model’s reasoning legible.

### Constraints

- **Tech:** Stay on current stack (Next.js 16, React 19, Supabase, Stripe, server-side OpenAI/Tavily/Exa) unless research proves a narrowly scoped exception.
- **Ops:** Respect existing env-key model; no secrets in repo or planning docs.
- **Streaming:** Preserve or improve incremental UX (steps visible during long runs).
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript (see `typescript` in `package.json` devDependencies; `strict: true` in `tsconfig.json`) — all application code in `app/`, `components/`, `hooks/`, `lib/`, `middleware.ts`
- CSS — `app/globals.css` (Tailwind v4 `@import "tailwindcss"` and `tw-animate-css`); no separate CSS preprocessors beyond PostCSS
## Runtime
- Node.js — implied by Next.js 16 build and `npm` scripts (`next dev`, `next build`, `next start`)
- npm — `package-lock.json` present at repo root
- Lockfile: present (`package-lock.json`)
## Frameworks
- Next.js `16.1.6` — App Router (`app/`); Route Handlers under `app/api/**/route.ts`
- React `19.2.3` / `react-dom` `19.2.3`
- Not detected — no `jest`, `vitest`, `playwright`, or test scripts in `package.json`
- Next.js built-in bundler (Turbopack in dev per Next 16 defaults unless overridden)
- ESLint `^9` with `eslint-config-next` `16.1.6` — `eslint.config.mjs`
- PostCSS — `postcss.config.mjs` with `@tailwindcss/postcss`
- Tailwind CSS `^4` — `tailwindcss`, `@tailwindcss/postcss`; theme tokens in `app/globals.css` (`@theme inline`)
## Key Dependencies
- `@supabase/supabase-js` `^2.102.1` and `@supabase/ssr` `^0.10.0` — session cookies, server/browser clients (`lib/supabase/*`, `middleware.ts`, `app/auth/callback/route.ts`)
- `stripe` `^22.0.1` — subscriptions, Checkout, Billing Portal, webhooks (`lib/stripe.ts`, `app/api/stripe/*`)
- `next` — routing, `next/font/google` (Geist fonts in `app/layout.tsx`), middleware
- `@radix-ui/react-dialog`, `@radix-ui/react-label`, `@radix-ui/react-slot` — dialogs, labels, Slot composition
- `@base-ui/react` — additional headless primitives where used under `components/ui/`
- `motion` `^12.38.0` — animations
- `class-variance-authority`, `clsx`, `tailwind-merge` — variant and class composition
- Icon sets: `@carbon/icons-react`, `@hugeicons/react`, `lucide-react`
- `cobe` — 3D globe (`components/ui/cobe-globe-weather.tsx`)
- `embla-carousel-react`, `embla-carousel-auto-scroll` — carousels
- `vaul` — drawers
- `@number-flow/react` — animated numbers
- `resend` `^6.10.0` — transactional email from `app/api/waitlist/route.ts`
- Semantic tool and geo chat call OpenAI REST from `app/api/semantic-universe/route.ts` and `app/api/geo-chat/route.ts`; API keys from environment (see `INTEGRATIONS.md`).
## Configuration
- Documented template: `.env.example` (do not commit real secrets); lists Supabase public keys, service role, Stripe, Resend, site URL, and optional aliases
- Public vs server: `NEXT_PUBLIC_*` for Supabase URL/keys and site URL; server-only keys for Stripe secret, webhook secret, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, Resend (`app/api/waitlist/route.ts`, `lib/stripe.ts`, `lib/supabase/env.ts`)
- `next.config.ts` — minimal exported `NextConfig`
- `tsconfig.json` — path alias `@/*` → project root `"paths": { "@/*": ["./*"] }`
## Platform Requirements
- Node.js compatible with Next.js 16; run `npm install` then `npm run dev` (see `package.json` scripts)
- Next.js standalone hosting (`.env.example` references Vercel env configuration); canonical HTTPS origin required for auth and Stripe redirects (`NEXT_PUBLIC_SITE_URL`, `lib/site-url.ts`)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- **`app/` routes:** Segment folders use lowercase (e.g. `app/sign-in/page.tsx`). Page modules use PascalCase symbols and default-export the page (`Home`, `SignInPage`). See `app/page.tsx`, `app/sign-in/page.tsx`.
- **Shared UI primitives:** Kebab-case filenames with **named exports** (`Button`, `buttonVariants`): `components/ui/button.tsx`.
- **Feature / domain components:** Kebab-case under `components/auth/`, `components/tool/`: e.g. `components/auth/require-tool-auth.tsx`, `components/tool/tool-access-gate.tsx`.
- **`lib/` helpers:** Kebab-case or short domain names: `lib/utils.ts`, `lib/tool-access.ts`, `lib/site-url.ts`, `lib/supabase/server.ts`.
- `app/` — Next.js App Router routes and layouts.
- `components/ui/` — Reusable primitives (Radix/shadcn-style).
- `components/auth/`, `components/tool/` — Feature-grouped UI.
- `hooks/` — Client hooks (prefix `use-` in filenames).
- `lib/` — Server/client utilities and SDK wrappers (`lib/supabase/*`, `lib/stripe.ts`).
- **camelCase** for functions and helpers: `createClient()`, `cn()`, `isSubscriptionActive()`, `escapeHtml()`, `normalizeSupabaseProjectUrl()`.
- **`async`** route handlers exported as verbs matching HTTP semantics: `POST`, `GET` in `app/api/*/route.ts` (e.g. `export async function POST` in `app/api/waitlist/route.ts`).
- **camelCase** (`request`, `body`, `profileId`).
- Booleans reflect intent (`savedToDb`, `subscriptionActive`).
- Prefer **narrowing** unknown JSON with typeof/`in` checks before use (pattern in `app/api/waitlist/route.ts`).
- **`interface`** for extending HTML element props (`ButtonProps` in `components/ui/button.tsx`).
- **`type`** for utility types and Stripe/event shapes where used (`Stripe.Event` imports in `app/api/stripe/webhook/route.ts`).
- **`import type`** for type-only imports to avoid runtime imports (`Metadata` in `app/layout.tsx`, `ClassValue` from `clsx` in `lib/utils.ts`).
- **PascalCase** exported component names (`RequireToolAuth`, `Providers`, `Button`).
- **Client Components** start with `'use client';` when using hooks or browser APIs: `app/providers.tsx`, `components/auth/require-tool-auth.tsx`.
## Code Style
- **Not detected:** Dedicated Prettier (`prettier`/`.prettierrc`), Biome, or `.editorconfig` in the repo. Rely on **ESLint (flat config)** and editor defaults until a formatter is added.
- **Tool:** ESLint **9** with **eslint-config-next** bundles: **`eslint.config.mjs`** composes `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`:
## Import Organization
- **`@/*` → `./*`** (repo root)—defined in **`tsconfig.json`** `compilerOptions.paths`. Prefer `@/components/...`, `@/lib/...`, `@/app/...` over deep relative climbs.
- Prefer `import * as React from "react"` in primitives (`components/ui/button.tsx`); hooks may import named hooks (`useEffect`, `useState` from `react` in `components/auth/require-tool-auth.tsx`).
- **`import type`** for `ReactNode` and similar in client providers (`app/providers.tsx`).
## Error Handling
- **`NextResponse.json`** with appropriate **HTTP status** for client errors (`400`), upstream failures (`502`), and opaque failure messages where appropriate (`app/api/waitlist/route.ts`).
- **`try` / `catch`** on **`request.json()`**; `catch` without binding when the error detail is irrelevant (`catch { return NextResponse.json(..., { status: 400 }); }`).
- **Stripe webhook:** Validate signature secret and header; **`constructEvent`** in **try/catch**, return **`400`** on invalid signature (`app/api/stripe/webhook/route.ts`).
- Supabase/third-party failures: **`console.error` with bracketed prefix** for grepability (`[waitlist]`, `[stripe webhook]`).
- **Throw `Error`** with actionable setup messages when invariant config is missing: `assertSupabasePublicConfig()` in `lib/supabase/env.ts`.
- **`lib/supabase/server.ts`** catches in `setAll` when cookies cannot be mutated from a Server Component; comment documents that middleware refreshes the session:
## Logging
- **Prefix logs** with a short subsystem tag in brackets: `[waitlist]`, `[stripe webhook]` (`app/api/waitlist/route.ts`, `app/api/stripe/webhook/route.ts`).
- **`console.warn`** for degraded / optional configuration paths (missing env-driven features).
## Comments
- **Route files:** Top-of-file summary of endpoint contract (see `app/api/waitlist/route.ts`).
- **Non-obvious behavior:** Silent catches, URL normalization quirks (`lib/supabase/env.ts`).
- **Inline:** Sparingly; regex intent is sometimes self-explanatory.
- **Block comments** describe module-level behavior (`lib/supabase/env.ts`).
- Exported pure helpers accept short **line comments** where they clarify domain meaning (`lib/tool-access.ts` opener).
## Function Design
- Large route/feature files exist (e.g. `app/tool/page.tsx`, heavy API handlers like `app/api/semantic-universe/route.ts`). For **new** code, extract helpers into `lib/` or colocated functions in `route.ts` **before** exceeding ~150 lines per conceptual unit where practical.
- Request bodies parsed once; narrow **`unknown`** to shapes before fields are read (`app/api/waitlist/route.ts`).
- **`NextResponse`** for route handlers.
- **`null`** for “not found” lookups in Stripe webhook helpers (`findProfileIdByEmail` in `app/api/stripe/webhook/route.ts`).
- Booleans from small predicates (`isSubscriptionActive`, `canUseSemanticTool` in `lib/tool-access.ts`).
## Module Design
- **`export default`** for **Next.js** `layout.tsx`, `page.tsx`, and `next.config.ts` defaults (`app/layout.tsx`, `app/page.tsx`, `next.config.ts`).
- **Named exports** for reusable UI and utilities (`export { Button, buttonVariants }` from `components/ui/button.tsx`; `export function cn` from `lib/utils.ts`).
- **Not detected:** No root `components/index.ts` or similar re-export barrels; import concrete paths (`@/components/ui/button`).
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- File-system routing under `app/` with nested layouts (`app/layout.tsx`) and co-located Route Handlers (`app/api/**/route.ts`).
- Supabase Auth sessions carried in cookies via `@supabase/ssr`, with separate browser and server client factories.
- Heavy interactive UI (semantic graph tool) lives in client components; marketing pages can remain server components.
- Long-running analysis uses a **streaming NDJSON** response from `app/api/semantic-universe/route.ts` instead of a single JSON body.
## Layers
- Purpose: HTTP entry for HTML pages, metadata, and global shell (fonts, providers).
- Location: `app/`
- Contains: `layout.tsx`, `page.tsx` files, `globals.css`, auth callback Route Handler under `app/auth/callback/route.ts`
- Depends on: `@/app/providers`, `@/components/*`, Next.js `next/font`, `next/link`, `next/image`
- Used by: Browser navigations to `/`, `/sign-in`, `/tool`, `/policy`
- Purpose: Reusable React components — marketing UI, design primitives, tool-specific panels, auth gates.
- Location: `components/ui/`, `components/auth/`, `components/tool/`
- Contains: Buttons, dialogs, sign-in flow, `RequireToolAuth`, `ToolAccessGate`, graph and dashboard widgets
- Depends on: `@/lib/utils` (`cn`), Supabase browser client where needed, Motion for animation on the tool page
- Used by: `app/page.tsx`, `app/tool/page.tsx`, `app/sign-in/page.tsx`
- Purpose: JSON/stream endpoints for product features, billing, and lead capture.
- Location: `app/api/**/route.ts`
- Contains: Semantic analysis pipeline, tool access probe, Stripe checkout/portal/webhook, waitlist, geo chat helper
- Depends on: `@/lib/supabase/server`, `@/lib/supabase/admin`, `@/lib/stripe`, `@/lib/tool-access`, third-party HTTP APIs (OpenAI, Tavily, Exa, Resend)
- Used by: `fetch()` from client components (`credentials: "include"` where cookies matter)
- Purpose: Thin, reusable server/browser helpers — no heavy domain service layer; logic often lives in Route Handlers or large client pages.
- Location: `lib/`
- Contains: Supabase env normalization, Stripe lazy client, site URL helpers for OAuth redirects, subscription/demo rules
- Depends on: Environment variables (documented in `.env.example` — do not commit secrets)
- Used by: Middleware, Route Handlers, and client auth components
- Purpose: Refresh Supabase session on navigations; redirect unauthenticated users away from `/tool`.
- Location: `middleware.ts` delegating to `lib/supabase/middleware.ts`
- Contains: Cookie read/write bridging, `getUser()`, path-based redirect to `/sign-in?redirect=/tool`
- Depends on: `NEXT_PUBLIC_SUPABASE_*` keys via `getSupabasePublicConfig()` in `lib/supabase/env.ts`
## Data Flow
- Server: no global Redux — Supabase session in cookies; profile rows in Postgres (`profiles`, `waitlist`).
- Client: React `useState` / `useMemo` / `useContext` (`ToolAccessGate`) for tool UI; localStorage key `semantic_demo_used` in `app/tool/page.tsx` as a client-side fallback guard.
## Key Abstractions
- Purpose: Typed boundaries between browser SSR helper, server cookie-bound client, and privileged admin client.
- Examples: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/middleware.ts`
- Pattern: `createServerClient` / `createBrowserClient` from `@supabase/ssr` with shared `supabaseCookieOptions` from `lib/supabase/cookie-options.ts`
- Purpose: Single place to interpret Stripe status and one-time demo eligibility.
- Examples: `lib/tool-access.ts` (`isSubscriptionActive`, `canUseSemanticTool`)
- Pattern: Pure functions consumed by `app/api/tool/access/route.ts` and `app/api/semantic-universe/route.ts`
- Purpose: Avoid broken `redirectTo` when env lacks scheme or dev vs prod hosts differ.
- Examples: `lib/site-url.ts` (`normalizeSiteOrigin`, `getOAuthSiteOrigin`, `buildAuthCallbackUrl`)
- Pattern: Prefer `window.location.origin` in the browser; fall back to env or hardcoded production default inside `getOAuthSiteOrigin()`
- Purpose: Tailwind class composition without conflicts.
- Examples: `lib/utils.ts` (`cn` using `clsx` + `tailwind-merge`)
- Pattern: Import `cn` wherever conditional classes are needed (e.g. `app/tool/page.tsx`)
## Entry Points
- Location: `middleware.ts`
- Triggers: All matched paths except static assets (see `config.matcher`)
- Responsibilities: Session maintenance; hard gate on `/tool` for anonymous users
- Location: `app/layout.tsx`
- Triggers: Every document request
- Responsibilities: HTML shell, fonts (`Geist`, `Geist_Mono`), wraps children in `app/providers.tsx`
- Location: `app/providers.tsx`
- Triggers: Inclusion from root layout
- Responsibilities: Mount `components/auth/supabase-auth-refresh.tsx` app-wide
- Location: `app/page.tsx`
- Triggers: `GET /`
- Responsibilities: Static marketing sections; links to `/sign-in?redirect=/tool`
- Location: `app/tool/page.tsx`
- Triggers: `GET /tool` (after middleware + client auth)
- Responsibilities: Semantic graph UI, streaming analysis client, paywall UX, evidence and discourse panels
- Location: `app/sign-in/page.tsx` → `components/ui/sign-in-flo.tsx`
- Triggers: `GET /sign-in`
- Responsibilities: Auth UI and redirect parameter handling
- Location: `app/auth/callback/route.ts`
- Triggers: OAuth provider redirect
- Responsibilities: `exchangeCodeForSession`, safe `next` path validation, error redirects to `/sign-in`
## Error Handling
- JSON errors: `NextResponse.json({ error: "..." }, { status: 4xx|5xx })` in Route Handlers (`app/api/tool/access/route.ts`, `app/api/semantic-universe/route.ts`, etc.)
- Paywall: **402** with `{ code: "PAYWALL" }` from semantic route; client opens `ToolPaywall` in `app/tool/page.tsx`
- Stream parse resilience: Client in `app/tool/page.tsx` skips malformed lines (`SyntaxError`), rethrows other errors
- Stripe webhook: **400** on bad signature; warn and short-circuit if service role key missing
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
