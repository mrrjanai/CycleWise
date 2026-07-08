-- =========================================================================
-- CycleWise — Migration 003: app-level PIN lock
-- Run in the Supabase SQL editor AFTER migration_002_onboarding.sql.
--
-- Note on "biometric": browsers can't trigger native Face ID/fingerprint
-- prompts without WebAuthn, which is a much bigger integration (device
-- key registration, etc). What's implemented here is a lightweight 4-digit
-- PIN gate that guards the app after login, on this device/browser. True
-- OS-level biometric unlock is a good candidate for a later native-app
-- pass (Expo has a straightforward `expo-local-authentication` API for it).
-- =========================================================================

alter table public.profiles
  add column if not exists app_pin_hash text,
  add column if not exists app_pin_enabled boolean not null default false;

comment on column public.profiles.app_pin_hash is
  'SHA-256 hash of the user''s 4-digit app-lock PIN. Never store the raw PIN.';
