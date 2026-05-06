---
status: warnings
phase: 03-pipeline-extraction-scorer
files_reviewed:
  - .env.example
  - app/api/semantic-universe/route.ts
  - lib/pipeline/__tests__/retriever.test.ts
  - lib/pipeline/__tests__/scorer.test.ts
  - lib/pipeline/__tests__/structurer.test.ts
  - lib/pipeline/enricher.ts
  - lib/pipeline/models.ts
  - lib/pipeline/retriever.ts
  - lib/pipeline/scorer.ts
  - lib/pipeline/stream-handler.ts
  - lib/pipeline/structurer.ts
  - package-lock.json
  - package.json
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
reviewed_at: 2026-05-06
---

# Phase 03 Code Review

## Findings

### Warning: Server-side image enrichment fetches untrusted result URLs without SSRF protections

- **File:** `lib/pipeline/enricher.ts:27`
- **Also:** `lib/pipeline/enricher.ts:34`, `lib/pipeline/enricher.ts:68`
- **Impact:** A user-controlled brand query flows through Tavily/Exa results into `enrichVisualCorrelationsWithImages`, which server-fetches up to 10 arbitrary source URLs and follows redirects. The only filtering excludes `example.com` and non-HTTP-ish strings after URL resolution; there is no validation against loopback, link-local, private IP ranges, internal hostnames, or redirect targets. A poisoned/searchable result or attacker-controlled page can make the server request internal metadata/admin endpoints during analysis.
- **Recommendation:** Before fetching, parse each URL and reject private/loopback/link-local hosts, local TLDs, raw private IPs, and unsupported schemes. Disable or manually validate redirects so the final URL is checked too. Consider limiting enrichment fetches to known-safe public news/content domains or moving image discovery behind a service with SSRF egress controls.

### Warning: Retrieval provider requests can hang until the route max duration

- **File:** `lib/pipeline/retriever.ts:29`
- **Also:** `lib/pipeline/retriever.ts:67`, `lib/pipeline/retriever.ts:102`
- **Impact:** Tavily and Exa requests are launched through nested `Promise.all` calls without an `AbortSignal` or timeout. If any one of the six upstream requests stalls, the provider-level `Promise.all` never resolves, the `.catch(() => [])` around `fetchTavily`/`fetchExa` does not run, and the NDJSON stream remains stuck on the `sources` step until the platform kills the route. This turns one slow provider request into a full analysis failure and poor user feedback.
- **Recommendation:** Add bounded per-request timeouts with `AbortSignal.timeout` or an abort controller helper, catch individual query failures inside each mapped request, and return partial provider results when available. Emit a degraded source detail rather than letting one hung request block synthesis.

## Verification

- `npx tsc --noEmit` - passed
- `npm test` - passed (5 files, 42 tests)
- `npm test -- --runInBand` - not applicable; Vitest 4 rejects the Jest-only `--runInBand` flag.
