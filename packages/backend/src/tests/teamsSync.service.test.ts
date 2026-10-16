import cron from 'node-cron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleTeamsSync } from '../jobs/teamsSync';
import * as microsoftGraph from '../lib/microsoftGraph';
import { HttpError } from '../middleware/errorHandler';
import {
  teamsSyncService,
  type TeamsSyncDependencies,
  type TeamsSyncStatusView,
} from '../services/teamsSyncService';
import type { TeamsShiftsSnapshot, TeamsUserDto } from '../lib/teamsShiftsAdapter';
import type { Database } from '../types/database.types';

type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];
type Term = Database['public']['Tables']['academic_term']['Row'];
type TeamsSyncStatusRow = Database['public']['Tables']['teams_sync_status']['Row'];

const TERM_ID = 7;
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const USER_LEFT = '33333333-3333-3333-3333-333333333333';

const term: Term = {
  id: TERM_ID,
  name: 'Summer 2026',
  start_date: '2026-06-22',
  end_date: '2026-08-28',
  is_active: true,
  remote_shifts_allowed: true,
  off_days: null,
  created_at: '2026-06-01T00:00:00.000Z',
};

function student(overrides: Partial<StudentAssistant> & Pick<StudentAssistant, 'id'>): StudentAssistant {
  return {
    created_at: '2026-01-01T00:00:00.000Z',
    entra_user_id: null,
    first_name: 'Ada',
    last_name: 'Lovelace',
    is_active: true,
    polycard_id: 9001,
    position: 'student_lead',
    work_email: 'ada@calpoly.edu',
    ...overrides,
  };
}

function member(overrides: Partial<TeamsUserDto> & Pick<TeamsUserDto, 'entraUserId'>): TeamsUserDto {
  return {
    mail: 'ada@calpoly.edu',
    userPrincipalName: 'ada@calpoly.edu',
    displayName: 'Ada Lovelace',
    givenName: 'Ada',
    surname: 'Lovelace',
    ...overrides,
  };
}

function snapshot(overrides: Partial<TeamsShiftsSnapshot> = {}): TeamsShiftsSnapshot {
  return {
    teamId: 'team-1',
    schedulingGroupId: 'group-1',
    schedulingGroupName: 'Service Desk',
    timeZone: 'America/Los_Angeles',
    members: [
      member({ entraUserId: USER_A }),
      member({
        entraUserId: USER_B,
        mail: 'ben@calpoly.edu',
        userPrincipalName: 'ben@calpoly.edu',
        displayName: 'Ben Bitdiddle',
        givenName: 'Ben',
        surname: 'Bitdiddle',
      }),
    ],
    shifts: [
      {
        id: 'shift-a',
        entraUserId: USER_A,
        schedulingGroupId: 'group-1',
        startDateTime: '2026-06-22T15:00:00.000Z',
        endDateTime: '2026-06-22T18:00:00.000Z',
        theme: 'green',
        displayName: 'Morning',
        localStartDate: '2026-06-22',
        localStartTime: '08:00',
        localEndDate: '2026-06-22',
        localEndTime: '11:00',
        isRemote: false,
      },
    ],
    timesOff: [
      {
        id: 'pto-a',
        entraUserId: USER_A,
        startDateTime: '2026-07-01T07:00:00.000Z',
        endDateTime: '2026-07-03T07:00:00.000Z',
        timeOffReasonId: 'vacation',
        timeOffReason: 'Vacation',
        displayName: 'Vacation',
        localStartDate: '2026-07-01',
        localStartTime: '00:00',
        localEndDate: '2026-07-03',
        localEndTime: '00:00',
      },
    ],
    ...overrides,
  };
}

function createDeps(options?: {
  graphEnabled?: boolean;
  students?: StudentAssistant[];
  snapshot?: TeamsShiftsSnapshot;
  fetchError?: Error;
}): {
  deps: TeamsSyncDependencies;
  students: StudentAssistant[];
  replaceBlocks: ReturnType<typeof vi.fn>;
  replaceTimeOff: ReturnType<typeof vi.fn>;
  stored: TeamsSyncStatusRow[];
} {
  let nextId = 100;
  const students = [...(options?.students ?? [])];
  const stored: TeamsSyncStatusRow[] = [];
  const replaceBlocks = vi.fn().mockResolvedValue(undefined);
  const replaceTimeOff = vi.fn().mockImplementation(async (_termId: number, rows: unknown[]) => rows);

  const deps: TeamsSyncDependencies = {
    isGraphEnabled: () => options?.graphEnabled ?? true,
    fetchSnapshot: vi.fn().mockImplementation(async () => {
      if (options?.fetchError) throw options.fetchError;
      return options?.snapshot ?? snapshot();
    }),
    findByEntraUserId: async (entraUserId) =>
      students.find((row) => row.entra_user_id === entraUserId) ?? null,
    findByWorkEmail: async (workEmail) => {
      const needle = workEmail.trim().toLowerCase();
      return (
        students.find((row) => row.work_email?.toLowerCase() === needle) ?? null
      );
    },
    createStudent: async (payload) => {
      const created = student({
        id: nextId,
        first_name: payload.first_name ?? null,
        last_name: payload.last_name ?? null,
        work_email: payload.work_email ?? null,
        entra_user_id: payload.entra_user_id ?? null,
        is_active: payload.is_active ?? true,
        position: payload.position,
        polycard_id: payload.polycard_id ?? null,
      });
      nextId += 1;
      students.push(created);
      return created;
    },
    updateStudent: async (id, payload) => {
      const index = students.findIndex((row) => row.id === id);
      if (index === -1) return null;
      students[index] = { ...students[index], ...payload };
      return students[index];
    },
    listWithEntraUserId: async () => students.filter((row) => row.entra_user_id),
    replaceScheduleBlocks: replaceBlocks,
    replaceTimeOffForTerm: replaceTimeOff,
    getTermById: async (id) => (id === TERM_ID ? term : null),
    getActiveTerm: async () => term,
    getStatusByTermId: async (academicTermId) =>
      stored.find((row) => row.academic_term_id === academicTermId) ?? null,
    upsertStatus: async (payload) => {
      const row: TeamsSyncStatusRow = {
        academic_term_id: payload.academic_term_id,
        created_at: '2026-06-22T00:00:00.000Z',
        error_message: payload.error_message ?? null,
        finished_at: payload.finished_at ?? new Date().toISOString(),
        remote_blocks: payload.remote_blocks ?? 0,
        scheduling_group: payload.scheduling_group ?? null,
        schedules_updated: payload.schedules_updated ?? 0,
        started_at: payload.started_at ?? null,
        status: payload.status,
        students_created: payload.students_created ?? 0,
        students_deactivated: payload.students_deactivated ?? 0,
        students_matched: payload.students_matched ?? 0,
        team_id: payload.team_id ?? null,
        time_off_upserted: payload.time_off_upserted ?? 0,
        total_blocks: payload.total_blocks ?? 0,
      };
      const index = stored.findIndex((item) => item.academic_term_id === row.academic_term_id);
      if (index >= 0) stored[index] = row;
      else stored.push(row);
      return row;
    },
    now: new Date('2026-06-22T17:00:00.000Z'),
  };

  return { deps, students, replaceBlocks, replaceTimeOff, stored };
}

describe('teamsSyncService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates missing roster students and matches by entra_user_id then work_email', async () => {
    const existingByEmail = student({
      id: 1,
      entra_user_id: null,
      first_name: 'Ada',
      last_name: 'Lovelace',
      work_email: 'ada@calpoly.edu',
      polycard_id: 9001,
      position: 'student_lead',
    });
    const { deps, students, replaceBlocks, replaceTimeOff } = createDeps({
      students: [existingByEmail],
    });

    const result = await teamsSyncService.syncTerm(TERM_ID, deps);

    expect(result.status).toBe('success');
    expect(result.students_created).toBe(1);
    expect(result.students_matched).toBe(1);
    expect(students.find((row) => row.id === 1)).toMatchObject({
      entra_user_id: USER_A,
      first_name: 'Ada',
      last_name: 'Lovelace',
      polycard_id: 9001,
      position: 'student_lead',
      is_active: true,
    });
    expect(students.find((row) => row.entra_user_id === USER_B)).toMatchObject({
      first_name: 'Ben',
      last_name: 'Bitdiddle',
      work_email: 'ben@calpoly.edu',
      position: 'student_assistant',
      is_active: true,
      polycard_id: null,
    });
    expect(replaceBlocks).toHaveBeenCalledTimes(2);
    expect(replaceTimeOff).toHaveBeenCalledWith(
      TERM_ID,
      expect.arrayContaining([
        expect.objectContaining({
          teams_time_off_id: 'pto-a',
          student_assistant_id: 1,
        }),
      ]),
    );
  });

  it('matches entra_user_id before work_email when they point at different students', async () => {
    const entraMatch = student({
      id: 1,
      entra_user_id: USER_A,
      first_name: 'Ada',
      last_name: 'Entra',
      work_email: 'other@calpoly.edu',
      polycard_id: 111,
    });
    const emailOnly = student({
      id: 2,
      entra_user_id: null,
      first_name: 'Ada',
      last_name: 'Email',
      work_email: 'ada@calpoly.edu',
      polycard_id: 222,
    });
    const { deps, students } = createDeps({
      students: [entraMatch, emailOnly],
      snapshot: snapshot({
        members: [member({ entraUserId: USER_A, mail: 'ada@calpoly.edu' })],
        timesOff: [],
      }),
    });

    await teamsSyncService.syncTerm(TERM_ID, deps);

    expect(students.find((row) => row.id === 1)).toMatchObject({
      entra_user_id: USER_A,
      polycard_id: 111,
      is_active: true,
    });
    expect(students.find((row) => row.id === 2)).toMatchObject({
      entra_user_id: null,
      polycard_id: 222,
      work_email: 'ada@calpoly.edu',
    });
  });

  it('reactivates a previously deactivated Teams student without overwriting polycard', async () => {
    const returning = student({
      id: 1,
      entra_user_id: USER_A,
      is_active: false,
      polycard_id: 9001,
      position: 'student_lead',
    });
    const { deps, students } = createDeps({
      students: [returning],
      snapshot: snapshot({
        members: [member({ entraUserId: USER_A })],
        timesOff: [],
      }),
    });

    await teamsSyncService.syncTerm(TERM_ID, deps);

    expect(students[0]).toMatchObject({
      is_active: true,
      polycard_id: 9001,
      position: 'student_lead',
    });
  });

  it('does not overwrite existing names or polycard, but fills empty names', async () => {
    const existing = student({
      id: 1,
      entra_user_id: USER_A,
      first_name: '',
      last_name: 'Existing',
      polycard_id: 4242,
      position: 'student_lead',
      work_email: 'old@calpoly.edu',
    });
    const { deps, students } = createDeps({
      students: [existing],
      snapshot: snapshot({
        members: [
          member({
            entraUserId: USER_A,
            givenName: 'Ada',
            surname: 'Lovelace',
          }),
        ],
        timesOff: [],
      }),
    });

    await teamsSyncService.syncTerm(TERM_ID, deps);

    expect(students[0]).toMatchObject({
      first_name: 'Ada',
      last_name: 'Existing',
      polycard_id: 4242,
      position: 'student_lead',
      work_email: 'old@calpoly.edu',
    });
  });

  it('deactivates previously synced students missing from the roster and leaves spreadsheet-only students alone', async () => {
    const rosterStay = student({
      id: 1,
      entra_user_id: USER_A,
      work_email: 'ada@calpoly.edu',
    });
    const leftGroup = student({
      id: 2,
      entra_user_id: USER_LEFT,
      first_name: 'Cara',
      last_name: 'Compiler',
      work_email: 'cara@calpoly.edu',
      is_active: true,
    });
    const spreadsheetOnly = student({
      id: 3,
      entra_user_id: null,
      first_name: 'Dana',
      last_name: 'Desk',
      work_email: 'dana@calpoly.edu',
      is_active: true,
      polycard_id: null,
      position: 'student_assistant',
    });
    const { deps, students } = createDeps({
      students: [rosterStay, leftGroup, spreadsheetOnly],
      snapshot: snapshot({
        members: [member({ entraUserId: USER_A })],
        timesOff: [],
      }),
    });

    const result = await teamsSyncService.syncTerm(TERM_ID, deps);

    expect(result.students_deactivated).toBe(1);
    expect(students.find((row) => row.id === 2)?.is_active).toBe(false);
    expect(students.find((row) => row.id === 3)?.is_active).toBe(true);
    expect(students.find((row) => row.id === 1)?.is_active).toBe(true);
  });

  it('records not_configured without fetching when Graph is disabled', async () => {
    const { deps } = createDeps({ graphEnabled: false });
    const result = await teamsSyncService.syncTerm(TERM_ID, deps);

    expect(result.status).toBe('not_configured');
    expect(result.graph_configured).toBe(false);
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
  });

  it('returns not_configured for GET when Graph is disabled and no sync has run', async () => {
    const { deps } = createDeps({ graphEnabled: false });
    const status: TeamsSyncStatusView = await teamsSyncService.getStatus(TERM_ID, deps);

    expect(status).toMatchObject({
      academic_term_id: TERM_ID,
      graph_configured: false,
      status: 'not_configured',
      finished_at: null,
    });
  });

  it('does not schedule cron or throw when Graph is unconfigured', () => {
    vi.spyOn(microsoftGraph, 'isMicrosoftGraphEnabled').mockReturnValue(false);
    const scheduleSpy = vi.spyOn(cron, 'schedule');

    expect(() => scheduleTeamsSync()).not.toThrow();
    expect(scheduleSpy).not.toHaveBeenCalled();
  });

  it('persists an error status when the adapter throws', async () => {
    const { deps, stored } = createDeps({
      fetchError: new Error('Teams schedule is not provisioned'),
    });

    await expect(teamsSyncService.syncTerm(TERM_ID, deps)).rejects.toThrow(
      'Teams schedule is not provisioned',
    );
    expect(stored[0]).toMatchObject({
      status: 'error',
      error_message: 'Teams schedule is not provisioned',
    });
  });

  it('returns a never-synced status for GET when no row exists', async () => {
    const { deps } = createDeps();
    const status: TeamsSyncStatusView = await teamsSyncService.getStatus(TERM_ID, deps);
    expect(status).toMatchObject({
      academic_term_id: TERM_ID,
      graph_configured: true,
      status: null,
      finished_at: null,
    });
  });

  it('throws 404 when the term does not exist', async () => {
    const { deps } = createDeps();
    await expect(teamsSyncService.getStatus(999, deps)).rejects.toBeInstanceOf(HttpError);
  });
});
