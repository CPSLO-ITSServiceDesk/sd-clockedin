-- revision: 20261002110000
-- depends-on: 20261002100000
-- apply: Supabase SQL editor (Dashboard → SQL) or `supabase db query --linked -f <this-file>`
--   Forward: timestamp order (20261002100000, then this file).
-- down: ../down/20261002110000_teams_sync_status.down.sql
--   Rollback: newest-first (do not db push *.down.sql).

-- Last Teams Shifts sync result per academic term (admin UI + multi-instance).

create table if not exists public.teams_sync_status (
  academic_term_id integer primary key
    references public.academic_term (id) on delete cascade,
  status text not null,
  started_at timestamp with time zone,
  finished_at timestamp with time zone not null default now(),
  error_message text,
  students_created integer not null default 0,
  students_matched integer not null default 0,
  students_deactivated integer not null default 0,
  schedules_updated integer not null default 0,
  total_blocks integer not null default 0,
  remote_blocks integer not null default 0,
  time_off_upserted integer not null default 0,
  team_id text,
  scheduling_group text,
  created_at timestamp with time zone not null default now(),
  constraint teams_sync_status_status_check
    check (status in ('success', 'error', 'not_configured'))
);

comment on table public.teams_sync_status is
  'Latest Teams Shifts sync outcome for a term (one row per term, upserted each run).';

grant select, insert, update, delete on table public.teams_sync_status
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
