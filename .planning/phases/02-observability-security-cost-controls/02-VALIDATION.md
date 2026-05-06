---
phase: 2
slug: observability-security-cost-controls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing Phase 1) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run lib/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run lib/` (or narrower path if task scopes tests)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | OBS-02 | T-02-01 | Migration reviewed before push | manual checklist | `test -f supabase/migrations/*.sql` | ⬜ W0 | ⬜ pending |
| 02-02-01 | 02-02 | 2 | OBS-01 | T-02-03 | Langfuse keys never logged | unit | `npx vitest run lib/` | ✅ | ⬜ pending |
| 02-03-01 | 02-03 | 2 | OBS-03 | T-02-02 | Anonymous geo-chat rejected | integration manual | `curl -i -X POST /api/geo-chat` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing Vitest + Phase 1 contract tests cover pipeline parsing — extend with tests under `lib/**/__tests__/` for cap helpers and new event schema variants.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Langfuse dashboard shows traces | OBS-01 | Needs cloud project | Run one semantic-universe with keys set; confirm trace ID matches DB row |
| Supabase live RLS | OBS-01 | Needs hosted DB | After migration push: query as user A — cannot read user B rows |
| Kill switch in prod | OBS-02 | Env toggle | Set `SEMANTIC_PIPELINE_DISABLED=true` on preview deployment; POST returns 503 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
