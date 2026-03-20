-- DailyKpiEntry contract for presidential-performance-hub.
-- Idempotency: unique constraint on (userId, teamId, entryDate, source)

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'KpiDataSource') then
    create type "KpiDataSource" as enum ('AIRCALL', 'MANUAL', 'IMPORT', 'SYSTEM');
  end if;
end $$;

create table if not exists public."DailyKpiEntry" (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null,
  "teamId" text not null,
  "entryDate" date not null,
  source "KpiDataSource" not null default 'AIRCALL',
  dials int not null default 0,
  "talkTimeMinutes" int not null default 0,
  "inboundTalkTimeMinutes" int not null default 0,
  "outboundTalkTimeMinutes" int not null default 0,
  "offersMade" int,
  "contractsSigned" int,
  "rawPayload" jsonb,
  "externalRef" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "DailyKpiEntry_userId_teamId_entryDate_source_key"
    unique ("userId", "teamId", "entryDate", source)
);

-- Maintain updatedAt on UPDATE.
create or replace function public.set_daily_kpi_entry_updated_at()
returns trigger as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_daily_kpi_entry_updated_at on public."DailyKpiEntry";
create trigger trg_daily_kpi_entry_updated_at
before update on public."DailyKpiEntry"
for each row
execute function public.set_daily_kpi_entry_updated_at();

