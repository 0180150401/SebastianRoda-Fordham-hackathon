# Technology Stack

**Analysis Date:** 2026-05-06

## Languages

**Primary:**
- TypeScript (see `typescript` in `package.json` devDependencies; `strict: true` in `tsconfig.json`) — all application code in `app/`, `components/`, `hooks/`, `lib/`, `middleware.ts`

**Secondary:**
- CSS — `app/globals.css` (Tailwind v4 `@import "tailwindcss"` and `tw-animate-css`); no separate CSS preprocessors beyond PostCSS

## Runtime

**Environment:**
- Node.js — implied by Next.js 16 build and `npm` scripts (`next dev`, `next build`, `next start`)

**Package Manager:**
- npm — `package-lock.json` present at repo root
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- Next.js `16.1.6` — App Router (`app/`); Route Handlers under `app/api/**/route.ts`
- React `19.2.3` / `react-dom` `19.2.3`

**Testing:**
- Not detected — no `jest`, `vitest`, `playwright`, or test scripts in `package.json`

**Build/Dev:**
- Next.js built-in bundler (Turbopack in dev per Next 16 defaults unless overridden)
- ESLint `^9` with `eslint-config-next` `16.1.6` — `eslint.config.mjs`
- PostCSS — `postcss.config.mjs` with `@tailwindcss/postcss`
- Tailwind CSS `^4` — `tailwindcss`, `@tailwindcss/postcss`; theme tokens in `app/globals.css` (`@theme inline`)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` `^2.102.1` and `@supabase/ssr` `^0.10.0` — session cookies, server/browser clients (`lib/supabase/*`, `middleware.ts`, `app/auth/callback/route.ts`)
- `stripe` `^22.0.1` — subscriptions, Checkout, Billing Portal, webhooks (`lib/stripe.ts`, `app/api/stripe/*`)
- `next` — routing, `next/font/google` (Geist fonts in `app/layout.tsx`), middleware

**UI & motion:**
- `@radix-ui/react-dialog`, `@radix-ui/react-label`, `@radix-ui/react-slot` — dialogs, labels, Slot composition
- `@base-ui/react` — additional headless primitives where used under `components/ui/`
- `motion` `^12.38.0` — animations
- `class-variance-authority`, `clsx`, `tailwind-merge` — variant and class composition
- Icon sets: `@carbon/icons-react`, `@hugeicons/react`, `lucide-react`
- `cobe` — 3D globe (`components/ui/cobe-globe-weather.tsx`)
- `embla-carousel-react`, `embla-carousel-auto-scroll` — carousels
- `vaul` — drawers
- `@number-flow/react` — animated numbers

**Infrastructure / product:**
- `resend` `^6.10.0` — transactional email from `app/api/waitlist/route.ts`

**LLM / search (HTTP, not npm SDKs for OpenAI):**
- Semantic tool and geo chat call OpenAI REST from `app/api/semantic-universe/route.ts` and `app/api/geo-chat/route.ts`; API keys from environment (see `INTEGRATIONS.md`).

## Configuration

**Environment:**
- Documented template: `.env.example` (do not commit real secrets); lists Supabase public keys, service role, Stripe, Resend, site URL, and optional aliases
- Public vs server: `NEXT_PUBLIC_*` for Supabase URL/keys and site URL; server-only keys for Stripe secret, webhook secret, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, Resend (`app/api/waitlist/route.ts`, `lib/stripe.ts`, `lib/supabase/env.ts`)

**Build:**
- `next.config.ts` — minimal exported `NextConfig`
- `tsconfig.json` — path alias `@/*` → project root `"paths": { "@/*": ["./*"] }`

## Platform Requirements

**Development:**
- Node.js compatible with Next.js 16; run `npm install` then `npm run dev` (see `package.json` scripts)

**Production:**
- Next.js standalone hosting (`.env.example` references Vercel env configuration); canonical HTTPS origin required for auth and Stripe redirects (`NEXT_PUBLIC_SITE_URL`, `lib/site-url.ts`)

---

*Stack analysis: 2026-05-06*
