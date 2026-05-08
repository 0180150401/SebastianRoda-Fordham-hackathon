create table if not exists public.semantic_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  brand text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms_sources integer,
  duration_ms_synthesis integer,
  duration_ms_images integer,
  openai_input_tokens integer not null default 0,
  openai_output_tokens integer not null default 0,
  retrieval_units integer not null default 0,
  node_count integer,
  edge_count integer,
  source_count integer,
  result_type text not null check (result_type in ('success', 'fallback', 'error')),
  error_message text,
  langfuse_trace_id text
);

create index if not exists semantic_pipeline_runs_user_started_idx
  on public.semantic_pipeline_runs (user_id, started_at desc);

alter table public.semantic_pipeline_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'semantic_pipeline_runs'
      and policyname = 'semantic_pipeline_runs_select_own'
  ) then
    create policy "semantic_pipeline_runs_select_own"
      on public.semantic_pipeline_runs for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'semantic_pipeline_runs'
      and policyname = 'semantic_pipeline_runs_insert_own'
  ) then
    create policy "semantic_pipeline_runs_insert_own"
      on public.semantic_pipeline_runs for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

alter table public.semantic_pipeline_runs
  drop constraint if exists semantic_pipeline_runs_result_type_check;

alter table public.semantic_pipeline_runs
  add constraint semantic_pipeline_runs_result_type_check
  check (result_type in ('success', 'degraded', 'fallback', 'error'));

alter table public.semantic_pipeline_runs
  add column if not exists retrieval_query_count integer,
  add column if not exists retrieval_provider_success_count integer,
  add column if not exists retrieval_provider_failure_count integer,
  add column if not exists retrieval_filtered_count integer,
  add column if not exists retrieval_degraded_reason text,
  add column if not exists retrieval_filter_reasons jsonb,
  add column if not exists synthesis_result_reason text,
  add column if not exists synthesis_repaired_links integer,
  add column if not exists synthesis_rejected_links integer,
  add column if not exists synthesis_rejected_nodes integer,
  add column if not exists synthesis_grounded_edge_count integer,
  add column if not exists synthesis_passage_evidence_count integer;
