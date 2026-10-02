import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEAMS_SCHEDULING_GROUP,
  MICROSOFT_GRAPH_REQUIRED_VARS,
  loadEnvironment,
  resolveMicrosoftGraphConfig,
} from '../config/environment';
import {
  GRAPH_NOT_CONFIGURED_MESSAGE,
  createGraphApiClient,
  isMicrosoftGraphEnabled,
  type GraphApiClient,
} from '../lib/microsoftGraph';
import {
  assertScheduleProvisioned,
  fetchTeamsShiftsForTerm,
  hasPublishedSharedShift,
  hasPublishedSharedTimeOff,
  isShiftInScope,
  isTimeOffInScope,
  mapGraphShiftToDto,
  mapGraphTimeOffToDto,
  mapGraphUserToDto,
  selectSchedulingGroup,
  termWindowToUtcRange,
  toOrgLocalDateTime,
} from '../lib/teamsShiftsAdapter';
import {
  TEAM_ID,
  TERM_WINDOW,
  USER_A_ID,
  USER_B_ID,
  USER_C_ID,
  VACATION_REASON_ID,
  allShifts,
  allTimesOff,
  draftOnlyShift,
  draftOnlyTimeOff,
  graphUsers,
  helpDeskShift,
  helpDeskTimeOff,
  publishedDeskShift,
  publishedRemoteShift,
  publishedTimeOff,
  provisionedSchedule,
  schedulingGroups,
  teamMembers,
  timeOffReasons,
  unprovisionedSchedule,
} from './fixtures/graph-teams-shifts';

function createFixtureClient(options?: {
  schedule?: typeof provisionedSchedule;
  userLookupErrorIds?: Set<string>;
}): GraphApiClient {
  const schedule = options?.schedule ?? provisionedSchedule;
  const userLookupErrorIds = options?.userLookupErrorIds ?? new Set<string>();

  return {
    async get<T>(path: string): Promise<T> {
      if (path === `/teams/${TEAM_ID}/schedule`) {
        return schedule as T;
      }

      const userMatch = path.match(/^\/users\/([^/?]+)/);
      if (userMatch) {
        const userId = decodeURIComponent(userMatch[1]);
        if (userLookupErrorIds.has(userId)) {
          throw new Error('User not found');
        }
        const user = graphUsers[userId];
        if (!user) throw new Error('User not found');
        return user as T;
      }

      throw new Error(`Unexpected Graph GET ${path}`);
    },

    async getCollection<T>(path: string): Promise<T[]> {
      if (path === `/teams/${TEAM_ID}/schedule/schedulingGroups`) {
        return schedulingGroups as T[];
      }
      if (path === `/teams/${TEAM_ID}/members`) {
        return teamMembers as T[];
      }
      if (path.startsWith(`/teams/${TEAM_ID}/schedule/shifts`)) {
        return allShifts as T[];
      }
      if (path.startsWith(`/teams/${TEAM_ID}/schedule/timesOff`)) {
        return allTimesOff as T[];
      }
      if (path === `/teams/${TEAM_ID}/schedule/timeOffReasons`) {
        return timeOffReasons as T[];
      }
      throw new Error(`Unexpected Graph collection GET ${path}`);
    },
  };
}

describe('resolveMicrosoftGraphConfig', () => {
  it('disables Graph when required env vars are unset', () => {
    const graph = resolveMicrosoftGraphConfig({});
    expect(graph.enabled).toBe(false);
    expect(graph.missingVars).toEqual([...MICROSOFT_GRAPH_REQUIRED_VARS]);
    expect(graph.schedulingGroup).toBe(DEFAULT_TEAMS_SCHEDULING_GROUP);
  });

  it('treats blank values as unset', () => {
    const graph = resolveMicrosoftGraphConfig({
      MICROSOFT_TENANT_ID: '  ',
      MICROSOFT_CLIENT_ID: 'client',
      MICROSOFT_CLIENT_SECRET: 'secret',
      TEAMS_TEAM_ID: 'team',
    });
    expect(graph.enabled).toBe(false);
    expect(graph.missingVars).toEqual(['MICROSOFT_TENANT_ID']);
  });

  it('enables Graph when tenant, client, secret, and team id are set', () => {
    const graph = resolveMicrosoftGraphConfig({
      MICROSOFT_TENANT_ID: 'tenant',
      MICROSOFT_CLIENT_ID: 'client',
      MICROSOFT_CLIENT_SECRET: 'secret',
      TEAMS_TEAM_ID: 'team',
      TEAMS_SCHEDULING_GROUP: ' Frontline ',
    });
    expect(graph.enabled).toBe(true);
    expect(graph.missingVars).toEqual([]);
    expect(graph.teamId).toBe('team');
    expect(graph.schedulingGroup).toBe('Frontline');
  });

  it('lets the app boot without Graph env vars', () => {
    process.env.SUPABASE_URL ??= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'ci-placeholder';
    expect(() => loadEnvironment()).not.toThrow();
  });

  it('does not construct a Graph client when unconfigured', () => {
    const graph = resolveMicrosoftGraphConfig({});
    expect(isMicrosoftGraphEnabled(graph)).toBe(false);
    expect(() => createGraphApiClient(graph)).toThrow(GRAPH_NOT_CONFIGURED_MESSAGE);
  });
});

describe('term window timezone', () => {
  it('converts the term date window with ORG_TIMEZONE (PDT)', () => {
    const window = termWindowToUtcRange('2026-06-22', '2026-06-26');
    expect(window.start.toISOString()).toBe('2026-06-22T07:00:00.000Z');
    expect(window.endExclusive.toISOString()).toBe('2026-06-27T07:00:00.000Z');
  });

  it('converts the term date window with ORG_TIMEZONE (PST)', () => {
    const window = termWindowToUtcRange('2026-01-15', '2026-01-15');
    expect(window.start.toISOString()).toBe('2026-01-15T08:00:00.000Z');
    expect(window.endExclusive.toISOString()).toBe('2026-01-16T08:00:00.000Z');
  });
});

describe('Graph JSON mapping', () => {
  it('maps published shift UTC times to org-local date and HH:mm', () => {
    expect(toOrgLocalDateTime('2026-06-25T15:00:00.000Z')).toEqual({
      date: '2026-06-25',
      time: '08:00',
    });

    const dto = mapGraphShiftToDto(publishedDeskShift);
    expect(dto).toMatchObject({
      id: 'SHFT_published_a',
      entraUserId: USER_A_ID,
      localStartDate: '2026-06-25',
      localStartTime: '08:00',
      localEndDate: '2026-06-25',
      localEndTime: '11:00',
      theme: 'green',
      isRemote: false,
    });
  });

  it('maps Graph blue theme to remote', () => {
    expect(mapGraphShiftToDto(publishedRemoteShift).isRemote).toBe(true);
  });

  it('treats naive Graph datetimes as UTC', () => {
    expect(toOrgLocalDateTime('2026-06-25T15:00:00')).toEqual({
      date: '2026-06-25',
      time: '08:00',
    });
  });

  it('maps overnight PDT shift dates from start and end instants', () => {
    const dto = mapGraphShiftToDto({
      id: 'SHFT_overnight',
      userId: USER_A_ID,
      schedulingGroupId: 'TAG_service-desk',
      sharedShift: {
        startDateTime: '2026-06-26T06:00:00.000Z',
        endDateTime: '2026-06-26T08:00:00.000Z',
        theme: 'green',
      },
    });
    expect(dto.localStartDate).toBe('2026-06-25');
    expect(dto.localStartTime).toBe('23:00');
    expect(dto.localEndDate).toBe('2026-06-26');
    expect(dto.localEndTime).toBe('01:00');
  });

  it('resolves user mail/UPN/name and falls back to team member email', () => {
    expect(mapGraphUserToDto(graphUsers[USER_A_ID])).toEqual({
      entraUserId: USER_A_ID,
      mail: 'ada@calpoly.edu',
      userPrincipalName: 'ada@calpoly.edu',
      displayName: 'Ada Lovelace',
      givenName: 'Ada',
      surname: 'Lovelace',
    });

    expect(mapGraphUserToDto(graphUsers[USER_B_ID], teamMembers[1])).toMatchObject({
      entraUserId: USER_B_ID,
      mail: 'ben@calpoly.edu',
      userPrincipalName: 'ben@calpoly.edu',
      givenName: 'Ben',
      surname: 'Bitdiddle',
    });
  });

  it('maps published time off and looks up the reason display name', () => {
    const dto = mapGraphTimeOffToDto(
      publishedTimeOff,
      new Map([[VACATION_REASON_ID, 'Vacation']]),
    );
    expect(dto).toMatchObject({
      id: 'TOFF_published_a',
      entraUserId: USER_A_ID,
      timeOffReasonId: VACATION_REASON_ID,
      timeOffReason: 'Vacation',
      localStartDate: '2026-06-24',
      localStartTime: '00:00',
      localEndDate: '2026-06-25',
      localEndTime: '00:00',
    });
  });
});

describe('draft skip and group filter', () => {
  it('skips draft-only shifts and timesOff', () => {
    expect(hasPublishedSharedShift(publishedDeskShift)).toBe(true);
    expect(hasPublishedSharedShift(draftOnlyShift)).toBe(false);
    expect(hasPublishedSharedTimeOff(publishedTimeOff)).toBe(true);
    expect(hasPublishedSharedTimeOff(draftOnlyTimeOff)).toBe(false);
  });

  it('uses sharedShift when a draft edit also exists', () => {
    const dto = mapGraphShiftToDto(publishedDeskShift);
    expect(dto.localStartTime).toBe('08:00');
    expect(dto.theme).toBe('green');
    expect(dto.isRemote).toBe(false);
  });

  it('selects the named scheduling group case-insensitively', () => {
    const group = selectSchedulingGroup(schedulingGroups, 'service desk');
    expect(group.id).toBe('TAG_service-desk');
    expect(() => selectSchedulingGroup(schedulingGroups, 'Missing')).toThrow(
      'Teams scheduling group "Missing" was not found',
    );
  });

  it('keeps Service Desk published shifts and drops Help Desk / drafts / outside window', () => {
    const window = termWindowToUtcRange(TERM_WINDOW.startDate, TERM_WINDOW.endDate);
    const userIds = new Set([USER_A_ID, USER_B_ID]);
    const inScope = allShifts.filter((shift) =>
      isShiftInScope(shift, 'TAG_service-desk', userIds, window),
    );

    expect(inScope.map((shift) => shift.id)).toEqual([
      'SHFT_published_a',
      'SHFT_published_b',
    ]);
    expect(inScope.some((shift) => shift.id === draftOnlyShift.id)).toBe(false);
    expect(inScope.some((shift) => shift.id === helpDeskShift.id)).toBe(false);
  });

  it('keeps published Service Desk time off only', () => {
    const window = termWindowToUtcRange(TERM_WINDOW.startDate, TERM_WINDOW.endDate);
    const userIds = new Set([USER_A_ID, USER_B_ID]);
    const inScope = allTimesOff.filter((timeOff) =>
      isTimeOffInScope(timeOff, userIds, window),
    );

    expect(inScope.map((timeOff) => timeOff.id)).toEqual(['TOFF_published_a']);
    expect(inScope.some((timeOff) => timeOff.id === helpDeskTimeOff.id)).toBe(false);
  });
});

describe('fetchTeamsShiftsForTerm', () => {
  it('throws when Graph is not configured and no client is injected', async () => {
    await expect(
      fetchTeamsShiftsForTerm(TERM_WINDOW, {
        graphConfig: resolveMicrosoftGraphConfig({}),
      }),
    ).rejects.toThrow(GRAPH_NOT_CONFIGURED_MESSAGE);
  });

  it('requires a provisioned schedule', async () => {
    await expect(
      fetchTeamsShiftsForTerm(TERM_WINDOW, {
        client: createFixtureClient({ schedule: unprovisionedSchedule }),
        teamId: TEAM_ID,
      }),
    ).rejects.toThrow('Teams schedule is not provisioned');

    expect(() => assertScheduleProvisioned(provisionedSchedule)).not.toThrow();
  });

  it('returns DTOs for the filtered roster, published shifts, and published time off', async () => {
    const snapshot = await fetchTeamsShiftsForTerm(TERM_WINDOW, {
      client: createFixtureClient(),
      teamId: TEAM_ID,
      schedulingGroup: 'Service Desk',
    });

    expect(snapshot.teamId).toBe(TEAM_ID);
    expect(snapshot.schedulingGroupId).toBe('TAG_service-desk');
    expect(snapshot.timeZone).toBe('America/Los_Angeles');
    expect(snapshot.members.map((member) => member.entraUserId).sort()).toEqual([
      USER_A_ID,
      USER_B_ID,
    ]);
    expect(snapshot.members.some((member) => member.entraUserId === USER_C_ID)).toBe(
      false,
    );

    expect(snapshot.shifts.map((shift) => shift.id).sort()).toEqual([
      'SHFT_published_a',
      'SHFT_published_b',
    ]);
    expect(snapshot.timesOff.map((timeOff) => timeOff.id)).toEqual([
      'TOFF_published_a',
    ]);
    expect(snapshot.timesOff[0].timeOffReason).toBe('Vacation');
  });

  it('falls back to team member profile when GET /users fails', async () => {
    const snapshot = await fetchTeamsShiftsForTerm(TERM_WINDOW, {
      client: createFixtureClient({ userLookupErrorIds: new Set([USER_B_ID]) }),
      teamId: TEAM_ID,
    });

    const ben = snapshot.members.find((member) => member.entraUserId === USER_B_ID);
    expect(ben).toMatchObject({
      mail: 'ben@calpoly.edu',
      displayName: 'Ben Bitdiddle',
      givenName: null,
      surname: null,
    });
  });
});
