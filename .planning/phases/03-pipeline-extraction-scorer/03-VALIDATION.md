---
phase: 3
slug: pipeline-extraction-scorer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 3 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run lib/pipeline` |
| **Full suite command** | `npm test` |

## Sampling Rate

- After each task: `npx vitest run lib/pipeline` (or narrower glob)
- Before phase sign-off: `npm test` + `npx tsc --noEmit`

## Manual-Only Verifications

| Behavior | Why manual |
|----------|------------|
| `/tool` graph parity | Visual + stream steps unchanged |

## Validation Sign-Off

**Approval:** pending
