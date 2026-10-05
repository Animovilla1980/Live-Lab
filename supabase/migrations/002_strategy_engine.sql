-- Live Lab 0.5.0 — multi-strategy HOT engine
-- Non-destructive migration. Adds strategy metadata and live snapshots.

alter table public.live_lab_alerts
  add column if not exists strategy_code text,
  add column if not exists strategy_label text,
  add column if not exists strategy_score integer,
  add column if not exists alert_tier text,
  add column if not exists strategy_scores jsonb,
  add column if not exists pressure_delta jsonb,
  add column if not exists engine_version text;

create index if not exists live_lab_alerts_strategy_idx
  on public.live_lab_alerts(strategy_code, match_date desc);

create table if not exists public.live_lab_snapshots (
  id uuid primary key default gen_random_uuid(),
  match_key text not null,
  match_date date not null,
  league_name text,
  home_team text not null,
  away_team text not null,
  minute integer not null,
  home_score integer not null default 0,
  away_score integer not null default 0,
  xg_home numeric(7,3),
  xg_away numeric(7,3),
  sot_home integer,
  sot_away integer,
  attacks_home integer,
  attacks_away integer,
  dangerous_home integer,
  dangerous_away integer,
  possession_home numeric(5,2),
  possession_away numeric(5,2),
  red_cards_home integer,
  red_cards_away integer,
  source_url text,
  created_at timestamptz not null default now(),
  unique(match_key, minute)
);

create index if not exists live_lab_snapshots_match_idx
  on public.live_lab_snapshots(match_key, minute desc);
create index if not exists live_lab_snapshots_date_idx
  on public.live_lab_snapshots(match_date desc);

alter table public.live_lab_snapshots enable row level security;

-- Explicit grants for Data API compatibility after Supabase grant-policy change.
grant select, insert, update, delete on table public.live_lab_snapshots to service_role;
grant select, insert, update, delete on table public.live_lab_alerts to service_role;
