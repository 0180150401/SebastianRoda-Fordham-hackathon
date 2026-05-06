# Phase 4 Pattern Map - Multi-Stage Retrieval & Query Planner

**Phase:** 04  
**Created:** 2026-05-06  
**Status:** Ready for execution planning

---

## Existing Patterns To Preserve

| Pattern | Current Anchor | Phase 4 Use |
|---------|----------------|-------------|
| Typed stream events | `lib/pipeline/types.ts`, `pipeline.contract.test.ts` | Add `query_plan` as another zod-validated discriminant before server emission. |
| Hook-owned stream FSM | `hooks/use-semantic-universe-stream.ts` | Store plan display data in the same event pipeline the trace UI already consumes. |
| Thin route shell | `app/api/semantic-universe/route.ts` | Keep auth, budget, env cleaning, and route `maxDuration` outside planner/retriever modules. |
| Stage modules under `lib/pipeline/` | `retriever.ts`, `scorer.ts`, `stream-handler.ts` | Add `query-planner.ts` and `source-quality.ts`; refactor retriever in place. |
| Mocked provider tests | `retriever.test.ts`, `scorer.test.ts` | Mock `fetch` and OpenAI planner calls; no live Tavily/Exa/OpenAI/Voyage in CI. |
| User-readable detail strings | `stream-handler.ts` | Keep aggregate `sources` detail calm; no per-query progress stream. |

---

## Implementation Shape

```text
runSemanticUniverseAnalysisStream
  -> planRetrievalQueries
  -> emit query_plan
  -> retrieveSourcesForBrand with QueryPlan
  -> filterSourcesForQuality
  -> scoreSourcesForSynthesis
  -> synthesizeWithOpenAI
```

Phase 4 should expand the existing pipeline, not replace it. Provider-specific Tavily/Exa request construction belongs behind retriever helpers; query planning and quality filtering should remain deterministic and independently testable.

---

## Decision Coverage

| Decisions | Plan |
|-----------|------|
| D-05, D-06, D-07, D-08 | 04-01 stream contract and trace preservation |
| D-01, D-02, D-03, D-04, D-17, D-18, D-19 | 04-02 planner schema, caps, fallback |
| D-09, D-13, D-14, D-15, D-16, D-17, D-18 | 04-03 planned fanout, timeouts, quality filter |
| D-10, D-11, D-12 | 04-04 orchestration, degraded mode, telemetry |

---

## Execution Notes

- Wave 1 plans can be built in parallel if desired: 04-01 owns stream/client contract, 04-02 owns planner module.
- 04-03 depends on planner output shape and should remove Exa `useAutoprompt: true` while refactoring provider requests.
- 04-04 is the integration pass and owns any telemetry schema migration plus run-level stats persistence.
- Phase 4 intentionally does not add an adaptive rescue loop; the single fanout pass either yields usable evidence or emits a degraded reason.
