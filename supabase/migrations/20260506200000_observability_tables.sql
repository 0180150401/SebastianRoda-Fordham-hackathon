-- Phase 2: observability + UTC-day usage rollup (OBS-01 / OBS-02)

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

create policy "semantic_pipeline_runs_select_own"
  on public.semantic_pipeline_runs for select
  using (auth.uid() = user_id);

create policy "semantic_pipeline_runs_insert_own"
  on public.semantic_pipeline_runs for insert
  with check (auth.uid() = user_id);

create table if not exists public.user_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  openai_input_tokens bigint not null default 0,
  openai_output_tokens bigint not null default 0,
  retrieval_units integer not null default 0,
  primary key (user_id, usage_date)
);

alter table public.user_daily_usage enable row level security;

create policy "user_daily_usage_select_own"
  on public.user_daily_usage for select
  using (auth.uid() = user_id);

create policy "user_daily_usage_insert_own"
  on public.user_daily_usage for insert
  with check (auth.uid() = user_id);

create policy "user_daily_usage_update_own"
  on public.user_daily_usage for update
  using (auth.uid() = user_id);
