# Testing Patterns

**Analysis Date:** 2026-05-06

## Test Framework

**Runner:**

- **Not detected** in **`package.json`**. There is **`npm run lint`** (`eslint`) but **no** `test`, `vitest`, `jest`, or `playwright` script defined in project scripts.

```4:11:package.json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
```

**Assertion library:**

- **Not applicable** — no runtime test harness in direct devDependencies.

**Run commands:**

```bash
npm run lint               # Static analysis only (ESLint); not unit/integration tests
```

## Test File Organization

**Location:**

- **Not detected.** No **`*.test.*`**, **`*.spec.*`**, **`__tests__/`**, or Playwright **`e2e/`** configs in the repository tree.

**Naming:**

- Prescriptive recommendation if tests are introduced: **`*.test.ts`** / **`*.test.tsx`** co-located next to **`lib/`** helpers or **`app/api/`** route modules under a mirror structure, OR a top-level **`__tests__/`** per Next.js conventions—pick one pattern and stick to it in future PRs.

**Structure:**

- **Not applicable** until a harness is added.

## Test Structure

**Suite Organization:**

```typescript
// Not present — add when adopting a runner, e.g. Vitest:

// import { describe, it, expect } from 'vitest';
// describe('canUseSemanticTool', () => { ... });
```

**Patterns:**

- **Setup / teardown:** Not applicable.
- **Assertions:** Follow chosen runner docs when introduced.

Good **first regression targets** (pure logic, no DOM): `lib/tool-access.ts`, URL helpers in `lib/site-url.ts`, `normalizeSupabaseProjectUrl` / `getSupabasePublicConfig` behavior in **`lib/supabase/env.ts`** (mock `process.env` per runner conventions).

## Mocking

**Framework:**

- **Not detected** (`vitest`/Jest mocking, MSW, `next-test-api-route-handler`, etc.).

**Patterns:**

```typescript
// Not present
```

**What to Mock:**

- **External IO** when unit-testing route handlers or server utilities: **`fetch`** (calling external semantic APIs), **Supabase admin client**, **Stripe** `constructEvent`, **Resend** `emails.send`—match files under `app/api/` and `lib/`.

**What NOT to Mock:**

- **pure functions** (`cn`, predicate helpers); test them directly for fast feedback.

## Fixtures and Factories

**Test data:**

```typescript
// Not present
```

**Location:**

- **Recommend** `tests/fixtures/` or co-located `*.fixtures.ts` when tests are added; keep PII-like samples synthetic.

## Coverage

**Requirements:**

- **None enforced.** No **`coverage`** script, **`nyc`**, **`c8`**, or Vitest **`coverage`** config.

**View coverage:**

```bash
# Not configured — example after adding Vitest:
# npx vitest run --coverage
```

## Test Types

**Unit tests:**

- **Not present.** Highest value first: **`lib/tool-access.ts`**, **`lib/utils.ts`** (`cn` composition), validators in **`app/api/waitlist/route.ts`** extracted if duplicated.

**Integration tests:**

- **Not present.** API routes (`app/api/**/route.ts`) benefit from **`Request`/`Response`**-level tests once a harness supports Next **Route Handler** semantics or uses HTTP against **`next dev`** in CI.

**E2E tests:**

- **Playwright `@playwright/test`** appears **only transitively** in **`package-lock.json`** (upstream of tooling), **not** as a direct **`package.json`** dependency and **without** **`playwright.config.*`**. Treat as **unused** unless explicitly adopted.

## Common Patterns

**Async testing:**

```typescript
// Not present — typical future pattern:

// await expect(fn()).resolves.toEqual(...)
```

**Error testing:**

```typescript
// Not present — mirror route handler status codes returned via NextResponse
```

---

*Testing analysis: 2026-05-06*
