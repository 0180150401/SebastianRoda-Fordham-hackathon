# Phase 3 Research — Pipeline extraction & Voyage rerank

**Phase:** 3  
**Date:** 2026-05-06  
**Scope:** Module extraction from `semantic-universe` route; `voyageai` rerank before synthesis.

---

## Summary

| Topic | Finding |
|-------|---------|
| Layout | `lib/pipeline/{models,retriever,scorer,structurer,enricher,orchestrate}.ts` per ARCHITECTURE.md |
| Rerank | `voyageai` npm package; model **`rerank-2.5`**; ~300ms typical — guard with **8s** timeout + fallback |
| Fallback | No `VOYAGE_API_KEY` → preserve **dedupe + `.slice(0, 18)`** ordering |
| Risk | Largest lift is **`structurer.ts`** (massive helper DAG); extract after retriever+scorer prove wiring |

---

## Validation Architecture

| Dimension | Approach |
|-----------|----------|
| Contract | `npm test` / `npx vitest run lib/pipeline` — NDJSON fixtures unchanged |
| Units | Per-stage Vitest with mocked HTTP / mocked voyage rerank |
| Manual | One `/tool` golden-path smoke after Plan 03-03 |

---

## RESEARCH COMPLETE
