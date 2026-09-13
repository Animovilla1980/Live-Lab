-- Live Lab 0.1.0 — shared Supabase migration (Forebet Lab project)
-- Safe scope: only creates live_lab_* objects. It does NOT alter Forebet Lab tables.

create extension if not exists pgcrypto;

create table if not exists public.live_lab_leagues (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  enabled boolean not null default true,
  legacy_picks integer,
  legacy_strike numeric(5,2),
  legacy_fair_odd numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_lab_alerts (
  id uuid primary key default gen_random_uuid(),
  match_key text not null,
  match_date date not null,
  league_name text,
  home_team text not null,
  away_team text not null,
  alert_minute integer not null,
  home_score integer not null default 0,
  away_score integer not null default 0,
  xg_home numeric(6,3),
  xg_away numeric(6,3),
  xg_total numeric(6,3),
  sot_home integer,
  sot_away integer,
  sot_total integer,
  source_url text,
  forebet_match_id text,
  forebet_predicted_score text,
  forebet_gate_status text not null default 'UNKNOWN' check (forebet_gate_status in ('PASS','BLOCK','UNKNOWN')),
  forebet_gate_reason text,
  telegram_allowed boolean not null default true,
  telegram_sent boolean not null default false,
  ft_home integer,
  ft_away integer,
  outcome text check (outcome in ('HIT','MISS','VOID','BLOCKED') or outcome is null),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(match_key, alert_minute)
);

create index if not exists live_lab_alerts_date_idx on public.live_lab_alerts(match_date desc);
create index if not exists live_lab_alerts_league_idx on public.live_lab_alerts(league_name);
create index if not exists live_lab_alerts_gate_idx on public.live_lab_alerts(forebet_gate_status);

create table if not exists public.live_lab_settings (
  id text primary key default 'default',
  min_minute integer not null default 23,
  max_minute integer not null default 32,
  max_goals integer not null default 0,
  min_sot integer not null default 1,
  min_xg numeric(5,2) not null default 0.50,
  forebet_gate_enabled boolean not null default true,
  forebet_unknown_allows_alert boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.live_lab_settings(id) values ('default') on conflict (id) do nothing;

insert into public.live_lab_leagues(canonical_name,enabled,legacy_picks,legacy_strike,legacy_fair_odd) values
  ('Australia A-League', true, null, null, null),
  ('Austria 2. Liga', true, null, null, null),
  ('Austria Bundesliga', true, 4, 67, 1.49),
  ('Belgium Cup', true, null, null, null),
  ('Belgium First Division A', true, 5, 75, 1.33),
  ('Belgium Reserve League', true, null, null, null),
  ('Bosnia & Herzegovina Premier Liga', true, null, null, null),
  ('Bulgaria First League', true, null, null, null),
  ('Chile Primera Division', true, null, null, null),
  ('Croatia 1.HNL', true, null, null, null),
  ('Croatia 2.HNL', true, null, null, null),
  ('Czech Republic First League', true, null, null, null),
  ('Denmark Superligaen', true, 5, 80, 1.25),
  ('Estonia Esiliiga', true, null, null, null),
  ('Estonia Meistriliiga', true, null, null, null),
  ('Finland Kakkonen Group A', true, null, null, null),
  ('Finland Kakkonen Group B', true, null, null, null),
  ('Finland Kakkonen Group C', true, null, null, null),
  ('Finland Kakkonnen Play-Offs', true, null, null, null),
  ('Finland Kolmonen', true, null, null, null),
  ('Finland Veikkausliiga', true, null, null, null),
  ('Finland Ykkonen', true, null, null, null),
  ('France National', true, null, null, null),
  ('Germany 3.Liga', true, null, null, null),
  ('Germany Bundesliga I', true, null, null, null),
  ('Germany Bundesliga II', true, 4, 100, 1.0),
  ('Germany Bundesliga II Play-Offs', true, null, null, null),
  ('Germany Bundesliga Play-Offs', true, null, null, null),
  ('Greece Super League 1', true, 1, 100, 1.0),
  ('Hungary NB I', true, null, null, null),
  ('Iceland Premier League', true, null, null, null),
  ('India I-League', true, null, null, null),
  ('Indonesia Liga 1', true, null, null, null),
  ('Northern Ireland Premier', true, null, null, null),
  ('Israel Premier League', true, null, null, null),
  ('Itália - Série B', true, null, null, null),
  ('Italy Serie A', true, 7, 71, 1.41),
  ('Italy Serie B', true, 2, 50, 2.0),
  ('Japan J-League', true, 11, 90, 1.11),
  ('Latvia 1. Liga', true, null, null, null),
  ('Netherlands Eerste Divisie', true, 5, 80, 1.25),
  ('Netherlands Eredivisie', true, 1, 100, 1.0),
  ('Norway Division 1', true, null, null, null),
  ('Norway Eliteserien', true, 1, 100, 1.0),
  ('Peru Liga 1', true, 8, 86, 1.16),
  ('Poland Ekstraklasa', true, 8, 75, 1.33),
  ('Portugal Primeira Liga', true, 6, 67, 1.49),
  ('Romania Liga II', true, null, null, null),
  ('Saudi Arabia Premier League', true, null, null, null),
  ('Serbia Super Liga', true, null, null, null),
  ('Slovakia Super Liga', true, 4, 75, 1.33),
  ('South Korea K League 1', true, null, null, null),
  ('South Korea K League 2', true, null, null, null),
  ('South Korea K-League 1', true, null, null, null),
  ('South Korea K-League 2', true, null, null, null),
  ('Spain Primera Liga', true, null, null, null),
  ('Sweden 1.div Norra', true, null, null, null),
  ('Sweden 1.div Södra', true, null, null, null),
  ('Sweden 2.div Norra Götaland', true, null, null, null),
  ('Sweden 2.div Norra Svealand', true, null, null, null),
  ('Sweden 2.div Norrland', true, null, null, null),
  ('Sweden 2.div Södra Götaland', true, null, null, null),
  ('Sweden 2.div Västra Götaland', true, null, null, null),
  ('Sweden Allsvenskan', true, 7, 57, 1.75),
  ('Sweden Superettan', true, null, null, null),
  ('Switzerland Super League', true, 1, 0, null),
  ('Tunisia League 1', true, null, null, null),
  ('England Championship', true, 5, 60, 1.67),
  ('England FA Cup', true, null, null, null),
  ('England League 1', true, 11, 64, 1.56),
  ('England League 2', true, 10, 78, 1.28),
  ('England National League', true, null, null, null),
  ('Scotland Championship', true, null, null, null),
  ('Scotland League One', true, null, null, null),
  ('Scotland League Two', true, null, null, null),
  ('Wales Premier League', true, null, null, null),
  ('AFC Asian Cup', true, null, null, null),
  ('AFC Asian Cup Qualifiers', true, null, null, null),
  ('AFC Champions League', true, null, null, null),
  ('AFC Champions League Qualification', true, null, null, null),
  ('FIFA Club World Cup', true, null, null, null)
on conflict (canonical_name) do update set
  legacy_picks=excluded.legacy_picks,
  legacy_strike=excluded.legacy_strike,
  legacy_fair_odd=excluded.legacy_fair_odd;

-- Dashboard views
create or replace view public.live_lab_league_performance as
select
  l.canonical_name, l.enabled, l.legacy_picks, l.legacy_strike, l.legacy_fair_odd,
  count(a.id) filter (where a.outcome in ('HIT','MISS')) as live_resolved,
  count(a.id) filter (where a.outcome='HIT') as live_hits,
  case when count(a.id) filter (where a.outcome in ('HIT','MISS')) > 0
    then round(100.0 * count(a.id) filter (where a.outcome='HIT') / count(a.id) filter (where a.outcome in ('HIT','MISS')),1)
    else null end as live_strike
from public.live_lab_leagues l
left join public.live_lab_alerts a on a.league_name=l.canonical_name
group by l.id;

-- RLS: browser clients get no direct write access. App writes server-side using service role.
alter table public.live_lab_leagues enable row level security;
alter table public.live_lab_alerts enable row level security;
alter table public.live_lab_settings enable row level security;

-- No anon/authenticated write policies are intentionally created.
-- Live Lab server routes use SUPABASE_SERVICE_ROLE_KEY on Vercel.
