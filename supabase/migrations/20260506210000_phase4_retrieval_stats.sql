-- Phase 4: retrieval plan and source-quality aggregate telemetry (RTRY-01 / RTRY-02)

alter table public.semantic_pipeline_runs
  add column if not exists retrieval_query_count integer,
  add column if not exists retrieval_provider_success_count integer,
  add column if not exists retrieval_provider_failure_count integer,
  add column if not exists retrieval_filtered_count integer,
  add column if not exists retrieval_degraded_reason text,
  add column if not exists retrieval_filter_reasons jsonb;
