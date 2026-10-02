import {
  config,
  DEFAULT_TEAMS_SCHEDULING_GROUP,
  type MicrosoftGraphConfig,
} from '../config/environment';
import {
  GRAPH_NOT_CONFIGURED_MESSAGE,
  getGraphClient,
  type GraphApiClient,
} from './microsoftGraph';
import {
  getOrgLocalDateString,
  getOrgLocalInstant,
  getOrgLocalMinutes,
  isValidOrgLocalDateString,
  ORG_TIMEZONE,
} from './orgTime';
import { parseThemeColorIsRemote } from './scheduleImportParser';

export interface TermDateWindow {
  startDate: string;
  endDate: string;
}

export interface TeamsUserDto {
  entraUserId: string;
  mail: string | null;
  userPrincipalName: string | null;
  displayName: string | null;
  givenName: string | null;
  surname: string | null;
}

export interface TeamsShiftDto {
  id: string;
  entraUserId: string;
  schedulingGroupId: string;
  startDateTime: string;
  endDateTime: string;
  theme: string | null;
  displayName: string | null;
  localStartDate: string;
  localStartTime: string;
  localEndDate: string;
  localEndTime: string;
  isRemote: boolean | null;
}

export interface TeamsTimeOffDto {
  id: string;
  entraUserId: string;
  startDateTime: string;
  endDateTime: string;
  timeOffReasonId: string | null;
  timeOffReason: string | null;
  displayName: string | null;
  localStartDate: string;
  localStartTime: string;
  localEndDate: string;
  localEndTime: string;
}

export interface TeamsShiftsSnapshot {
  teamId: string;
  schedulingGroupId: string;
  schedulingGroupName: string;
  timeZone: string;
  members: TeamsUserDto[];
  shifts: TeamsShiftDto[];
  timesOff: TeamsTimeOffDto[];
}

export interface GraphShiftItem {
  displayName?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  theme?: string | null;
}

export interface GraphShift {
  id?: string;
  userId?: string | null;
  schedulingGroupId?: string | null;
  sharedShift?: GraphShiftItem | null;
  draftShift?: GraphShiftItem | null;
}

export interface GraphTimeOffItem {
  displayName?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  timeOffReasonId?: string | null;
}

export interface GraphTimeOff {
  id?: string;
  userId?: string | null;
  sharedTimeOff?: GraphTimeOffItem | null;
  draftTimeOff?: GraphTimeOffItem | null;
}

export interface GraphSchedulingGroup {
  id?: string;
  displayName?: string | null;
  isActive?: boolean | null;
  userIds?: string[] | null;
}

export interface GraphTeamMember {
  id?: string;
  displayName?: string | null;
  email?: string | null;
  userId?: string | null;
}

export interface GraphUser {
  id?: string;
  mail?: string | null;
  userPrincipalName?: string | null;
  displayName?: string | null;
  givenName?: string | null;
  surname?: string | null;
}

export interface GraphTimeOffReason {
  id?: string;
  displayName?: string | null;
  isActive?: boolean | null;
}

export interface GraphSchedule {
  id?: string;
  enabled?: boolean | null;
  timeZone?: string | null;
  provisionStatus?: string | null;
}

export interface FetchTeamsShiftsOptions {
  client?: GraphApiClient;
  graphConfig?: MicrosoftGraphConfig;
  teamId?: string;
  schedulingGroup?: string;
}

export interface UtcTermWindow {
  start: Date;
  endExclusive: Date;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = emptyToNull(value);
  return normalized ? normalized.toLowerCase() : null;
}

function addCalendarDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function minutesToHhMm(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function parseGraphDateTime(value: string): Date {
  const trimmed = value.trim();
  const hasZone = /Z|[+-]\d{2}:?\d{2}$/i.test(trimmed);
  const date = new Date(hasZone ? trimmed : `${trimmed}Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Graph datetime: ${value}`);
  }
  return date;
}

export function toOrgLocalDateTime(iso: string): { date: string; time: string } {
  const instant = parseGraphDateTime(iso);
  return {
    date: getOrgLocalDateString(instant),
    time: minutesToHhMm(getOrgLocalMinutes(instant)),
  };
}

export function termWindowToUtcRange(startDate: string, endDate: string): UtcTermWindow {
  if (!isValidOrgLocalDateString(startDate) || !isValidOrgLocalDateString(endDate)) {
    throw new Error('Term window startDate and endDate must be YYYY-MM-DD');
  }
  if (startDate > endDate) {
    throw new Error('Term window startDate must be on or before endDate');
  }

  return {
    start: getOrgLocalInstant(startDate, 0, 0),
    endExclusive: getOrgLocalInstant(addCalendarDays(endDate, 1), 0, 0),
  };
}

export function isIntervalInsideWindow(
  startIso: string,
  endIso: string,
  window: UtcTermWindow,
): boolean {
  const start = parseGraphDateTime(startIso).getTime();
  const end = parseGraphDateTime(endIso).getTime();
  return start >= window.start.getTime() && end <= window.endExclusive.getTime();
}

export function hasPublishedSharedShift(
  shift: GraphShift,
): shift is GraphShift & { sharedShift: GraphShiftItem } {
  return Boolean(
    shift.sharedShift &&
      emptyToNull(shift.sharedShift.startDateTime) &&
      emptyToNull(shift.sharedShift.endDateTime),
  );
}

export function hasPublishedSharedTimeOff(
  timeOff: GraphTimeOff,
): timeOff is GraphTimeOff & { sharedTimeOff: GraphTimeOffItem } {
  return Boolean(
    timeOff.sharedTimeOff &&
      emptyToNull(timeOff.sharedTimeOff.startDateTime) &&
      emptyToNull(timeOff.sharedTimeOff.endDateTime),
  );
}

export function selectSchedulingGroup(
  groups: GraphSchedulingGroup[],
  name: string,
): GraphSchedulingGroup & { id: string } {
  const needle = name.trim().toLowerCase();
  const matches = groups.filter(
    (group) => (group.displayName ?? '').trim().toLowerCase() === needle,
  );

  if (matches.length === 0) {
    throw new Error(`Teams scheduling group "${name}" was not found`);
  }

  const active = matches.find((group) => group.isActive !== false);
  if (!active?.id) {
    throw new Error(`Teams scheduling group "${name}" is inactive`);
  }

  return { ...active, id: active.id };
}

export function assertScheduleProvisioned(schedule: GraphSchedule): void {
  const status = emptyToNull(schedule.provisionStatus);
  if (status && status !== 'Completed') {
    throw new Error(`Teams schedule is not provisioned (provisionStatus=${status})`);
  }
  if (schedule.enabled === false) {
    throw new Error('Teams schedule is not enabled');
  }
  if (!status && schedule.enabled !== true) {
    throw new Error('Teams schedule is not provisioned');
  }
}

export function mapGraphUserToDto(
  user: GraphUser,
  member?: GraphTeamMember,
): TeamsUserDto {
  const entraUserId = emptyToNull(user.id) ?? emptyToNull(member?.userId);
  if (!entraUserId) {
    throw new Error('Cannot map Graph user without id');
  }

  return {
    entraUserId,
    mail: normalizeEmail(user.mail) ?? normalizeEmail(member?.email),
    userPrincipalName: normalizeEmail(user.userPrincipalName),
    displayName: emptyToNull(user.displayName) ?? emptyToNull(member?.displayName),
    givenName: emptyToNull(user.givenName),
    surname: emptyToNull(user.surname),
  };
}

export function mapGraphShiftToDto(shift: GraphShift): TeamsShiftDto {
  if (!hasPublishedSharedShift(shift)) {
    throw new Error(`Shift ${shift.id ?? '(unknown)'} has no published sharedShift`);
  }
  if (!shift.id || !shift.userId || !shift.schedulingGroupId) {
    throw new Error('Published shift is missing id, userId, or schedulingGroupId');
  }

  const startDateTime = shift.sharedShift.startDateTime as string;
  const endDateTime = shift.sharedShift.endDateTime as string;
  const startLocal = toOrgLocalDateTime(startDateTime);
  const endLocal = toOrgLocalDateTime(endDateTime);
  const theme = emptyToNull(shift.sharedShift.theme);

  return {
    id: shift.id,
    entraUserId: shift.userId,
    schedulingGroupId: shift.schedulingGroupId,
    startDateTime: parseGraphDateTime(startDateTime).toISOString(),
    endDateTime: parseGraphDateTime(endDateTime).toISOString(),
    theme,
    displayName: emptyToNull(shift.sharedShift.displayName),
    localStartDate: startLocal.date,
    localStartTime: startLocal.time,
    localEndDate: endLocal.date,
    localEndTime: endLocal.time,
    isRemote: parseThemeColorIsRemote(theme ?? ''),
  };
}

export function mapGraphTimeOffToDto(
  timeOff: GraphTimeOff,
  reasonsById: Map<string, string> = new Map(),
): TeamsTimeOffDto {
  if (!hasPublishedSharedTimeOff(timeOff)) {
    throw new Error(`Time off ${timeOff.id ?? '(unknown)'} has no published sharedTimeOff`);
  }
  if (!timeOff.id || !timeOff.userId) {
    throw new Error('Published time off is missing id or userId');
  }

  const startDateTime = timeOff.sharedTimeOff.startDateTime as string;
  const endDateTime = timeOff.sharedTimeOff.endDateTime as string;
  const startLocal = toOrgLocalDateTime(startDateTime);
  const endLocal = toOrgLocalDateTime(endDateTime);
  const timeOffReasonId = emptyToNull(timeOff.sharedTimeOff.timeOffReasonId);

  return {
    id: timeOff.id,
    entraUserId: timeOff.userId,
    startDateTime: parseGraphDateTime(startDateTime).toISOString(),
    endDateTime: parseGraphDateTime(endDateTime).toISOString(),
    timeOffReasonId,
    timeOffReason:
      (timeOffReasonId ? emptyToNull(reasonsById.get(timeOffReasonId)) : null) ??
      emptyToNull(timeOff.sharedTimeOff.displayName),
    displayName: emptyToNull(timeOff.sharedTimeOff.displayName),
    localStartDate: startLocal.date,
    localStartTime: startLocal.time,
    localEndDate: endLocal.date,
    localEndTime: endLocal.time,
  };
}

export function isShiftInScope(
  shift: GraphShift,
  schedulingGroupId: string,
  userIds: Set<string>,
  window: UtcTermWindow,
): boolean {
  if (!hasPublishedSharedShift(shift)) return false;
  if (shift.schedulingGroupId !== schedulingGroupId) return false;
  if (!shift.userId || !userIds.has(shift.userId)) return false;
  return isIntervalInsideWindow(
    shift.sharedShift.startDateTime as string,
    shift.sharedShift.endDateTime as string,
    window,
  );
}

export function isTimeOffInScope(
  timeOff: GraphTimeOff,
  userIds: Set<string>,
  window: UtcTermWindow,
): boolean {
  if (!hasPublishedSharedTimeOff(timeOff)) return false;
  if (!timeOff.userId || !userIds.has(timeOff.userId)) return false;
  return isIntervalInsideWindow(
    timeOff.sharedTimeOff.startDateTime as string,
    timeOff.sharedTimeOff.endDateTime as string,
    window,
  );
}

function odataDateTimeFilter(
  startPath: string,
  endPath: string,
  window: UtcTermWindow,
): string {
  return `${startPath} ge ${window.start.toISOString()} and ${endPath} le ${window.endExclusive.toISOString()}`;
}

async function resolveRosterUsers(
  client: GraphApiClient,
  userIds: string[],
  membersByUserId: Map<string, GraphTeamMember>,
): Promise<TeamsUserDto[]> {
  const users = await Promise.all(
    userIds.map(async (userId) => {
      const member = membersByUserId.get(userId);
      try {
        const user = await client.get<GraphUser>(`/users/${encodeURIComponent(userId)}`, {
          select: 'id,mail,userPrincipalName,displayName,givenName,surname',
        });
        return mapGraphUserToDto(user, member);
      } catch {
        return mapGraphUserToDto({ id: userId }, member);
      }
    }),
  );

  return users;
}

export async function fetchTeamsShiftsForTerm(
  window: TermDateWindow,
  options: FetchTeamsShiftsOptions = {},
): Promise<TeamsShiftsSnapshot> {
  const graphConfig = options.graphConfig ?? config.microsoftGraph;
  const client = options.client ?? (graphConfig.enabled ? getGraphClient() : undefined);
  if (!client) {
    throw new Error(GRAPH_NOT_CONFIGURED_MESSAGE);
  }

  const teamId = options.teamId ?? graphConfig.teamId;
  if (!teamId) {
    throw new Error('TEAMS_TEAM_ID is not configured');
  }

  const schedulingGroupName =
    options.schedulingGroup ?? graphConfig.schedulingGroup ?? DEFAULT_TEAMS_SCHEDULING_GROUP;
  const utcWindow = termWindowToUtcRange(window.startDate, window.endDate);

  const schedule = await client.get<GraphSchedule>(`/teams/${teamId}/schedule`);
  assertScheduleProvisioned(schedule);

  const [groups, members, shifts, timesOff, timeOffReasons] = await Promise.all([
    client.getCollection<GraphSchedulingGroup>(
      `/teams/${teamId}/schedule/schedulingGroups`,
    ),
    client.getCollection<GraphTeamMember>(`/teams/${teamId}/members`),
    client.getCollection<GraphShift>(`/teams/${teamId}/schedule/shifts`, {
      filter: odataDateTimeFilter(
        'sharedShift/startDateTime',
        'sharedShift/endDateTime',
        utcWindow,
      ),
    }),
    client.getCollection<GraphTimeOff>(`/teams/${teamId}/schedule/timesOff`, {
      filter: odataDateTimeFilter(
        'sharedTimeOff/startDateTime',
        'sharedTimeOff/endDateTime',
        utcWindow,
      ),
    }),
    client.getCollection<GraphTimeOffReason>(
      `/teams/${teamId}/schedule/timeOffReasons`,
    ),
  ]);

  const group = selectSchedulingGroup(groups, schedulingGroupName);
  const rosterUserIds = [...new Set((group.userIds ?? []).filter(Boolean))];
  const rosterSet = new Set(rosterUserIds);

  const membersByUserId = new Map<string, GraphTeamMember>();
  for (const member of members) {
    const userId = emptyToNull(member.userId);
    if (userId) membersByUserId.set(userId, member);
  }

  const reasonsById = new Map<string, string>();
  for (const reason of timeOffReasons) {
    const id = emptyToNull(reason.id);
    const displayName = emptyToNull(reason.displayName);
    if (id && displayName) reasonsById.set(id, displayName);
  }

  const resolvedMembers = await resolveRosterUsers(client, rosterUserIds, membersByUserId);

  return {
    teamId,
    schedulingGroupId: group.id,
    schedulingGroupName: emptyToNull(group.displayName) ?? schedulingGroupName,
    timeZone: ORG_TIMEZONE,
    members: resolvedMembers,
    shifts: shifts
      .filter((shift) => isShiftInScope(shift, group.id, rosterSet, utcWindow))
      .map(mapGraphShiftToDto),
    timesOff: timesOff
      .filter((timeOff) => isTimeOffInScope(timeOff, rosterSet, utcWindow))
      .map((timeOff) => mapGraphTimeOffToDto(timeOff, reasonsById)),
  };
}
