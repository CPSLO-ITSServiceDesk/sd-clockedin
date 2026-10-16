-- revision: 20261016100000 (down)
-- depends-on: 20261002110000
-- apply: Supabase SQL editor (Dashboard → SQL) or `supabase db query --linked -f <this-file>`
--   Rollback: newest-first (this file first). Do not db push.
-- up: ../migrations/20261016100000_timesheet_verification.sql
--
-- WARNING: Drops all timesheet_verification rows (which months were verified).
-- time_entry and schedules are not modified.

drop table if exists public.timesheet_verification;

notify pgrst, 'reload schema';
