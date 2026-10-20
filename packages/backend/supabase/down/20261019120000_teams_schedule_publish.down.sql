-- revision: 20261019120000 (down)
-- depends-on: 20261019100000
-- apply: Supabase SQL editor (Dashboard → SQL) or `supabase db query --linked -f <this-file>`
--   Rollback: newest-first (this file first). Do not db push.
-- up: ../migrations/20261019120000_teams_schedule_publish.sql
--
-- WARNING: Drops the history of sends to Teams. Shifts already in Teams are not touched.

drop table if exists public.teams_schedule_publish;

notify pgrst, 'reload schema';
