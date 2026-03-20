-- Create table for daily phone KPIs synced from Aircall.
-- Idempotency: unique constraint on (entry_date, rep_name, team, source)

create extension if not exists pgcrypto;

create table if not exists public.daily_phone_kpis (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  rep_name text not null,
  user_id text,
  team text not null,
  source text not null default 'aircall',
  dials int not null default 0,
  talk_time_minutes int not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_phone_kpis_unique
    unique (entry_date, rep_name, team, source)
);

-- Maintain updated_at on UPDATE.
create or replace function public.set_daily_phone_kpis_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_daily_phone_kpis_updated_at on public.daily_phone_kpis;
create trigger trg_daily_phone_kpis_updated_at
before update on public.daily_phone_kpis
for each row
execute function public.set_daily_phone_kpis_updated_at();

