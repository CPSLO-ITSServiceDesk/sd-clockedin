-- revision: 20261002100000 (down)
-- depends-on: none
-- apply: Supabase SQL editor (Dashboard → SQL) or `supabase db query --linked -f <this-file>`
--   Rollback: newest-first (20261002110000 down, then this file). Do not db push.
-- up: ../migrations/20261002100000_student_entra_user_id_and_time_off.sql
--
-- WARNING: Drops all Teams-synced student_time_off rows and the
-- student_assistant.entra_user_id mapping (unique constraint included).
-- time_entry and schedules are not modified.

-- Teams Shifts identity + per-student time off (not academic_term.off_days).

drop table if exists public.student_time_off;

alter table if exists public.student_assistant
  drop constraint if exists student_assistant_entra_user_id_key;

alter table if exists public.student_assistant
  drop column if exists entra_user_id;

notify pgrst, 'reload schema';
