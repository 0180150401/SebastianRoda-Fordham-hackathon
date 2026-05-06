# 6-degrees

## What This Is

**6-degrees** (`6degree.noemtech.com`) is a web app where signed-in users run a **semantic universe** analysis: the system gathers web sources (Tavily + Exa), synthesizes a structured **node–edge graph** with OpenAI, streams progress over **NDJSON**, and renders an interactive **network visualizer** behind auth, access control, and Stripe-backed subscription/demo rules. This planning cycle targets **stronger graph UX**, **more convincing model outputs**, and a **more sophisticated multi-stage web-research pipeline** on top of the existing Next.js stack.

## Core Value

Users get a **trustworthy, explorable graph** of entities and relationships grounded in **fresh web evidence**, not a static summary — with clear provenance and an interface that makes the model’s reasoning legible.

## Requirements

### Validated

- ✓ Sign-in via Supabase (OAuth/email), session cookies, `/tool` protection via middleware and client gates — existing (`middleware.ts`, `lib/supabase/*`, `components/auth/*`)
- ✓ Streaming semantic analysis API returning NDJSON steps — existing (`app/api/semantic-universe/route.ts`)
- ✓ Multi-source fetch (Tavily + Exa), dedupe, OpenAI synthesis, fallback graph — existing (same route)
- ✓ Interactive tool UI consuming stream and rendering graph/workspace — existing (`app/tool/page.tsx`, `components/tool/*`)
- ✓ Access policy: profiles, demo usage, Stripe checkout/webhook integration — existing (`app/api/tool/access`, `app/api/stripe/*`)

### Active

- [ ] Graph/network visualizer conveys structure, scale, and clusters more clearly (layout, performance, labeling, interaction)
- [ ] Model outputs are **stronger**: better retrieval relevance, synthesis fidelity, and guardrails against thin or misleading graphs
- [ ] Web-research pipeline is **more complex**: richer query planning, additional retrieval stages, scoring/ranking, and clearer provenance in the stream

### Out of Scope

- Replacing the core product with an unrelated app — we are extending the current semantic-universe product
- Native mobile clients — web-first (defer unless explicitly requested later)
- Full compliance certification or legal review beyond documenting data flows — treat as future hardening phase unless required

## Context

- **Brownfield:** Codebase mapped under `.planning/codebase/` (architecture: Next.js App Router, Supabase SSR auth, Route Handlers, streaming NDJSON semantic pipeline).
- **Users:** Authenticated visitors to `/tool`; monetization and demo limits already wired.
- **Pain / opportunity:** As graphs and research grow, UX and pipeline depth become the differentiator; users need to **see** structure and **trust** sources.

## Constraints

- **Tech:** Stay on current stack (Next.js 16, React 19, Supabase, Stripe, server-side OpenAI/Tavily/Exa) unless research proves a narrowly scoped exception.
- **Ops:** Respect existing env-key model; no secrets in repo or planning docs.
- **Streaming:** Preserve or improve incremental UX (steps visible during long runs).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat this cycle as **brownfield enhancement** over mapped codebase | Avoid rewriting working auth, billing, and stream contract | — Pending |
| Optimize for **legible graphs + evidence**, not raw token volume | Aligns with Core Value | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-06 after initialization*
