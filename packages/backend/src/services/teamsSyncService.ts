import { isMicrosoftGraphEnabled } from '../lib/microsoftGraph';
import { collapseShiftsByEntraUserId } from '../lib/teamsShiftCollapse';
import {
  fetchTeamsShiftsForTerm,
  type TeamsShiftsSnapshot,
  type TeamsUserDto,
} from '../lib/teamsShiftsAdapter';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';
import { replaceScheduleBlocks } from './scheduleImportService';
import { studentAssistantService } from './studentAssistantService';
import { studentTimeOffService } from './studentTimeOffService';
import { teamsSyncStatusService } from './teamsSyncStatusService';
import { termService } from './termService';
import type { DraftScheduleBlock } from '../lib/scheduleImportTransform';

type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];
type StudentAssistantUpdate = Database['public']['Tables']['student_assistant']['Update'];
type Term = Database['public']['Tables']['academic_term']['Row'];
type TeamsSyncStatusRow = Database['public']['Tables']['teams_sync_status']['Row'];
type StudentTimeOffInsert = Database['public']['Tables']['student_time_off']['Insert'];

export type TeamsSyncRunStatus = 'success' | 'error' | 'not_configured';

export interface TeamsSyncStatusView {
  academic_term_id: number;
  graph_configured: boolean;
  status: TeamsSyncRunStatus | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  students_created: number;
  students_matched: number;
  students_deactivated: number;
  schedules_updated: number;
  total_blocks: number;
  remote_blocks: number;
  time_off_upserted: number;
  team_id: string | null;
  scheduling_group: string | null;
}

export interface TeamsSyncDependencies {
  isGraphEnabled: () => boolean;
  fetchSnapshot: typeof fetchTeamsShiftsForTerm;
  findByEntraUserId: typeof studentAssistantService.findByEntraUserId;
  findByWorkEmail: typeof studentAssistantService.findByWorkEmail;
  createStudent: typeof studentAssistantService.create;
  updateStudent: typeof studentAssistantService.update;
  listWithEntraUserId: typeof studentAssistantService.listWithEntraUserId;
  replaceScheduleBlocks: typeof replaceScheduleBlocks;
  replaceTimeOffForTerm: typeof studentTimeOffService.replaceForTerm;
  getTermById: typeof termService.getById;
  getActiveTerm: typeof termService.getActive;
  getStatusByTermId: typeof teamsSyncStatusService.getByTermId;
  upsertStatus: typeof teamsSyncStatusService.upsert;
  now?: Date;
}

const defaultDeps: TeamsSyncDependencies = {
  isGraphEnabled: isMicrosoftGraphEnabled,
  fetchSnapshot: fetchTeamsShiftsForTerm,
  findByEntraUserId: (id) => studentAssistantService.findByEntraUserId(id),
  findByWorkEmail: (email) => studentAssistantService.findByWorkEmail(email),
  createStudent: (payload) => studentAssistantService.create(payload),
  updateStudent: (id, payload) => studentAssistantService.update(id, payload),
  listWithEntraUserId: () => studentAssistantService.listWithEntraUserId(),
  replaceScheduleBlocks,
  replaceTimeOffForTerm: (termId, rows) =>
    studentTimeOffService.replaceForTerm(termId, rows),
  getTermById: (id) => termService.getById(id),
  getActiveTerm: () => termService.getActive(),
  getStatusByTermId: (termId) => teamsSyncStatusService.getByTermId(termId),
  upsertStatus: (payload) => teamsSyncStatusService.upsert(payload),
};

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function namesFromMember(member: TeamsUserDto): {
  firstName: string;
  lastName: string;
} {
  const given = emptyToNull(member.givenName);
  const surname = emptyToNull(member.surname);
  if (given || surname) {
    return { firstName: given ?? '', lastName: surname ?? '' };
  }

  const display = emptyToNull(member.displayName) ?? '';
  const spaceIndex = display.indexOf(' ');
  if (spaceIndex === -1) {
    return { firstName: display, lastName: '' };
  }
  return {
    firstName: display.slice(0, spaceIndex),
    lastName: display.slice(spaceIndex + 1).trim(),
  };
}

function workEmailFromMember(member: TeamsUserDto): string | null {
  return emptyToNull(member.mail) ?? emptyToNull(member.userPrincipalName);
}

function emptyStatusView(
  termId: number,
  graphConfigured: boolean,
): TeamsSyncStatusView {
  return {
    academic_term_id: termId,
    graph_configured: graphConfigured,
    status: graphConfigured ? null : 'not_configured',
    started_at: null,
    finished_at: null,
    error_message: null,
    students_created: 0,
    students_matched: 0,
    students_deactivated: 0,
    schedules_updated: 0,
    total_blocks: 0,
    remote_blocks: 0,
    time_off_upserted: 0,
    team_id: null,
    scheduling_group: null,
  };
}

function rowToView(
  row: TeamsSyncStatusRow,
  graphConfigured: boolean,
): TeamsSyncStatusView {
  const status: TeamsSyncRunStatus | null =
    row.status === 'success' || row.status === 'error' || row.status === 'not_configured'
      ? row.status
      : null;

  return {
    academic_term_id: row.academic_term_id,
    graph_configured: graphConfigured,
    status,
    started_at: row.started_at,
    finished_at: row.finished_at,
    error_message: row.error_message,
    students_created: row.students_created,
    students_matched: row.students_matched,
    students_deactivated: row.students_deactivated,
    schedules_updated: row.schedules_updated,
    total_blocks: row.total_blocks,
    remote_blocks: row.remote_blocks,
    time_off_upserted: row.time_off_upserted,
    team_id: row.team_id,
    scheduling_group: row.scheduling_group,
  };
}

async function persistStatus(
  deps: TeamsSyncDependencies,
  graphConfigured: boolean,
  payload: Database['public']['Tables']['teams_sync_status']['Insert'],
): Promise<TeamsSyncStatusView> {
  const row = await deps.upsertStatus(payload);
  return rowToView(row, graphConfigured);
}

async function upsertRosterStudent(
  member: TeamsUserDto,
  deps: TeamsSyncDependencies,
): Promise<{ student: StudentAssistant; action: 'create' | 'match' }> {
  const workEmail = workEmailFromMember(member);
  const { firstName, lastName } = namesFromMember(member);

  let existing = await deps.findByEntraUserId(member.entraUserId);
  if (!existing && workEmail) {
    existing = await deps.findByWorkEmail(workEmail);
  }

  if (existing) {
    const updates: StudentAssistantUpdate = { is_active: true };
    if (!existing.entra_user_id) {
      updates.entra_user_id = member.entraUserId;
    }
    if (!existing.first_name?.trim() && firstName) {
      updates.first_name = firstName;
    }
    if (!existing.last_name?.trim() && lastName) {
      updates.last_name = lastName;
    }
    if (!existing.work_email && workEmail) {
      updates.work_email = workEmail;
    }

    const updated = await deps.updateStudent(existing.id, updates);
    return { student: updated ?? existing, action: 'match' };
  }

  const created = await deps.createStudent({
    first_name: firstName || null,
    last_name: lastName || null,
    work_email: workEmail,
    entra_user_id: member.entraUserId,
    is_active: true,
    position: 'student_assistant',
  });

  return { student: created, action: 'create' };
}

async function applySnapshot(
  term: Term,
  snapshot: TeamsShiftsSnapshot,
  deps: TeamsSyncDependencies,
): Promise<Omit<TeamsSyncStatusView, 'academic_term_id' | 'graph_configured' | 'status' | 'started_at' | 'finished_at' | 'error_message' | 'team_id' | 'scheduling_group'> & {
  students_created: number;
  students_matched: number;
  students_deactivated: number;
  schedules_updated: number;
  total_blocks: number;
  remote_blocks: number;
  time_off_upserted: number;
}> {
  const now = deps.now ?? new Date();
  const templates = collapseShiftsByEntraUserId(snapshot.shifts, {
    now,
    remoteShiftsAllowed: term.remote_shifts_allowed ?? false,
  });

  const studentByEntraId = new Map<string, StudentAssistant>();
  let studentsCreated = 0;
  let studentsMatched = 0;
  let totalBlocks = 0;
  let remoteBlocks = 0;

  for (const member of snapshot.members) {
    const { student, action } = await upsertRosterStudent(member, deps);
    studentByEntraId.set(member.entraUserId, student);

    if (action === 'create') {
      studentsCreated += 1;
    } else {
      studentsMatched += 1;
    }

    const blocks: DraftScheduleBlock[] = templates.get(member.entraUserId) ?? [];
    await deps.replaceScheduleBlocks(student.id, term.id, blocks, false);
    totalBlocks += blocks.length;
    remoteBlocks += blocks.filter((block) => block.is_remote).length;
  }

  const rosterIds = new Set(snapshot.members.map((member) => member.entraUserId));
  const previouslySynced = await deps.listWithEntraUserId();
  let studentsDeactivated = 0;

  for (const student of previouslySynced) {
    const entraUserId = emptyToNull(student.entra_user_id);
    if (!entraUserId || rosterIds.has(entraUserId)) continue;
    if (student.is_active === false) continue;

    await deps.updateStudent(student.id, { is_active: false });
    studentsDeactivated += 1;
  }

  const timeOffRows: StudentTimeOffInsert[] = [];
  for (const timeOff of snapshot.timesOff) {
    const student = studentByEntraId.get(timeOff.entraUserId);
    if (!student) continue;

    timeOffRows.push({
      academic_term_id: term.id,
      student_assistant_id: student.id,
      starts_at: timeOff.startDateTime,
      ends_at: timeOff.endDateTime,
      teams_time_off_id: timeOff.id,
      time_off_reason: timeOff.timeOffReason,
    });
  }

  const upsertedTimeOff = await deps.replaceTimeOffForTerm(term.id, timeOffRows);

  return {
    students_created: studentsCreated,
    students_matched: studentsMatched,
    students_deactivated: studentsDeactivated,
    schedules_updated: snapshot.members.length,
    total_blocks: totalBlocks,
    remote_blocks: remoteBlocks,
    time_off_upserted: upsertedTimeOff.length,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Teams sync failed';
}

export const teamsSyncService = {
  async getStatus(
    termId: number,
    deps: TeamsSyncDependencies = defaultDeps,
  ): Promise<TeamsSyncStatusView> {
    const term = await deps.getTermById(termId);
    if (!term) {
      throw new HttpError(404, 'Academic term not found');
    }

    const graphConfigured = deps.isGraphEnabled();
    const row = await deps.getStatusByTermId(termId);
    if (!row) return emptyStatusView(termId, graphConfigured);
    return rowToView(row, graphConfigured);
  },

  async getActiveTermStatus(
    deps: TeamsSyncDependencies = defaultDeps,
  ): Promise<TeamsSyncStatusView> {
    const term = await deps.getActiveTerm();
    if (!term) {
      throw new HttpError(404, 'No active academic term');
    }
    return this.getStatus(term.id, deps);
  },

  async syncTerm(
    termId: number,
    deps: TeamsSyncDependencies = defaultDeps,
  ): Promise<TeamsSyncStatusView> {
    const term = await deps.getTermById(termId);
    if (!term) {
      throw new HttpError(404, 'Academic term not found');
    }

    const graphConfigured = deps.isGraphEnabled();
    const startedAt = (deps.now ?? new Date()).toISOString();

    if (!graphConfigured) {
      const view = await persistStatus(deps, false, {
        academic_term_id: termId,
        status: 'not_configured',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        error_message: null,
        students_created: 0,
        students_matched: 0,
        students_deactivated: 0,
        schedules_updated: 0,
        total_blocks: 0,
        remote_blocks: 0,
        time_off_upserted: 0,
        team_id: null,
        scheduling_group: null,
      });
      console.log(`Teams sync: Graph not configured (term ${termId})`);
      return view;
    }

    if (!term.start_date || !term.end_date) {
      throw new HttpError(400, 'Selected term is missing start or end date');
    }

    try {
      const snapshot = await deps.fetchSnapshot({
        startDate: term.start_date,
        endDate: term.end_date,
      });
      const counts = await applySnapshot(term, snapshot, deps);
      const view = await persistStatus(deps, true, {
        academic_term_id: termId,
        status: 'success',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        error_message: null,
        ...counts,
        team_id: snapshot.teamId,
        scheduling_group: snapshot.schedulingGroupName,
      });

      console.log(
        `Teams sync: term ${termId} created ${counts.students_created}, ` +
          `matched ${counts.students_matched}, deactivated ${counts.students_deactivated}, ` +
          `${counts.total_blocks} blocks, ${counts.time_off_upserted} time-off rows`,
      );

      return view;
    } catch (err) {
      await persistStatus(deps, true, {
        academic_term_id: termId,
        status: 'error',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        error_message: errorMessage(err),
        students_created: 0,
        students_matched: 0,
        students_deactivated: 0,
        schedules_updated: 0,
        total_blocks: 0,
        remote_blocks: 0,
        time_off_upserted: 0,
        team_id: null,
        scheduling_group: null,
      });
      throw err;
    }
  },

  async syncActiveTerm(
    deps: TeamsSyncDependencies = defaultDeps,
  ): Promise<TeamsSyncStatusView | null> {
    const term = await deps.getActiveTerm();
    if (!term) return null;
    return this.syncTerm(term.id, deps);
  },
};
