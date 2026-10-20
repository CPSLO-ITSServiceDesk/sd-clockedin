import { config } from '../config/environment';
import { getGraphWriteClient, isMicrosoftGraphEnabled, type GraphWriteClient } from '../lib/microsoftGraph';
import { getOrgLocalDateString, getOrgLocalInstant, getOrgLocalMinutes } from '../lib/orgTime';
import { assignedRoleRuns } from '../lib/scheduleBuilder/model';
import { supabase } from '../lib/supabase';
import {
  TEAMS_THEME,
  addCalendarDays,
  expandWeeklyShifts,
  planShiftChanges,
  type DesiredShift,
  type ExistingTeamsShift,
  type TeamsShiftPlan,
  type WeeklyShift,
  mondayOf,
} from '../lib/teamsShiftPlan';
import { assertScheduleProvisioned, selectSchedulingGroup, type GraphSchedule, type GraphSchedulingGroup } from '../lib/teamsShiftsAdapter';
import { timeToMinutes } from '../lib/time';
import { parseOffDays } from '../lib/timeOffCoverage';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';
import { scheduleDraftService } from './scheduleDraftService';
import { studentAssistantService } from './studentAssistantService';
import { termService } from './termService';

type Term = Database['public']['Tables']['academic_term']['Row'];
type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];
type Weekday = Database['public']['Enums']['days'];
type PublishRow = Database['public']['Tables']['teams_schedule_publish']['Row'];

const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01']);
/** Parallel Graph writes; Shifts throttles bursts. */
const WRITE_CONCURRENCY = 4;

export interface PublishRange {
  fromDate: string;
  toDate: string;
}

/** One weekly shift as the 14.5 editor sends it. */
export interface PersonWeeklyShiftInput {
  day: Weekday;
  start_time: string;
  end_time: string;
  role?: 'L' | 'm' | 't';
}

export interface TeamsPublishPreview {
  range: PublishRange;
  scheduling_group: string;
  people: number;
  /** Students in scope with no linked Teams account; their shifts can't be sent. */
  missing_teams: { id: number; name: string }[];
  skipped_dates: { date: string; label?: string }[];
  create: number;
  keep: number;
  remove: number;
  restore: number;
  hours_added: number;
  hours_removed: number;
}

export interface TeamsPublishResult extends TeamsPublishPreview {
  failed: { action: string; message: string }[];
  /** Students whose shifts changed. */
  students_affected: number;
}

export interface TeamsPersonPattern {
  /** Monday of the week the pattern was read from, or null if none was found. */
  week_of: string | null;
  shifts: (PersonWeeklyShiftInput & { remote: boolean })[];
  linked: boolean;
}

/** How far back to look for a week that already has the person's shifts in Teams. */
const PATTERN_LOOKBACK_WEEKS = 4;

export interface TeamsPublishVersion {
  id: number;
  kind: 'term' | 'person';
  student_name: string | null;
  from_date: string;
  to_date: string;
  created_count: number;
  kept_count: number;
  removed_count: number;
  failed_count: number;
  summary: string;
  created_at: string;
}

interface TeamsContext {
  client: GraphWriteClient;
  teamId: string;
  groupId: string;
  groupName: string;
  rosterIds: Set<string>;
  term: Term;
}

interface PlanForPeople {
  ctx: TeamsContext;
  range: PublishRange;
  plan: TeamsShiftPlan;
  desired: DesiredShift[];
  existing: Map<string, ExistingTeamsShift>;
  preview: TeamsPublishPreview;
}

function studentName(student: Pick<StudentAssistant, 'first_name' | 'last_name' | 'id'>): string {
  return [student.first_name, student.last_name].filter(Boolean).join(' ') || `Student #${student.id}`;
}

function hours(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / 3_600_000;
}

function clampRange(range: PublishRange, term: Term): PublishRange {
  if (!term.start_date || !term.end_date) throw new HttpError(400, 'Set the term start and end dates first');
  const fromDate = range.fromDate > term.start_date ? range.fromDate : term.start_date;
  const toDate = range.toDate < term.end_date ? range.toDate : term.end_date;
  if (fromDate > toDate) throw new HttpError(400, 'The selected weeks are outside the term');
  return { fromDate, toDate };
}

async function loadContext(termId: number): Promise<TeamsContext> {
  if (!isMicrosoftGraphEnabled()) {
    throw new HttpError(400, 'Microsoft Teams is not configured, so shifts can’t be sent to Teams Shifts.');
  }
  const term = await termService.getById(termId);
  if (!term) throw new HttpError(404, 'Academic term not found');

  const client = getGraphWriteClient();
  const teamId = config.microsoftGraph.teamId;
  if (!teamId) throw new HttpError(400, 'TEAMS_TEAM_ID is not configured');
  const schedule = await client.get<GraphSchedule>(`/teams/${teamId}/schedule`);
  assertScheduleProvisioned(schedule);
  const groups = await client.getCollection<GraphSchedulingGroup>(`/teams/${teamId}/schedule/schedulingGroups`);
  const group = selectSchedulingGroup(groups, config.microsoftGraph.schedulingGroup);

  return {
    client,
    teamId,
    groupId: group.id,
    groupName: group.displayName ?? config.microsoftGraph.schedulingGroup,
    rosterIds: new Set((group.userIds ?? []).filter(Boolean)),
    term,
  };
}

interface GraphShiftItemRecord {
  startDateTime?: string | null;
  endDateTime?: string | null;
  theme?: string | null;
}

interface GraphShiftRecord {
  id: string;
  userId?: string | null;
  schedulingGroupId?: string | null;
  isStagedForDeletion?: boolean | null;
  draftShift?: GraphShiftItemRecord | null;
  sharedShift?: GraphShiftItemRecord | null;
}

/** Shifts in the scheduling group for these users whose shared or draft version falls in the range. */
async function loadExistingShifts(
  ctx: TeamsContext,
  userIds: Set<string>,
  range: PublishRange,
): Promise<Map<string, ExistingTeamsShift>> {
  const start = getOrgLocalInstant(range.fromDate, 0, 0).toISOString();
  const end = getOrgLocalInstant(addCalendarDays(range.toDate, 1), 0, 0).toISOString();
  const path = `/teams/${ctx.teamId}/schedule/shifts`;
  // $filter can't mix shared and draft dates usefully, so query each and merge.
  const [shared, drafts] = await Promise.all([
    ctx.client.getCollection<GraphShiftRecord>(path, {
      filter: `sharedShift/startDateTime ge ${start} and sharedShift/endDateTime le ${end}`,
    }),
    ctx.client.getCollection<GraphShiftRecord>(path, {
      filter: `draftShift/startDateTime ge ${start} and draftShift/endDateTime le ${end}`,
    }),
  ]);

  const byId = new Map<string, ExistingTeamsShift>();
  for (const shift of [...shared, ...drafts]) {
    if (byId.has(shift.id) || shift.schedulingGroupId !== ctx.groupId || !shift.userId || !userIds.has(shift.userId)) {
      continue;
    }
    // A pending draft edit is what the shift becomes once shared.
    const item = shift.draftShift?.startDateTime ? shift.draftShift : shift.sharedShift;
    if (!item?.startDateTime || !item.endDateTime) continue;
    if (item.startDateTime < start || item.endDateTime > end) continue;
    byId.set(shift.id, {
      id: shift.id,
      userId: shift.userId,
      start: item.startDateTime,
      end: item.endDateTime,
      draftOnly: !shift.sharedShift?.startDateTime,
      isStagedForDeletion: Boolean(shift.isStagedForDeletion),
    });
  }
  return byId;
}

/** One person's shifts as they'll stand once shared, for one Mon–Fri week. */
async function loadWeekShifts(ctx: TeamsContext, userId: string, monday: string) {
  const start = getOrgLocalInstant(monday, 0, 0).toISOString();
  const end = getOrgLocalInstant(addCalendarDays(monday, 5), 0, 0).toISOString();
  const path = `/teams/${ctx.teamId}/schedule/shifts`;
  const records = new Map<string, GraphShiftRecord>();
  for (const field of ['sharedShift', 'draftShift']) {
    const rows = await ctx.client.getCollection<GraphShiftRecord>(path, {
      filter: `${field}/startDateTime ge ${start} and ${field}/endDateTime le ${end}`,
    });
    for (const row of rows) {
      if (row.userId === userId && row.schedulingGroupId === ctx.groupId && !row.isStagedForDeletion) records.set(row.id, row);
    }
  }
  return [...records.values()].flatMap((row) => {
    const item = row.draftShift?.startDateTime ? row.draftShift : row.sharedShift;
    if (!item?.startDateTime || !item.endDateTime) return [];
    return [{ start: new Date(item.startDateTime), end: new Date(item.endDateTime), theme: item.theme ?? null }];
  });
}

async function buildPlan(
  ctx: TeamsContext,
  requested: PublishRange,
  people: { student: StudentAssistant; weekly: WeeklyShift[] }[],
): Promise<PlanForPeople> {
  const range = clampRange(requested, ctx.term);
  const linked = people.filter(({ student }) => student.entra_user_id);
  const missing = people.filter(({ student }) => !student.entra_user_id);
  const userIds = new Set(linked.map(({ student }) => student.entra_user_id!));

  const desired = linked.flatMap(({ student, weekly }) =>
    expandWeeklyShifts(student.entra_user_id!, weekly, range.fromDate, range.toDate, ctx.term),
  );
  const existing = await loadExistingShifts(ctx, userIds, range);
  const plan = planShiftChanges(desired, [...existing.values()]);

  const removedIds = [...plan.stage, ...plan.deleteDrafts];
  const offDays = parseOffDays(ctx.term);
  const preview: TeamsPublishPreview = {
    range,
    scheduling_group: ctx.groupName,
    people: linked.length,
    missing_teams: missing.map(({ student }) => ({ id: student.id, name: studentName(student) })),
    skipped_dates: ((offDays?.vacations ?? []) as { date: string; label?: string }[]).filter(
      (entry) => entry.date >= range.fromDate && entry.date <= range.toDate,
    ),
    create: plan.create.length,
    keep: plan.keep.length,
    remove: removedIds.length,
    restore: plan.unstage.length,
    hours_added: Math.round(plan.create.reduce((sum, shift) => sum + hours(shift.start, shift.end), 0) * 10) / 10,
    hours_removed:
      Math.round(removedIds.reduce((sum, id) => sum + hours(existing.get(id)!.start, existing.get(id)!.end), 0) * 10) / 10,
  };
  return { ctx, range, plan, desired, existing, preview };
}

async function runLimited<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(WRITE_CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await worker(item);
      }
    }),
  );
}

/** Apply a plan as draft changes; failures are collected rather than aborting the batch. */
async function executePlan({ ctx, plan, existing }: PlanForPeople) {
  const failed: TeamsPublishResult['failed'] = [];
  const touchedUsers = new Set<string>();
  const shiftsPath = `/teams/${ctx.teamId}/schedule/shifts`;
  const attempt = async (action: string, userId: string | undefined, run: () => Promise<unknown>) => {
    try {
      await run();
      if (userId) touchedUsers.add(userId);
    } catch (err) {
      failed.push({ action, message: err instanceof Error ? err.message : String(err) });
    }
  };

  await runLimited(plan.create, (shift) =>
    attempt('create', shift.userId, () =>
      ctx.client.post(shiftsPath, {
        userId: shift.userId,
        schedulingGroupId: ctx.groupId,
        draftShift: {
          displayName: null,
          startDateTime: shift.start,
          endDateTime: shift.end,
          theme: shift.theme,
          notes: null,
          activities: [],
        },
        sharedShift: null,
        isStagedForDeletion: false,
      }),
    ),
  );
  await runLimited(plan.stage, (id) =>
    attempt('stage for deletion', existing.get(id)?.userId, () => ctx.client.post(`${shiftsPath}/${id}/stageForDeletion`, {})),
  );
  await runLimited(plan.deleteDrafts, (id) =>
    attempt('delete draft', existing.get(id)?.userId, () => ctx.client.delete(`${shiftsPath}/${id}`)),
  );
  await runLimited(plan.unstage, (id) =>
    attempt('restore', existing.get(id)?.userId, async () => {
      // Replace needs the full shift; re-send it with the deletion un-staged.
      const current = await ctx.client.get<Record<string, unknown>>(`${shiftsPath}/${id}`);
      await ctx.client.put(`${shiftsPath}/${id}`, {
        userId: current.userId,
        schedulingGroupId: current.schedulingGroupId,
        draftShift: current.draftShift ?? null,
        sharedShift: current.sharedShift ?? null,
        isStagedForDeletion: false,
      });
    }),
  );

  return { failed, studentsAffected: touchedUsers.size };
}

async function recordVersion(row: Database['public']['Tables']['teams_schedule_publish']['Insert']): Promise<void> {
  const { error } = await supabase.from('teams_schedule_publish').insert(row);
  // History is a nice-to-have; a missing table must not fail a send that already happened.
  if (error && !(error.code && MISSING_TABLE_CODES.has(error.code))) {
    console.error('Recording Teams publish history failed:', error.message);
  }
}

function minutesOf(time: string): number {
  const minutes = timeToMinutes(time);
  if (Number.isNaN(minutes)) throw new HttpError(400, `Invalid time "${time}"`);
  return minutes;
}

function themeFor(role: 'L' | 'm' | 't' | undefined): string {
  return role === 't' ? TEAMS_THEME.training : TEAMS_THEME.inPerson;
}

async function draftPeople(draftId: number) {
  const draft = await scheduleDraftService.getById(draftId);
  const students = new Map((await studentAssistantService.getAll()).map((student) => [student.id, student]));
  // Only people the draft actually covers: anyone with shifts, or who answered the form.
  const people = draft.people
    .filter((person) => person.responded || Object.keys(person.assignments).length > 0)
    .flatMap((person) => {
      const student = students.get(person.student_assistant_id);
      if (!student) return [];
      const weekly: WeeklyShift[] = assignedRoleRuns(person.assignments).map((run) => ({
        day: run.day,
        startMinutes: run.start * 30,
        endMinutes: run.end * 30,
        theme: themeFor(run.role),
      }));
      return [{ student, weekly }];
    });
  return { draft, people };
}

async function personPeople(studentId: number, shifts: PersonWeeklyShiftInput[]) {
  const student = await studentAssistantService.getById(studentId);
  if (!student) throw new HttpError(404, 'Student not found');
  const weekly: WeeklyShift[] = shifts.map((shift) => ({
    day: shift.day,
    startMinutes: minutesOf(shift.start_time),
    endMinutes: minutesOf(shift.end_time),
    theme: themeFor(shift.role),
  }));
  return [{ student, weekly }];
}

function summarize(preview: TeamsPublishPreview): string {
  const parts = [`+${preview.create}`, `−${preview.remove}`];
  if (preview.restore) parts.push(`${preview.restore} restored`);
  return `${parts.join(' / ')} shifts, ${preview.keep} unchanged`;
}

export const teamsPublishService = {
  async previewDraft(draftId: number, range: PublishRange): Promise<TeamsPublishPreview> {
    const { draft, people } = await draftPeople(draftId);
    const ctx = await loadContext(draft.academic_term_id);
    return (await buildPlan(ctx, range, people)).preview;
  },

  async publishDraft(draftId: number, range: PublishRange): Promise<TeamsPublishResult> {
    const { draft, people } = await draftPeople(draftId);
    const ctx = await loadContext(draft.academic_term_id);
    const built = await buildPlan(ctx, range, people);
    const { failed, studentsAffected } = await executePlan(built);
    const { preview } = built;

    await recordVersion({
      academic_term_id: ctx.term.id,
      kind: 'term',
      from_date: preview.range.fromDate,
      to_date: preview.range.toDate,
      created_count: preview.create,
      kept_count: preview.keep,
      removed_count: preview.remove,
      failed_count: failed.length,
      summary: `Term schedule: ${summarize(preview)}`,
    });
    await scheduleDraftService.markSentToTeams(
      draftId,
      `Sent to Teams as drafts for ${preview.range.fromDate} – ${preview.range.toDate}: ${summarize(preview)}${failed.length ? `, ${failed.length} failed` : ''}`,
    );
    return { ...preview, failed, students_affected: studentsAffected };
  },

  async previewPerson(
    termId: number,
    studentId: number,
    shifts: PersonWeeklyShiftInput[],
    range: PublishRange,
  ): Promise<TeamsPublishPreview> {
    const ctx = await loadContext(termId);
    return (await buildPlan(ctx, range, await personPeople(studentId, shifts))).preview;
  },

  async publishPerson(
    termId: number,
    studentId: number,
    shifts: PersonWeeklyShiftInput[],
    range: PublishRange,
  ): Promise<TeamsPublishResult> {
    const ctx = await loadContext(termId);
    const people = await personPeople(studentId, shifts);
    if (!people[0].student.entra_user_id) {
      throw new HttpError(400, `${studentName(people[0].student)} isn't linked to a Teams account yet.`);
    }
    const built = await buildPlan(ctx, range, people);
    const { failed, studentsAffected } = await executePlan(built);
    const { preview } = built;

    await recordVersion({
      academic_term_id: termId,
      kind: 'person',
      student_assistant_id: studentId,
      from_date: preview.range.fromDate,
      to_date: preview.range.toDate,
      created_count: preview.create,
      kept_count: preview.keep,
      removed_count: preview.remove,
      failed_count: failed.length,
      summary: `${studentName(people[0].student)}: ${summarize(preview)}`,
    });
    return { ...preview, failed, students_affected: studentsAffected };
  },

  /** The person's weekly shifts as they are in Teams, read from `week` (or the latest earlier week that has any). */
  async personPattern(termId: number, studentId: number, week: string): Promise<TeamsPersonPattern> {
    const student = await studentAssistantService.getById(studentId);
    if (!student) throw new HttpError(404, 'Student not found');
    if (!student.entra_user_id) return { week_of: null, shifts: [], linked: false };
    const ctx = await loadContext(termId);

    for (let back = 0; back <= PATTERN_LOOKBACK_WEEKS; back += 1) {
      const monday = addCalendarDays(mondayOf(week), -7 * back);
      if (ctx.term.end_date && monday > ctx.term.end_date) continue;
      const shifts = await loadWeekShifts(ctx, student.entra_user_id, monday);
      if (shifts.length === 0) continue;
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
      const toTime = (date: Date) => {
        const minutes = getOrgLocalMinutes(date);
        return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      };
      return {
        week_of: monday,
        linked: true,
        shifts: shifts
          .map((shift) => {
            const [y, m, d] = getOrgLocalDateString(shift.start).split('-').map(Number);
            const day = days[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
            return { shift, day };
          })
          .filter((entry): entry is { shift: (typeof shifts)[number]; day: Weekday } => entry.day !== 'sunday' && entry.day !== 'saturday')
          .map(({ shift, day }) => ({
            day,
            start_time: toTime(shift.start),
            end_time: toTime(shift.end),
            role: shift.theme === TEAMS_THEME.training ? ('t' as const) : student.position === 'student_lead' ? ('L' as const) : ('m' as const),
            remote: shift.theme === TEAMS_THEME.remote,
          }))
          .sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day) || a.start_time.localeCompare(b.start_time)),
      };
    }
    return { week_of: null, shifts: [], linked: true };
  },

  async history(termId: number, limit = 12): Promise<TeamsPublishVersion[]> {
    const { data, error } = await supabase
      .from('teams_schedule_publish')
      .select('*')
      .eq('academic_term_id', termId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      if (error.code && MISSING_TABLE_CODES.has(error.code)) return [];
      throw new HttpError(500, error.message);
    }
    const students = new Map((await studentAssistantService.getAll()).map((student) => [student.id, student]));
    return (data ?? []).map((row: PublishRow) => ({
      id: row.id,
      kind: row.kind === 'person' ? 'person' : 'term',
      student_name:
        row.student_assistant_id != null && students.get(row.student_assistant_id)
          ? studentName(students.get(row.student_assistant_id)!)
          : null,
      from_date: row.from_date,
      to_date: row.to_date,
      created_count: row.created_count,
      kept_count: row.kept_count,
      removed_count: row.removed_count,
      failed_count: row.failed_count,
      summary: row.summary,
      created_at: row.created_at,
    }));
  },
};

