-- revision: 20261002110000 (down)
-- depends-on: 20261002100000
-- apply: Supabase SQL editor (Dashboard → SQL) or `supabase db query --linked -f <this-file>`
--   Rollback: newest-first (this file, then 20261002100000 down). Do not db push.
-- up: ../migrations/20261002110000_teams_sync_status.sql
--
-- WARNING: Drops all teams_sync_status rows (last Teams sync result per term).
-- time_entry, schedules, student_time_off, and entra_user_id are not modified.

-- Last Teams Shifts sync result per academic term (admin UI + multi-instance).

drop table if exists public.teams_sync_status;

notify pgrst, 'reload schema';
