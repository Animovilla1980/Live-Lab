-- Additive: no changes to Forebet, legacy alerts or Exchange software.
begin;
create table if not exists public.live_lab_ipg_picks (
  pick_key text primary key,
  strategy_id text not null check (strategy_id in ('634255','1110278','1110299')),
  picked_date date not null,
  payload jsonb not null,
  first_imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_lab_ipg_strategy_date on public.live_lab_ipg_picks(strategy_id,picked_date);
create table if not exists public.live_lab_ipg_imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  content_hash text not null,
  strategy_id text not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.live_lab_ipg_revisions (
  id uuid primary key default gen_random_uuid(),
  pick_key text not null references public.live_lab_ipg_picks(pick_key),
  payload jsonb not null,
  imported_at timestamptz not null default now()
);
create table if not exists public.live_lab_ipg_trades (
  pick_key text primary key references public.live_lab_ipg_picks(pick_key),
  outcome text not null check (outcome in ('WIN','LOSS','VOID','SKIP','OPEN')),
  exposure numeric check (exposure > 0),
  net_pl numeric,
  closed_at timestamptz,
  note text not null default '',
  updated_at timestamptz not null default now(),
  check ((outcome in ('OPEN','SKIP') and net_pl is null and closed_at is null) or (outcome in ('WIN','LOSS','VOID') and exposure is not null and net_pl is not null and closed_at is not null)),
  check (net_pl is null or net_pl >= -exposure)
);
create table if not exists public.live_lab_ipg_candidates (
  id uuid primary key default gen_random_uuid(),
  strategy text not null check (strategy in ('634255','1110278','1110299')),
  label text not null,
  filters jsonb not null,
  cutoff date not null,
  baseline jsonb not null,
  status text not null default 'CANDIDATE' check(status in ('OBSERVATION','CANDIDATE','VALIDATED','REJECTED')),
  created_at timestamptz not null default now()
);
alter table public.live_lab_ipg_picks enable row level security;
alter table public.live_lab_ipg_imports enable row level security;
alter table public.live_lab_ipg_revisions enable row level security;
alter table public.live_lab_ipg_trades enable row level security;
alter table public.live_lab_ipg_candidates enable row level security;
revoke all on public.live_lab_ipg_picks,public.live_lab_ipg_imports,public.live_lab_ipg_revisions,public.live_lab_ipg_trades,public.live_lab_ipg_candidates from public,anon,authenticated;
grant select,insert,update,delete on public.live_lab_ipg_picks,public.live_lab_ipg_imports,public.live_lab_ipg_revisions,public.live_lab_ipg_trades,public.live_lab_ipg_candidates to service_role;

-- One transaction for a multi-file import, with serialized duplicate handling.
create or replace function public.live_lab_ipg_import(files jsonb) returns jsonb
language plpgsql security invoker set search_path = public,pg_temp as $$
declare f jsonb; p jsonb; prior jsonb; reports jsonb := '[]';
  added integer; changed integer; unchanged integer; protected integer;
begin
  perform pg_advisory_xact_lock(719290013);
  for f in select value from jsonb_array_elements(files) loop
    added:=0;changed:=0;unchanged:=0;protected:=0;
    for p in select value from jsonb_array_elements(f->'picks') loop
      prior:=null;
      select payload into prior from public.live_lab_ipg_picks where pick_key=p->>'key';
      if prior is null then
        insert into public.live_lab_ipg_picks(pick_key,strategy_id,picked_date,payload)
        values(p->>'key',p->>'strategy',(p->>'date')::date,p);
        insert into public.live_lab_ipg_revisions(pick_key,payload) values(p->>'key',p);
        added:=added+1;
      elsif prior->>'strike' in ('WIN','LOSS') and p->>'strike'='PENDING' then
        protected:=protected+1;
      elsif (prior-'source') is distinct from (p-'source') then
        update public.live_lab_ipg_picks set payload=p,updated_at=now() where pick_key=p->>'key';
        insert into public.live_lab_ipg_revisions(pick_key,payload) values(p->>'key',p);
        changed:=changed+1;
      else
        unchanged:=unchanged+1;
      end if;
    end loop;
    reports:=reports||jsonb_build_array(jsonb_build_object('filename',f->>'name','added',added,'updated',changed,'unchanged',unchanged,'protected',protected));
    insert into public.live_lab_ipg_imports(filename,content_hash,strategy_id,report)
    values(f->>'name',f->>'hash',f->>'strategy',reports->-1);
  end loop;
  return reports;
end $$;
revoke all on function public.live_lab_ipg_import(jsonb) from public,anon,authenticated;
grant execute on function public.live_lab_ipg_import(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
