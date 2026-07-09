-- GrowEasy CSV Importer — optional persistence schema
-- Run this in the Supabase SQL editor if you want import history to persist.
-- The backend runs perfectly fine without this (stateless mode) if you skip it.

create extension if not exists "pgcrypto";

create table if not exists import_runs (
  id uuid primary key,
  source_filename text,
  total_rows integer not null default 0,
  total_imported integer not null default 0,
  total_skipped integer not null default 0,
  failed_batches integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references import_runs(id) on delete cascade,
  skipped boolean not null default false,
  skip_reason text,
  raw_row jsonb,

  created_at text,               -- lead's own created_at (kept as text: source values vary in format)
  name text,
  email text,
  country_code text,
  mobile_without_country_code text,
  company text,
  city text,
  state text,
  country text,
  lead_owner text,
  crm_status text,
  crm_note text,
  data_source text,
  possession_time text,
  description text,

  inserted_at timestamptz not null default now()
);

create index if not exists idx_leads_import_run_id on leads(import_run_id);
create index if not exists idx_leads_email on leads(email);
