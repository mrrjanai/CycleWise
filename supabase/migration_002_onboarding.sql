-- =========================================================================
-- CycleWise — Migration 002: onboarding support
-- Run this in the Supabase SQL editor AFTER the original schema.sql.
-- =========================================================================

alter table public.profiles
  add column if not exists cycle_regularity text
    check (cycle_regularity in ('regular', 'irregular'));

comment on column public.profiles.cycle_regularity is
  'Self-reported from onboarding: whether the user considers their cycles regular or irregular.';

-- profiles.onboarding_complete already exists from schema.sql and is used
-- to decide whether to route a signed-in user to /onboarding or /dashboard.
