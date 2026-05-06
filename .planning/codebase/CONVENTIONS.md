# Coding Conventions

**Analysis Date:** 2026-05-06

## Naming Patterns

**Files:**

- **`app/` routes:** Segment folders use lowercase (e.g. `app/sign-in/page.tsx`). Page modules use PascalCase symbols and default-export the page (`Home`, `SignInPage`). See `app/page.tsx`, `app/sign-in/page.tsx`.
- **Shared UI primitives:** Kebab-case filenames with **named exports** (`Button`, `buttonVariants`): `components/ui/button.tsx`.
- **Feature / domain components:** Kebab-case under `components/auth/`, `components/tool/`: e.g. `components/auth/require-tool-auth.tsx`, `components/tool/tool-access-gate.tsx`.
- **`lib/` helpers:** Kebab-case or short domain names: `lib/utils.ts`, `lib/tool-access.ts`, `lib/site-url.ts`, `lib/supabase/server.ts`.

**Directories:**

- `app/` — Next.js App Router routes and layouts.
- `components/ui/` — Reusable primitives (Radix/shadcn-style).
- `components/auth/`, `components/tool/` — Feature-grouped UI.
- `hooks/` — Client hooks (prefix `use-` in filenames).
- `lib/` — Server/client utilities and SDK wrappers (`lib/supabase/*`, `lib/stripe.ts`).

**Functions:**

- **camelCase** for functions and helpers: `createClient()`, `cn()`, `isSubscriptionActive()`, `escapeHtml()`, `normalizeSupabaseProjectUrl()`.
- **`async`** route handlers exported as verbs matching HTTP semantics: `POST`, `GET` in `app/api/*/route.ts` (e.g. `export async function POST` in `app/api/waitlist/route.ts`).

**Variables / parameters:**

- **camelCase** (`request`, `body`, `profileId`).
- Booleans reflect intent (`savedToDb`, `subscriptionActive`).
- Prefer **narrowing** unknown JSON with typeof/`in` checks before use (pattern in `app/api/waitlist/route.ts`).

**Types:**

- **`interface`** for extending HTML element props (`ButtonProps` in `components/ui/button.tsx`).
- **`type`** for utility types and Stripe/event shapes where used (`Stripe.Event` imports in `app/api/stripe/webhook/route.ts`).
- **`import type`** for type-only imports to avoid runtime imports (`Metadata` in `app/layout.tsx`, `ClassValue` from `clsx` in `lib/utils.ts`).

**React components:**

- **PascalCase** exported component names (`RequireToolAuth`, `Providers`, `Button`).
- **Client Components** start with `'use client';` when using hooks or browser APIs: `app/providers.tsx`, `components/auth/require-tool-auth.tsx`.

## Code Style

**Formatting:**

- **Not detected:** Dedicated Prettier (`prettier`/`.prettierrc`), Biome, or `.editorconfig` in the repo. Rely on **ESLint (flat config)** and editor defaults until a formatter is added.

**Linting:**

- **Tool:** ESLint **9** with **eslint-config-next** bundles: **`eslint.config.mjs`** composes `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`:
  ```1:17:eslint.config.mjs
  import { defineConfig, globalIgnores } from "eslint/config";
  import nextVitals from "eslint-config-next/core-web-vitals";
  import nextTs from "eslint-config-next/typescript";

  const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ]),
  ]);
  ```

**Scripts:**

```bash
npm run lint               # ESLint via package script
```

## Import Organization

**Order (prescriptive pattern to match existing files):**

1. **Leading file-level doc/block comment** where used (route purpose), e.g. `app/api/waitlist/route.ts`.
2. **External packages** (including `next/*`, `@supabase/*`, third-party npm).
3. **Blank line.**
4. **Project aliases** `@/...` (single alias maps to repo root).

**Path aliases:**

- **`@/*` → `./*`** (repo root)—defined in **`tsconfig.json`** `compilerOptions.paths`. Prefer `@/components/...`, `@/lib/...`, `@/app/...` over deep relative climbs.

```21:23:tsconfig.json
    "paths": {
      "@/*": ["./*"]
    }
```

**React:**

- Prefer `import * as React from "react"` in primitives (`components/ui/button.tsx`); hooks may import named hooks (`useEffect`, `useState` from `react` in `components/auth/require-tool-auth.tsx`).
- **`import type`** for `ReactNode` and similar in client providers (`app/providers.tsx`).

## Error Handling

**API routes:**

- **`NextResponse.json`** with appropriate **HTTP status** for client errors (`400`), upstream failures (`502`), and opaque failure messages where appropriate (`app/api/waitlist/route.ts`).
- **`try` / `catch`** on **`request.json()`**; `catch` without binding when the error detail is irrelevant (`catch { return NextResponse.json(..., { status: 400 }); }`).
- **Stripe webhook:** Validate signature secret and header; **`constructEvent`** in **try/catch**, return **`400`** on invalid signature (`app/api/stripe/webhook/route.ts`).
- Supabase/third-party failures: **`console.error` with bracketed prefix** for grepability (`[waitlist]`, `[stripe webhook]`).

**Libraries / helpers:**

- **Throw `Error`** with actionable setup messages when invariant config is missing: `assertSupabasePublicConfig()` in `lib/supabase/env.ts`.

**Silent catch (intentional):**

- **`lib/supabase/server.ts`** catches in `setAll` when cookies cannot be mutated from a Server Component; comment documents that middleware refreshes the session:

```16:26:lib/supabase/server.ts
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component without mutable cookies — middleware refreshes session.
          }
        },
```

## Logging

**Framework:** **`console`** (`console.error`, `console.warn`).

**Patterns:**

- **Prefix logs** with a short subsystem tag in brackets: `[waitlist]`, `[stripe webhook]` (`app/api/waitlist/route.ts`, `app/api/stripe/webhook/route.ts`).
- **`console.warn`** for degraded / optional configuration paths (missing env-driven features).

## Comments

**When to comment:**

- **Route files:** Top-of-file summary of endpoint contract (see `app/api/waitlist/route.ts`).
- **Non-obvious behavior:** Silent catches, URL normalization quirks (`lib/supabase/env.ts`).
- **Inline:** Sparingly; regex intent is sometimes self-explanatory.

**JSDoc / TSDoc:**

- **Block comments** describe module-level behavior (`lib/supabase/env.ts`).
- Exported pure helpers accept short **line comments** where they clarify domain meaning (`lib/tool-access.ts` opener).

## Function Design

**Size:**

- Large route/feature files exist (e.g. `app/tool/page.tsx`, heavy API handlers like `app/api/semantic-universe/route.ts`). For **new** code, extract helpers into `lib/` or colocated functions in `route.ts` **before** exceeding ~150 lines per conceptual unit where practical.

**Parameters:**

- Request bodies parsed once; narrow **`unknown`** to shapes before fields are read (`app/api/waitlist/route.ts`).

**Return values:**

- **`NextResponse`** for route handlers.
- **`null`** for “not found” lookups in Stripe webhook helpers (`findProfileIdByEmail` in `app/api/stripe/webhook/route.ts`).
- Booleans from small predicates (`isSubscriptionActive`, `canUseSemanticTool` in `lib/tool-access.ts`).

## Module Design

**Exports:**

- **`export default`** for **Next.js** `layout.tsx`, `page.tsx`, and `next.config.ts` defaults (`app/layout.tsx`, `app/page.tsx`, `next.config.ts`).
- **Named exports** for reusable UI and utilities (`export { Button, buttonVariants }` from `components/ui/button.tsx`; `export function cn` from `lib/utils.ts`).

**Barrel Files:**

- **Not detected:** No root `components/index.ts` or similar re-export barrels; import concrete paths (`@/components/ui/button`).

---

*Convention analysis: 2026-05-06*
