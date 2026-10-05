-- Live Lab 0.6.0 — Paper Exchange AUTO
-- Non-destructive migration: virtual bankroll, trades and tranche orders.

create table if not exists public.live_lab_paper_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default true,
  mode text not null default 'PAPER_AUTO',
  bankroll_start numeric(12,2) not null default 200.00,
  bankroll_current numeric(12,2) not null default 200.00,
  max_stake_pct numeric(5,2) not null default 10.00,
  tier_b_pct numeric(5,2) not null default 5.00,
  tier_a_pct numeric(5,2) not null default 7.50,
  tier_a_strong_pct numeric(5,2) not null default 10.00,
  tier_a_strong_score integer not null default 95,
  commission_pct numeric(5,2) not null default 4.50,
  goal_pressure_tranches integer not null default 4,
  goal_pressure_tick_gap integer not null default 25,
  updated_at timestamptz not null default now()
);

insert into public.live_lab_paper_settings(id)
values (1)
on conflict (id) do nothing;

create table if not exists public.live_lab_paper_trades (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid,
  match_key text not null,
  match_date date not null,
  league_name text,
  home_team text not null,
  away_team text not null,
  strategy_code text not null,
  strategy_label text,
  strategy_score integer,
  alert_tier text,
  market_type text,
  market_name text,
  market_id text,
  selection_id text,
  selection_name text,
  status text not null default 'WAITING_PRICE',
  bankroll_before numeric(12,2) not null,
  stake_pct numeric(5,2) not null,
  stake_total numeric(12,2) not null,
  stake_filled numeric(12,2) not null default 0,
  initial_price numeric(10,2),
  avg_price numeric(10,3),
  entry_minute integer,
  entry_home_score integer,
  entry_away_score integer,
  last_price numeric(10,2),
  last_minute integer,
  last_home_score integer,
  last_away_score integer,
  gross_pnl numeric(12,2),
  commission numeric(12,2),
  net_pnl numeric(12,2),
  close_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  unique(match_key, strategy_code)
);

create table if not exists public.live_lab_paper_orders (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.live_lab_paper_trades(id) on delete cascade,
  tranche_no integer not null,
  target_price numeric(10,2),
  stake numeric(12,2) not null,
  status text not null default 'PLANNED',
  matched_price numeric(10,2),
  matched_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(trade_id, tranche_no)
);

create index if not exists live_lab_paper_trades_status_idx on public.live_lab_paper_trades(status, created_at desc);
create index if not exists live_lab_paper_trades_strategy_idx on public.live_lab_paper_trades(strategy_code, created_at desc);
create index if not exists live_lab_paper_orders_trade_idx on public.live_lab_paper_orders(trade_id, tranche_no);

alter table public.live_lab_paper_settings enable row level security;
alter table public.live_lab_paper_trades enable row level security;
alter table public.live_lab_paper_orders enable row level security;

grant select, insert, update, delete on table public.live_lab_paper_settings to service_role;
grant select, insert, update, delete on table public.live_lab_paper_trades to service_role;
grant select, insert, update, delete on table public.live_lab_paper_orders to service_role;
