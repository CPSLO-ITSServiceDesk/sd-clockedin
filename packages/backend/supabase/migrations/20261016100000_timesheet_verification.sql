-- revision: 20261016100000
-- depends-on: 20261002110000
-- apply: Supabase SQL editor (Dashboard → SQL) or `supabase db query --linked -f <this-file>`
--   Forward: timestamp order (20261002110000, then this file).
-- down: ../down/20261016100000_timesheet_verification.down.sql
--   Rollback: newest-first (do not db push *.down.sql).

-- Admin sign-off that a student's timesheet for a calendar month has been checked.

create table if not exists public.timesheet_verification (
  student_assistant_id integer not null
    references public.student_assistant (id) on delete cascade,
  -- First day of the verified calendar month (YYYY-MM-01).
  month date not null,
  verified_at timestamp with time zone not null default now(),
  verified_by text,
  primary key (student_assistant_id, month),
  constraint timesheet_verification_month_first_day_check
    check (extract(day from month) = 1)
);

comment on table public.timesheet_verification is
  'One row per student and month an admin marked their timesheet verified; deleting the row un-verifies it.';

grant select, insert, update, delete on table public.timesheet_verification
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
