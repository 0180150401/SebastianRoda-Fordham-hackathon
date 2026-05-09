---
phase: 6
slug: graph-visualization-upgrade
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm run test:contract` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

**Scope note:** vitest is configured with `environment: 'node'` and `include: ["lib/**/*.test.ts"]`. Browser/DOM testing is not set up. sigma/graphology WebGL rendering is not unit-testable in this environment. Phase 6 automated tests cover only schema additions in `lib/pipeline/models.ts` and `lib/pipeline/structurer.ts`. Visual rendering and layout correctness are verified by in-browser smoke test.

---

## Sampling Rate

- **After every task commit:** Run `npm run test:contract`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + manual `/tool` smoke test
- **Max feedback latency:** ~5 seconds (automated); ~2 minutes (manual smoke)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | VIS-02 | entityType/relType whitelist | Unknown entityType/relType falls back to default, not crash | unit | `npm run test:contract -- --reporter=verbose lib/pipeline/__tests__/structurer.test.ts` | ✅ extend | ⬜ pending |
| 6-01-02 | 01 | 1 | VIS-02 | — | N/A | unit | same as above | ✅ extend | ⬜ pending |
| 6-02-01 | 02 | 1 | VIS-01, VIS-02, VIS-03 | — | N/A | manual smoke | open `/tool`, run analysis, verify sigma renders | — | ⬜ pending |
| 6-02-02 | 02 | 1 | VIS-03 | — | N/A | manual smoke | verify ring visible on ≥3 community graphs; absent on simple graphs | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/pipeline/__tests__/structurer.test.ts` — add test cases for `entityType` field on GraphNode (5 valid values + unknown fallback) and `relType` field on GraphLink (3 valid values + unknown fallback)
- [ ] Verify `npm run test:contract` script exists in `package.json` (confirmed in Phase 3 test work; re-verify after sigma install in case package.json changes)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 200+ node graph renders at interactive frame rates (no jank during pan/zoom) | VIS-01 | WebGL rendering requires browser context; vitest is node-only | Open `/tool`, run a broad query producing 50+ nodes, verify pan/zoom is smooth; check DevTools Performance tab for no dropped frames |
| ForceAtlas2 worker runs off main thread — page stays responsive during layout | VIS-01 | Worker thread behavior not testable in vitest | Run analysis; observe graph animating to layout while typing in input is still responsive |
| Louvain ring appears on medium-to-large graphs (≥3 communities) | VIS-03 | WebGL canvas rendering; community count is graph-data-dependent | Run analysis producing ≥10 nodes with diverse connections; verify colored border rings visible; run with simple 3-node graph to verify rings absent |
| Node click fires `onNodeSelect` → evidence panel updates | VIS-02 | Browser event handling; sigma click events require real WebGL instance | Click nodes in graph; verify sidebar/evidence panel updates to selected node; verify clicking stage deselects |
| "Show gaps only" toggle filters sigma graph correctly | VIS-02 | sigma graph state change requires browser | Toggle "Show gaps only"; verify only gap edges (missing=true) remain visible |
| FA2 worker falls back to sync FA2 if worker fails (Next.js 16.1.6 Turbopack issue) | VIS-01 | Requires dev mode observation | Check `[semantic-graph]` console logs for FA2 worker running status; verify layout runs even if worker path fails |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (unit) / ~2min (manual smoke)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
