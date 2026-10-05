alter table public.live_lab_paper_trades add column if not exists plan_json jsonb not null default '{}'::jsonb;
alter table public.live_lab_paper_trades add column if not exists course_strategy text;

alter table public.live_lab_paper_orders add column if not exists market_type text;
alter table public.live_lab_paper_orders add column if not exists market_name text;
alter table public.live_lab_paper_orders add column if not exists market_id text;
alter table public.live_lab_paper_orders add column if not exists selection_id text;
alter table public.live_lab_paper_orders add column if not exists selection_name text;
alter table public.live_lab_paper_orders add column if not exists side text not null default 'BACK';
alter table public.live_lab_paper_orders add column if not exists role text;

create index if not exists live_lab_paper_orders_trade_role_idx on public.live_lab_paper_orders(trade_id, role);
