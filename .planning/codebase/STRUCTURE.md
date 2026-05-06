# Codebase Structure

**Analysis Date:** 2026-05-06

## Directory Layout

High-signal application tree (omit `node_modules/`, build caches, lockfile internals):

```
SebastianRoda-Fordham-hackathon/
├── app/                      # Next.js App Router: pages, layouts, API routes
│   ├── api/                  # Route Handlers (HTTP)
│   │   ├── geo-chat/
│   │   ├── semantic-universe/
│   │   ├── stripe/           # checkout, portal, webhook
│   │   ├── tool/
│   │   └── waitlist/
│   ├── auth/
│   ├── policy/
│   ├── sign-in/
│   ├── tool/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── components/               # React components (auth, tool, UI primitives)
│   ├── auth/
│   ├── tool/
│   └── ui/
├── hooks/                    # Shared React hooks
├── lib/                      # Server/browser utilities, SDK wrappers
│   └── supabase/
├── public/                   # Static assets (images, SVGs)
├── .planning/                # GSD / planning artifacts (this folder)
├── middleware.ts             # Next middleware entry → Supabase session
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Directory Purposes

**`app/`:**
- Purpose: All routable UI and backend HTTP endpoints in the App Router convention.
- Contains: `page.tsx`, `layout.tsx`, nested `route.ts` files under `app/api/` and `app/auth/callback/`.
- Key files: `app/layout.tsx`, `app/page.tsx`, `app/tool/page.tsx`, `app/providers.tsx`, `app/globals.css`

**`app/api/`:**
- Purpose: REST-style Route Handlers; return `NextResponse` or `Response` (streams).
- Contains: Semantic analysis, access checks, Stripe integration, waitlist, optional geo chat.
- Key files: `app/api/semantic-universe/route.ts`, `app/api/tool/access/route.ts`, `app/api/stripe/webhook/route.ts`, `app/api/waitlist/route.ts`, `app/api/geo-chat/route.ts`

**`components/ui/`:**
- Purpose: Presentation primitives and marketing/interaction widgets (buttons, modals, carousel, sign-in shell, agent plan UI).
- Contains: Radix/Base UI–style building blocks and bespoke visuals (`cobe-globe-weather`, `text-scramble`, etc.).
- Key files: `components/ui/sign-in-flo.tsx`, `components/ui/agent-plan.tsx`, `components/ui/button.tsx`

**`components/auth/`:**
- Purpose: Session bootstrap and route protection for authenticated experiences.
- Key files: `components/auth/require-tool-auth.tsx`, `components/auth/supabase-auth-refresh.tsx`, `components/auth/oauth-icons.tsx`

**`components/tool/`:**
- Purpose: Feature-specific UI for the semantic analysis product (paywall, account menu, access gate, hints).
- Key files: `components/tool/tool-access-gate.tsx`, `components/tool/tool-paywall.tsx`, `components/tool/account-menu.tsx`

**`hooks/`:**
- Purpose: Reusable client hooks decoupled from any single page.
- Example: `hooks/use-media-query.ts`

**`lib/supabase/`:**
- Purpose: Supabase configuration, cookie policy, and three client construction patterns (browser, server, admin, middleware helper).
- Key files: `lib/supabase/env.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/middleware.ts`, `lib/supabase/cookie-options.ts`

**`lib/` (root of library):**
- Purpose: Cross-cutting helpers not tied to a single feature folder.
- Key files: `lib/utils.ts`, `lib/stripe.ts`, `lib/site-url.ts`, `lib/tool-access.ts`

**`public/`:**
- Purpose: Static files served at URL root (favicons, logos, illustrations).
- Contains: Brand images such as `public/noem-logo.png`, SVG assets referenced by default Next template.

## Key File Locations

**Entry Points:**
- `middleware.ts`: Runs before most routes; delegates to `lib/supabase/middleware.ts`.
- `app/layout.tsx`: Document root, fonts, `Providers`.
- `app/page.tsx`: Marketing landing page (`GET /`).
- `app/tool/page.tsx`: Main authenticated product UI (`GET /tool`).

**Configuration:**
- `next.config.ts`: Next.js config (currently minimal).
- `tsconfig.json`: TypeScript; path alias `@/*` → repository root.
- `package.json`: Scripts (`dev`, `build`, `start`, `lint`) and dependencies.
- `.env.example`: Documented environment variable names (present in repo; do not paste live secrets into docs).

**Core Logic:**
- `app/api/semantic-universe/route.ts`: End-to-end analysis pipeline (search → LLM → image enrichment → streaming response).
- `app/tool/page.tsx`: Client orchestration for graph state, streaming NDJSON consumption, plan UI, and paywall triggers.
- `lib/tool-access.ts`: Subscription and demo eligibility rules shared by API routes.

**Testing:**
- Not detected (no `*.test.*`, `*.spec.*`, or dedicated test config in repository root).

## Naming Conventions

**Files:**
- **Route segments:** Next.js conventions — `page.tsx`, `layout.tsx`, `route.ts` inside folders named for URL segments (`sign-in`, `semantic-universe`).
- **Components:** `PascalCase` for primary component files where they export a component (e.g. `SignInFlo` in `sign-in-flo.tsx`, `RequireToolAuth` in `require-tool-auth.tsx`).
- **Libraries:** `kebab-case` filenames for multiword modules (`cookie-options.ts`, `site-url.ts`, `tool-access.ts`).

**Directories:**
- **URL-aligned:** Lowercase hyphenated or single-word folders under `app/` mirroring routes (`/app/tool`, `/app/api/stripe/checkout`).
- **Component groupings:** Lowercase role folders (`components/auth`, `components/tool`, `components/ui`).

**Exports:**
- Prefer named exports for layout-adjacent components (`Providers`, `RequireToolAuth`) and default exports for `page.tsx` files per Next.js convention.

## Where to Add New Code

**New Feature (full-stack):**
- Primary UI: `app/<segment>/page.tsx` (or a nested layout if the feature needs a shared shell).
- API: `app/api/<segment>/route.ts`.
- Shared client hooks: `hooks/use-<name>.ts`.
- Shared types/helpers: `lib/<name>.ts` if reused across routes; otherwise keep close to the Route Handler until duplication appears.

**New Component / Module:**
- Marketing or generic UI: `components/ui/<name>.tsx`.
- Auth-related wrappers: `components/auth/<name>.tsx`.
- Tool-only pieces: `components/tool/<name>.tsx`.

**Utilities:**
- Shared class names / small pure helpers: `lib/utils.ts` or new `lib/<topic>.ts`.
- Supabase-specific behavior: extend `lib/supabase/*` rather than opening clients ad hoc in components.

**Third-party integration surface:**
- Stripe: extend `lib/stripe.ts` and add or adjust handlers under `app/api/stripe/`.
- Supabase schema access: prefer `createClient()` from `lib/supabase/server.ts` in Route Handlers; use `createAdminClient()` only when RLS bypass is required (see comment in `lib/supabase/admin.ts`).

## Special Directories

**`.next/`:**
- Purpose: Next.js build output and dev cache.
- Generated: Yes.
- Committed: No (typically gitignored).

**`public/`:**
- Purpose: Static assets; paths are root-relative in code (`/noem-logo.png`).
- Generated: No.
- Committed: Yes.

**`.planning/`:**
- Purpose: Planning and codebase documentation for GSD workflows.
- Generated: Mixed (human- and tool-written).
- Committed: Per team policy; this `STRUCTURE.md` lives under `.planning/codebase/`.

---

*Structure analysis: 2026-05-06*
