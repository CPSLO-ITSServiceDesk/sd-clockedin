-- revision: 20261019100000 (down)
-- depends-on: 20261016100000
-- apply: Supabase SQL editor (Dashboard → SQL) or `supabase db query --linked -f <this-file>`
--   Rollback: newest-first (this file first). Do not db push.
-- up: ../migrations/20261019100000_schedule_draft.sql
--
-- WARNING: Drops all schedule drafts (availability, rules and unpublished shifts).
-- Published schedules and schedule_blocks are not modified.

drop table if exists public.schedule_draft;

notify pgrst, 'reload schema';
