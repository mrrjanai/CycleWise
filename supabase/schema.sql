-- =========================================================================
-- CycleWise — Supabase Schema + Row Level Security
-- Postgres 15 / Supabase
--
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Assumes `auth.users` already exists (managed by Supabase Auth).
-- =========================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_stat_statements";

-- -------------------------------------------------------------------------
-- 1. PROFILES  (1:1 extension of auth.users — never store PII in auth.users)
-- -------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text,
  date_of_birth       date,
  avg_cycle_length    smallint not null default 28 check (avg_cycle_length between 15 and 60),
  avg_period_length   smallint not null default 5  check (avg_period_length between 1 and 14),
  tracking_goal       text not null default 'general' check (tracking_goal in ('general','conceive','avoid_pregnancy','contraception')),
  luteal_phase_length smallint not null default 14 check (luteal_phase_length between 8 and 20),
  units                jsonb not null default '{"temp":"celsius","weight":"kg"}',
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.profiles is 'Extended user profile. Row created automatically on signup via trigger.';

-- -------------------------------------------------------------------------
-- 2. CYCLES — one row per menstrual cycle (starts the day bleeding starts)
-- -------------------------------------------------------------------------
create table public.cycles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  start_date      date not null,
  end_date        date,                       -- last day of bleeding (nullable while ongoing)
  cycle_length    smallint,                    -- computed once the NEXT cycle starts
  period_length   smallint,                    -- computed from start/end
  is_predicted    boolean not null default false,  -- true for auto-generated future cycles
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint end_after_start check (end_date is null or end_date >= start_date)
);

create index cycles_user_start_idx on public.cycles (user_id, start_date desc);

-- -------------------------------------------------------------------------
-- 3. DAILY LOGS — flexible per-day entries (symptoms, mood, flow, activity, BBT…)
--    One row per user per date; all variable data lives in JSONB for flexibility
-- -------------------------------------------------------------------------
create table public.daily_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  log_date            date not null,
  flow_intensity      text check (flow_intensity in ('none','spotting','light','medium','heavy')),
  symptoms            jsonb not null default '[]',   -- e.g. ["cramps","bloating","headache"]
  mood                jsonb not null default '[]',   -- e.g. ["happy","anxious"]
  sexual_activity      jsonb,                          -- { "occurred": true, "protection": "none|condom|other" }
  basal_body_temp     numeric(4,2),                   -- e.g. 36.62 (Celsius)
  cervical_mucus      text check (cervical_mucus in ('dry','sticky','creamy','watery','egg_white')),
  medications         jsonb not null default '[]',   -- [{ "name": "...", "dose": "...", "time": "..." }]
  tests                jsonb not null default '[]',   -- [{ "type": "ovulation|pregnancy", "result": "positive|negative" }]
  weight              numeric(5,2),
  notes                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, log_date)
);

create index daily_logs_user_date_idx on public.daily_logs (user_id, log_date desc);

-- -------------------------------------------------------------------------
-- 4. SETTINGS / PREFERENCES (app-level, notifications, privacy)
-- -------------------------------------------------------------------------
create table public.settings (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  reminders_enabled       boolean not null default true,
  reminder_period_days_before smallint not null default 2,
  reminder_ovulation      boolean not null default true,
  reminder_pill_time      time,
  privacy_lock_enabled    boolean not null default false,   -- app-level PIN/biometric lock
  data_sharing_opt_in     boolean not null default false,   -- anonymized research opt-in
  theme                   text not null default 'system' check (theme in ('system','light','dark')),
  updated_at              timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 5. TRIGGERS — auto-create profile/settings row, maintain updated_at,
--    and derive cycle_length/period_length automatically
-- -------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(new.email, '@', 1));
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_cycles_updated before update on public.cycles
  for each row execute function public.set_updated_at();
create trigger trg_daily_logs_updated before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- When a new cycle's start_date is inserted, backfill the PREVIOUS cycle's
-- cycle_length so historical averages stay accurate.
create or replace function public.backfill_previous_cycle_length()
returns trigger language plpgsql as $$
declare
  prev_id uuid;
  prev_start date;
begin
  select id, start_date into prev_id, prev_start
  from public.cycles
  where user_id = new.user_id and start_date < new.start_date
  order by start_date desc
  limit 1;

  if prev_id is not null then
    update public.cycles
    set cycle_length = (new.start_date - prev_start)
    where id = prev_id;
  end if;

  return new;
end;
$$;

create trigger trg_backfill_cycle_length
  after insert on public.cycles
  for each row execute function public.backfill_previous_cycle_length();

-- -------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY — every table: users can only touch their own rows
-- -------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.cycles     enable row level security;
alter table public.daily_logs enable row level security;
alter table public.settings   enable row level security;

-- Force RLS even for the table owner role (defense in depth)
alter table public.profiles   force row level security;
alter table public.cycles     force row level security;
alter table public.daily_logs force row level security;
alter table public.settings   force row level security;

-- profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
-- no insert/delete policy: rows are created only by the trigger (security definer)

-- cycles
create policy "cycles_select_own" on public.cycles for select using (auth.uid() = user_id);
create policy "cycles_insert_own" on public.cycles for insert with check (auth.uid() = user_id);
create policy "cycles_update_own" on public.cycles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cycles_delete_own" on public.cycles for delete using (auth.uid() = user_id);

-- daily_logs
create policy "logs_select_own" on public.daily_logs for select using (auth.uid() = user_id);
create policy "logs_insert_own" on public.daily_logs for insert with check (auth.uid() = user_id);
create policy "logs_update_own" on public.daily_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "logs_delete_own" on public.daily_logs for delete using (auth.uid() = user_id);

-- settings
create policy "settings_select_own" on public.settings for select using (auth.uid() = user_id);
create policy "settings_update_own" on public.settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- 7. NOTES ON ENCRYPTION AT REST
-- -------------------------------------------------------------------------
-- Supabase/Postgres encrypts the underlying disk (AES-256) by default, which
-- covers "encryption at rest" for the whole database. For an extra layer on
-- specific highly-sensitive columns (e.g. free-text notes), you can use
-- pgsodium / Supabase Vault to store column-level encrypted values:
--
--   select vault.create_secret('column-encryption-key', 'cyclewise_notes_key');
--
-- and encrypt/decrypt notes via `pgsodium.crypto_secretbox` in a security-
-- definer function, decrypting only for the requesting user. This is
-- optional — RLS + disk encryption + TLS in transit is sufficient for most
-- deployments — but is documented here for teams with stricter compliance
-- needs (e.g. HIPAA-adjacent).
