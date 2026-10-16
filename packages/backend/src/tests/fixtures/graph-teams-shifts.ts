import type {
  GraphSchedule,
  GraphSchedulingGroup,
  GraphShift,
  GraphTeamMember,
  GraphTimeOff,
  GraphTimeOffReason,
  GraphUser,
} from '../../lib/teamsShiftsAdapter';

export const TEAM_ID = 'team-service-desk';
export const SERVICE_DESK_GROUP_ID = 'TAG_service-desk';
export const HELP_DESK_GROUP_ID = 'TAG_help-desk';

export const USER_A_ID = '11111111-1111-1111-1111-111111111111';
export const USER_B_ID = '22222222-2222-2222-2222-222222222222';
export const USER_C_ID = '33333333-3333-3333-3333-333333333333';

export const VACATION_REASON_ID = 'TOR_vacation';

/** 2026-06-22 through 2026-06-26 in America/Los_Angeles (PDT, UTC-7). */
export const TERM_WINDOW = { startDate: '2026-06-22', endDate: '2026-06-26' };

export const provisionedSchedule: GraphSchedule = {
  id: TEAM_ID,
  enabled: true,
  timeZone: 'Pacific Standard Time',
  provisionStatus: 'Completed',
};

export const unprovisionedSchedule: GraphSchedule = {
  id: TEAM_ID,
  enabled: false,
  provisionStatus: 'NotStarted',
};

export const schedulingGroups: GraphSchedulingGroup[] = [
  {
    id: SERVICE_DESK_GROUP_ID,
    displayName: 'Service Desk',
    isActive: true,
    userIds: [USER_A_ID, USER_B_ID],
  },
  {
    id: HELP_DESK_GROUP_ID,
    displayName: 'Help Desk',
    isActive: true,
    userIds: [USER_C_ID],
  },
];

export const teamMembers: GraphTeamMember[] = [
  {
    id: 'member-a',
    userId: USER_A_ID,
    displayName: 'Ada Lovelace',
    email: 'ada@calpoly.edu',
  },
  {
    id: 'member-b',
    userId: USER_B_ID,
    displayName: 'Ben Bitdiddle',
    email: 'ben@calpoly.edu',
  },
  {
    id: 'member-c',
    userId: USER_C_ID,
    displayName: 'Cara Compiler',
    email: 'cara@calpoly.edu',
  },
];

export const graphUsers: Record<string, GraphUser> = {
  [USER_A_ID]: {
    id: USER_A_ID,
    mail: 'ada@calpoly.edu',
    userPrincipalName: 'ada@calpoly.edu',
    displayName: 'Ada Lovelace',
    givenName: 'Ada',
    surname: 'Lovelace',
  },
  [USER_B_ID]: {
    id: USER_B_ID,
    mail: null,
    userPrincipalName: 'ben@calpoly.edu',
    displayName: 'Ben Bitdiddle',
    givenName: 'Ben',
    surname: 'Bitdiddle',
  },
};

export const timeOffReasons: GraphTimeOffReason[] = [
  {
    id: VACATION_REASON_ID,
    displayName: 'Vacation',
    isActive: true,
  },
];

export const publishedDeskShift: GraphShift = {
  id: 'SHFT_published_a',
  userId: USER_A_ID,
  schedulingGroupId: SERVICE_DESK_GROUP_ID,
  sharedShift: {
    displayName: 'Morning',
    startDateTime: '2026-06-25T15:00:00.000Z',
    endDateTime: '2026-06-25T18:00:00.000Z',
    theme: 'green',
  },
  draftShift: {
    displayName: 'Unpublished edit',
    startDateTime: '2026-06-25T16:00:00.000Z',
    endDateTime: '2026-06-25T20:00:00.000Z',
    theme: 'blue',
  },
};

export const draftOnlyShift: GraphShift = {
  id: 'SHFT_draft_a',
  userId: USER_A_ID,
  schedulingGroupId: SERVICE_DESK_GROUP_ID,
  sharedShift: null,
  draftShift: {
    displayName: 'Not published',
    startDateTime: '2026-06-25T15:00:00.000Z',
    endDateTime: '2026-06-25T18:00:00.000Z',
    theme: 'blue',
  },
};

export const publishedRemoteShift: GraphShift = {
  id: 'SHFT_published_b',
  userId: USER_B_ID,
  schedulingGroupId: SERVICE_DESK_GROUP_ID,
  sharedShift: {
    displayName: 'Remote block',
    startDateTime: '2026-06-25T19:00:00.000Z',
    endDateTime: '2026-06-26T00:00:00.000Z',
    theme: 'blue',
  },
};

export const helpDeskShift: GraphShift = {
  id: 'SHFT_help_desk_c',
  userId: USER_C_ID,
  schedulingGroupId: HELP_DESK_GROUP_ID,
  sharedShift: {
    displayName: 'Help Desk',
    startDateTime: '2026-06-25T15:00:00.000Z',
    endDateTime: '2026-06-25T18:00:00.000Z',
    theme: 'green',
  },
};

export const outsideWindowShift: GraphShift = {
  id: 'SHFT_outside_a',
  userId: USER_A_ID,
  schedulingGroupId: SERVICE_DESK_GROUP_ID,
  sharedShift: {
    displayName: 'Next month',
    startDateTime: '2026-07-10T15:00:00.000Z',
    endDateTime: '2026-07-10T18:00:00.000Z',
    theme: 'green',
  },
};

export const publishedTimeOff: GraphTimeOff = {
  id: 'TOFF_published_a',
  userId: USER_A_ID,
  sharedTimeOff: {
    displayName: 'Out of office',
    startDateTime: '2026-06-24T07:00:00.000Z',
    endDateTime: '2026-06-25T07:00:00.000Z',
    timeOffReasonId: VACATION_REASON_ID,
  },
  draftTimeOff: {
    displayName: 'Draft extension',
    startDateTime: '2026-06-24T07:00:00.000Z',
    endDateTime: '2026-06-26T07:00:00.000Z',
    timeOffReasonId: VACATION_REASON_ID,
  },
};

export const draftOnlyTimeOff: GraphTimeOff = {
  id: 'TOFF_draft_a',
  userId: USER_A_ID,
  sharedTimeOff: null,
  draftTimeOff: {
    displayName: 'Unpublished PTO',
    startDateTime: '2026-06-23T07:00:00.000Z',
    endDateTime: '2026-06-24T07:00:00.000Z',
    timeOffReasonId: VACATION_REASON_ID,
  },
};

export const helpDeskTimeOff: GraphTimeOff = {
  id: 'TOFF_help_desk_c',
  userId: USER_C_ID,
  sharedTimeOff: {
    displayName: 'Help Desk PTO',
    startDateTime: '2026-06-24T07:00:00.000Z',
    endDateTime: '2026-06-25T07:00:00.000Z',
    timeOffReasonId: VACATION_REASON_ID,
  },
};

export const outsideWindowTimeOff: GraphTimeOff = {
  id: 'TOFF_outside_b',
  userId: USER_B_ID,
  sharedTimeOff: {
    displayName: 'Later PTO',
    startDateTime: '2026-08-01T07:00:00.000Z',
    endDateTime: '2026-08-08T07:00:00.000Z',
    timeOffReasonId: VACATION_REASON_ID,
  },
};

export const allShifts: GraphShift[] = [
  publishedDeskShift,
  draftOnlyShift,
  publishedRemoteShift,
  helpDeskShift,
  outsideWindowShift,
];

export const allTimesOff: GraphTimeOff[] = [
  publishedTimeOff,
  draftOnlyTimeOff,
  helpDeskTimeOff,
  outsideWindowTimeOff,
];
