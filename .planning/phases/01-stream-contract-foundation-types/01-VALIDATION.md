---
phase: 1
slug: stream-contract-foundation-types
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4 (per RESEARCH.md — install in Wave 0 if absent) |
| **Config file** | `vitest.config.ts` (path alias `@/*` → repo root) |
| **Quick run command** | `npx vitest run lib/pipeline` or `npm run test` once script exists |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5–30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` scoped to changed tests or full contract suite
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by executor from PLAN.md tasks) | — | — | STREAM-01, STREAM-02 | — | NDJSON contract; no secret logging | unit | `npx vitest run` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `vitest.config.ts` — path alias matches `tsconfig.json`
- [ ] `npm run test` — forwards to `vitest run`
- [ ] Contract test file(s) covering every `PipelineEvent` variant with chunked NDJSON fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/tool` happy-path stream | SC4 (ROADMAP) | Browser + auth + paywall | Sign in, run analysis, confirm steps complete and graph loads as today |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers Vitest + contract tests
- [ ] No watch-mode flags in CI-oriented scripts
- [ ] Feedback latency acceptable
- [ ] `nyquist_compliant: true` set in frontmatter when complete

**Approval:** pending
