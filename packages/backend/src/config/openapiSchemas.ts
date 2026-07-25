import type {
  Components,
  Reference,
  Response as ResponseObject,
  Schema,
} from 'swagger-jsdoc';

const ref = (name: string): Reference => ({
  $ref: `#/components/schemas/${name}`,
});

const list = (name: string): Schema => ({ type: 'array', items: ref(name) });

// OAS 3.0 has no null type, so a nullable $ref has to be wrapped. The sibling
// `type` is required for `nullable` to actually apply to the wrapper.
const nullableRef = (name: string, type: string): Schema => ({
  type,
  nullable: true,
  allOf: [ref(name)],
});

/** Wraps a payload in the `{ success: true, data }` envelope every controller returns. */
function ok(description: string, data: Schema | Reference): ResponseObject {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { success: { type: 'boolean', example: true }, data },
        },
      },
    },
  };
}

function fail(description: string, schema: Reference): ResponseObject {
  return {
    description,
    content: { 'application/json': { schema } },
  };
}

const timestamp = (example: string): Schema => ({
  type: 'string',
  format: 'date-time',
  example,
});

const clockTime = (example: string): Schema => ({
  type: 'string',
  description: '24-hour HH:mm in the organization timezone.',
  example,
});

export const schemas: NonNullable<Components['schemas']> = {
  Weekday: {
    type: 'string',
    description: 'Schedules only cover weekdays.',
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  },
  StudentRole: {
    type: 'string',
    enum: ['student_lead', 'student_assistant'],
  },
  ShiftStatus: {
    type: 'string',
    description:
      'Live status of a shift relative to now. Arrivals within 10 minutes ' +
      'either side of the scheduled start count as on-time.',
    enum: ['incoming', 'on-time', 'late', 'early', 'absent', 'expected'],
  },
  ErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: { type: 'string', example: 'Term not found' },
    },
  },
  ValidationErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'field' },
            msg: { type: 'string', example: 'id must be an integer' },
            path: { type: 'string', example: 'id' },
            location: { type: 'string', example: 'params' },
            value: {},
          },
        },
      },
    },
  },

  TermOffDays: {
    type: 'object',
    description: 'Non-working dates and weekday swaps for a term.',
    properties: {
      vacations: {
        type: 'array',
        items: {
          type: 'object',
          properties: { date: { type: 'string', format: 'date' } },
        },
      },
      special_schedules: {
        type: 'array',
        description:
          'Dates that follow another weekday\u2019s schedule instead of their own.',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            swap_to_day: ref('Weekday'),
          },
        },
      },
    },
  },
  Term: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', nullable: true, example: 'Summer 2026' },
      start_date: {
        type: 'string',
        format: 'date',
        nullable: true,
        example: '2026-06-22',
      },
      end_date: {
        type: 'string',
        format: 'date',
        nullable: true,
        example: '2026-08-28',
      },
      is_active: { type: 'boolean', nullable: true, example: true },
      remote_shifts_allowed: { type: 'boolean', example: false },
      off_days: nullableRef('TermOffDays', 'object'),
      created_at: timestamp('2026-06-01T00:00:00.000Z'),
    },
  },
  TermInput: {
    type: 'object',
    description:
      'All fields are optional; omitted fields keep their database defaults.',
    properties: {
      name: { type: 'string', example: 'Summer 2026' },
      start_date: { type: 'string', format: 'date', example: '2026-06-22' },
      end_date: { type: 'string', format: 'date', example: '2026-08-28' },
      is_active: { type: 'boolean', example: true },
      remote_shifts_allowed: { type: 'boolean', example: false },
      off_days: ref('TermOffDays'),
    },
  },

  Schedule: {
    type: 'object',
    description:
      'Links a student to a term. The optional dates narrow the schedule to ' +
      'a window inside the term rather than the full term.',
    properties: {
      id: { type: 'integer', example: 10 },
      academic_term_id: { type: 'integer', nullable: true, example: 1 },
      student_assistant_id: { type: 'integer', nullable: true, example: 42 },
      start_date: {
        type: 'string',
        format: 'date',
        nullable: true,
        example: '2026-06-22',
      },
      end_date: {
        type: 'string',
        format: 'date',
        nullable: true,
        example: '2026-08-28',
      },
      created_at: timestamp('2026-06-01T00:00:00.000Z'),
    },
  },
  ScheduleInput: {
    type: 'object',
    properties: {
      academic_term_id: { type: 'integer', example: 1 },
      student_assistant_id: { type: 'integer', example: 42 },
      start_date: {
        type: 'string',
        format: 'date',
        nullable: true,
        example: '2026-06-22',
      },
      end_date: {
        type: 'string',
        format: 'date',
        nullable: true,
        example: '2026-08-28',
      },
    },
  },

  ScheduleBlock: {
    type: 'object',
    description: 'A recurring weekly shift slot belonging to a schedule.',
    properties: {
      id: { type: 'integer', example: 100 },
      schedule_id: { type: 'integer', nullable: true, example: 10 },
      days: nullableRef('Weekday', 'string'),
      start_time: { ...clockTime('09:00'), nullable: true },
      end_time: { ...clockTime('13:00'), nullable: true },
      is_remote: { type: 'boolean', example: false },
      created_at: timestamp('2026-06-01T00:00:00.000Z'),
    },
  },
  ScheduleBlockInput: {
    type: 'object',
    properties: {
      schedule_id: { type: 'integer', example: 10 },
      days: ref('Weekday'),
      start_time: clockTime('09:00'),
      end_time: clockTime('13:00'),
      is_remote: { type: 'boolean', example: false },
    },
  },

  StudentAssistant: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 42 },
      first_name: { type: 'string', nullable: true, example: 'Alex' },
      last_name: { type: 'string', nullable: true, example: 'Rivera' },
      work_email: {
        type: 'string',
        format: 'email',
        nullable: true,
        example: 'arivera@example.edu',
      },
      position: ref('StudentRole'),
      polycard_id: {
        type: 'integer',
        nullable: true,
        description: 'Campus card number used to clock in at the kiosk.',
        example: 100200300,
      },
      is_active: { type: 'boolean', nullable: true, example: true },
      created_at: timestamp('2026-06-01T00:00:00.000Z'),
    },
  },
  StudentAssistantInput: {
    type: 'object',
    required: ['position'],
    properties: {
      first_name: { type: 'string', example: 'Alex' },
      last_name: { type: 'string', example: 'Rivera' },
      work_email: {
        type: 'string',
        format: 'email',
        nullable: true,
        example: 'arivera@example.edu',
      },
      position: ref('StudentRole'),
      polycard_id: { type: 'integer', example: 100200300 },
      is_active: { type: 'boolean', example: true },
    },
  },
  StudentAssistantUpdate: {
    type: 'object',
    description: 'Only the supplied fields are changed.',
    properties: {
      first_name: { type: 'string', example: 'Alex' },
      last_name: { type: 'string', example: 'Rivera' },
      work_email: {
        type: 'string',
        format: 'email',
        nullable: true,
        example: 'arivera@example.edu',
      },
      position: ref('StudentRole'),
      polycard_id: { type: 'integer', example: 100200300 },
      is_active: { type: 'boolean', example: false },
    },
  },

  TimeEntry: {
    type: 'object',
    description:
      'One clock-in/clock-out pair. `schedule_block_id` is null when the ' +
      'entry could not be matched to a scheduled shift.',
    properties: {
      id: { type: 'integer', example: 5000 },
      student_assistant_id: { type: 'integer', nullable: true, example: 42 },
      schedule_block_id: { type: 'integer', nullable: true, example: 100 },
      clock_in: {
        ...timestamp('2026-06-22T16:00:00.000Z'),
        nullable: true,
      },
      clock_out: {
        ...timestamp('2026-06-22T20:00:00.000Z'),
        nullable: true,
        description: 'Null while the student is still clocked in.',
      },
      created_at: timestamp('2026-06-22T16:00:00.000Z'),
    },
  },
  TimeEntryInput: {
    type: 'object',
    properties: {
      student_assistant_id: { type: 'integer', nullable: true, example: 42 },
      schedule_block_id: { type: 'integer', nullable: true, example: 100 },
      clock_in: { ...timestamp('2026-06-22T16:00:00.000Z'), nullable: true },
      clock_out: { ...timestamp('2026-06-22T20:00:00.000Z'), nullable: true },
    },
  },
  ClockInRequest: {
    type: 'object',
    required: ['student_assistant_id'],
    properties: {
      student_assistant_id: { type: 'integer', example: 42 },
      clock_in: {
        ...timestamp('2026-06-22T16:00:00.000Z'),
        description: 'Defaults to now when omitted.',
      },
    },
  },
  ClockInResult: {
    type: 'object',
    properties: {
      timeEntry: ref('TimeEntry'),
      matchedBlock: {
        type: 'object',
        nullable: true,
        description:
          'The schedule block the clock-in was attributed to, or null if ' +
          'the student has no matching shift today.',
        properties: {
          id: { type: 'integer', example: 100 },
          startTime: clockTime('09:00'),
          endTime: clockTime('13:00'),
        },
      },
    },
  },
  CloseOpenRequest: {
    type: 'object',
    required: ['schedule_block_id', 'student_assistant_id'],
    properties: {
      schedule_block_id: { type: 'integer', example: 100 },
      student_assistant_id: { type: 'integer', example: 42 },
    },
  },
  CloseOpenByAssistantRequest: {
    type: 'object',
    required: ['student_assistant_id'],
    properties: { student_assistant_id: { type: 'integer', example: 42 } },
  },

  Admin: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 3 },
      email: {
        type: 'string',
        format: 'email',
        nullable: true,
        example: 'admin@example.edu',
      },
      first_name: { type: 'string', nullable: true, example: 'Dana' },
      last_name: { type: 'string', nullable: true, example: 'Wu' },
      isactive: { type: 'boolean', nullable: true, example: true },
      last_login: {
        ...timestamp('2026-07-24T18:30:00.000Z'),
        nullable: true,
      },
      created_at: timestamp('2026-01-15T00:00:00.000Z'),
    },
  },
  AdminInput: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', example: 'admin@example.edu' },
      first_name: { type: 'string', nullable: true, example: 'Dana' },
      last_name: { type: 'string', nullable: true, example: 'Wu' },
      isactive: { type: 'boolean', example: true },
    },
  },
  AdminUpdate: {
    type: 'object',
    description: 'Only the supplied fields are changed.',
    properties: {
      email: { type: 'string', format: 'email', example: 'admin@example.edu' },
      first_name: { type: 'string', nullable: true, example: 'Dana' },
      last_name: { type: 'string', nullable: true, example: 'Wu' },
      isactive: { type: 'boolean', example: false },
      last_login: { ...timestamp('2026-07-24T18:30:00.000Z'), nullable: true },
    },
  },
  AuthorizeRequest: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', example: 'admin@example.edu' },
      name: {
        type: 'string',
        description: 'Display name from the identity provider, used to ' +
          'backfill a blank admin record.',
        example: 'Dana Wu',
      },
    },
  },
  AuthorizeGranted: {
    type: 'object',
    properties: {
      allowed: { type: 'boolean', example: true },
      admin: ref('Admin'),
    },
  },
  AuthorizeDenied: {
    type: 'object',
    properties: {
      allowed: { type: 'boolean', example: false },
      message: { type: 'string', example: 'User is not an active admin' },
    },
  },

  TodayShift: {
    type: 'object',
    properties: {
      scheduleBlockId: {
        type: 'integer',
        nullable: true,
        description: 'Null for walk-in shifts with no scheduled block.',
        example: 100,
      },
      studentAssistantId: { type: 'integer', example: 42 },
      firstName: { type: 'string', example: 'Alex' },
      lastName: { type: 'string', example: 'Rivera' },
      role: { type: 'string', example: 'Student Assistant' },
      startTime: clockTime('09:00'),
      endTime: clockTime('13:00'),
      clockInActual: {
        ...timestamp('2026-06-22T16:02:00.000Z'),
        nullable: true,
      },
      clockOutActual: {
        ...timestamp('2026-06-22T20:00:00.000Z'),
        nullable: true,
      },
      timeEntryId: { type: 'integer', nullable: true, example: 5000 },
      status: ref('ShiftStatus'),
      isRemote: { type: 'boolean', example: false },
    },
  },
  TodayShiftsResult: {
    type: 'object',
    properties: {
      shifts: list('TodayShift'),
      remoteOnlyStudentIds: {
        type: 'array',
        description:
          'Students scheduled today for remote work only. Returned even ' +
          'when remote shifts are excluded from `shifts`.',
        items: { type: 'integer' },
        example: [42],
      },
    },
  },

  TimelinessSummary: {
    type: 'object',
    properties: {
      totalEvaluated: { type: 'integer', example: 120 },
      onTime: { type: 'integer', example: 95 },
      early: { type: 'integer', example: 10 },
      late: { type: 'integer', example: 12 },
      absent: { type: 'integer', example: 3 },
      unscheduled: { type: 'integer', example: 4 },
      onTimeRate: {
        type: 'number',
        description: 'Share of evaluated shifts marked on-time, 0\u20131.',
        example: 0.79,
      },
      punctualityRate: {
        type: 'number',
        description: 'Share arriving on-time or early, 0\u20131.',
        example: 0.88,
      },
      avgMinutesLate: { type: 'number', example: 4.2 },
    },
  },
  LateByTimeSlot: {
    type: 'object',
    properties: {
      startTime: clockTime('09:00'),
      lateCount: { type: 'integer', example: 6 },
      totalShifts: { type: 'integer', example: 40 },
      lateRate: { type: 'number', example: 0.15 },
    },
  },
  DailyTrendPoint: {
    type: 'object',
    properties: {
      date: { type: 'string', format: 'date', example: '2026-06-22' },
      punctual: { type: 'integer', example: 8 },
      late: { type: 'integer', example: 1 },
      absent: { type: 'integer', example: 0 },
    },
  },
  WeekdayPattern: {
    type: 'object',
    properties: {
      day: ref('Weekday'),
      late: { type: 'integer', example: 3 },
      absent: { type: 'integer', example: 1 },
      total: { type: 'integer', example: 24 },
    },
  },
  StudentLeaderboardEntry: {
    type: 'object',
    properties: {
      studentAssistantId: { type: 'integer', example: 42 },
      late: { type: 'integer', example: 5 },
      absent: { type: 'integer', example: 1 },
      total: { type: 'integer', example: 30 },
    },
  },
  StudentLateShift: {
    type: 'object',
    properties: {
      date: { type: 'string', format: 'date', example: '2026-06-22' },
      startTime: clockTime('09:00'),
      endTime: clockTime('13:00'),
      clockIn: { ...timestamp('2026-06-22T16:18:00.000Z'), nullable: true },
      minutesLate: { type: 'integer', example: 18 },
      status: { type: 'string', enum: ['late', 'absent', 'unscheduled'] },
    },
  },
  TermAnalytics: {
    type: 'object',
    properties: {
      summary: ref('TimelinessSummary'),
      dailyTrend: list('DailyTrendPoint'),
      lateByTimeSlot: list('LateByTimeSlot'),
      weekdayPatterns: list('WeekdayPattern'),
      lateLeaderboard: list('StudentLeaderboardEntry'),
    },
  },
  StudentAnalytics: {
    type: 'object',
    properties: {
      summary: ref('TimelinessSummary'),
      lateByTimeSlot: list('LateByTimeSlot'),
      weekdayPatterns: list('WeekdayPattern'),
      dailyTrend: list('DailyTrendPoint'),
      recentIssues: list('StudentLateShift'),
    },
  },

  UnmatchedReason: {
    type: 'string',
    description: 'Why an orphaned time entry could not be matched to a block.',
    enum: [
      'no_schedule',
      'outside_term_range',
      'no_blocks_that_day',
      'outside_window',
      'block_already_claimed',
    ],
  },
  NormalizationProposal: {
    type: 'object',
    properties: {
      timeEntryId: { type: 'integer', example: 5000 },
      studentAssistantId: { type: 'integer', example: 42 },
      studentName: { type: 'string', example: 'Alex Rivera' },
      date: { type: 'string', format: 'date', example: '2026-06-22' },
      clockIn: timestamp('2026-06-22T16:05:00.000Z'),
      clockOut: {
        ...timestamp('2026-06-22T20:00:00.000Z'),
        nullable: true,
      },
      proposedBlockId: { type: 'integer', example: 100 },
      blockStartTime: clockTime('09:00'),
      blockEndTime: clockTime('13:00'),
      blockDay: ref('Weekday'),
    },
  },
  NormalizationUnmatched: {
    type: 'object',
    properties: {
      timeEntryId: { type: 'integer', example: 5001 },
      studentAssistantId: { type: 'integer', example: 42 },
      studentName: { type: 'string', example: 'Alex Rivera' },
      date: { type: 'string', format: 'date', example: '2026-06-23' },
      clockIn: timestamp('2026-06-23T18:40:00.000Z'),
      reason: ref('UnmatchedReason'),
    },
  },
  NormalizationPreview: {
    type: 'object',
    properties: {
      summary: {
        type: 'object',
        properties: {
          totalUnscheduled: { type: 'integer', example: 14 },
          proposedMatches: { type: 'integer', example: 11 },
          noMatch: { type: 'integer', example: 3 },
        },
      },
      proposals: list('NormalizationProposal'),
      unmatched: list('NormalizationUnmatched'),
    },
  },
  NormalizationApplyRequest: {
    type: 'object',
    required: ['matches'],
    properties: {
      matches: {
        type: 'array',
        description:
          'Typically the accepted subset of the proposals from the preview.',
        items: {
          type: 'object',
          required: ['timeEntryId', 'scheduleBlockId'],
          properties: {
            timeEntryId: { type: 'integer', example: 5000 },
            scheduleBlockId: { type: 'integer', example: 100 },
          },
        },
      },
    },
  },
  NormalizationApplyResult: {
    type: 'object',
    properties: {
      applied: { type: 'integer', example: 10 },
      skipped: {
        type: 'array',
        description:
          'Matches rejected during the write, for example when another ' +
          'entry already claimed the block.',
        items: {
          type: 'object',
          properties: {
            timeEntryId: { type: 'integer', example: 5001 },
            reason: { type: 'string', example: 'Time entry not found' },
          },
        },
      },
    },
  },

  DraftScheduleBlock: {
    type: 'object',
    properties: {
      day: ref('Weekday'),
      start_time: clockTime('08:00'),
      end_time: clockTime('12:00'),
      is_remote: { type: 'boolean', example: false },
    },
  },
  ImportStudentPreview: {
    type: 'object',
    properties: {
      workEmail: {
        type: 'string',
        format: 'email',
        example: 'arivera@example.edu',
      },
      member: { type: 'string', example: 'Rivera, Alex' },
      action: {
        type: 'string',
        description:
          'Whether the row matched an existing student by work email or ' +
          'would create a new one.',
        enum: ['create', 'match'],
      },
      studentId: {
        type: 'integer',
        description: 'Present only when the row matched an existing student.',
        example: 42,
      },
      blockCount: { type: 'integer', example: 4 },
      remoteBlockCount: { type: 'integer', example: 1 },
      blocks: list('DraftScheduleBlock'),
    },
  },
  ScheduleImportSummary: {
    type: 'object',
    properties: {
      studentsCreated: { type: 'integer', example: 3 },
      studentsMatched: { type: 'integer', example: 12 },
      schedulesUpdated: { type: 'integer', example: 15 },
      totalBlocks: { type: 'integer', example: 58 },
      remoteBlocks: { type: 'integer', example: 6 },
      skippedRows: { type: 'integer', example: 2 },
      remoteRowsSkipped: { type: 'integer', example: 0 },
    },
  },
  ScheduleImportResult: {
    type: 'object',
    properties: {
      dryRun: {
        type: 'boolean',
        description: 'True when nothing was written to the database.',
        example: true,
      },
      termId: { type: 'integer', example: 1 },
      termName: { type: 'string', example: 'Summer 2026' },
      summary: ref('ScheduleImportSummary'),
      students: list('ImportStudentPreview'),
      warnings: {
        type: 'array',
        items: { type: 'string' },
        example: ['Row 12: missing work email'],
      },
    },
  },

  HoursByDay: {
    type: 'object',
    description: 'Total hours worked, keyed by YYYY-MM-DD. Days with no ' +
      'completed entries are omitted.',
    additionalProperties: { type: 'number' },
    example: { '2026-06-22': 4, '2026-06-23': 3.5 },
  },
};

export const responses: NonNullable<Components['responses']> = {
  ValidationError: fail(
    'Request failed express-validator checks',
    ref('ValidationErrorResponse'),
  ),
  NotFound: fail('Resource does not exist', ref('ErrorResponse')),
  ServerError: fail(
    'Unexpected server or database error',
    ref('ErrorResponse'),
  ),
  NoContent: { description: 'Deleted' },

  TermList: ok('All terms', list('Term')),
  Term: ok('The requested term', ref('Term')),
  TermCreated: ok('The created term', ref('Term')),

  ScheduleList: ok('All schedules', list('Schedule')),
  Schedule: ok('The requested schedule', ref('Schedule')),
  ScheduleCreated: ok('The created schedule', ref('Schedule')),

  ScheduleBlockList: ok('Matching schedule blocks', list('ScheduleBlock')),
  ScheduleBlock: ok('The requested schedule block', ref('ScheduleBlock')),
  ScheduleBlockCreated: ok('The created schedule block', ref('ScheduleBlock')),

  StudentAssistantList: ok('All student assistants', list('StudentAssistant')),
  StudentAssistant: ok(
    'The requested student assistant',
    ref('StudentAssistant'),
  ),
  StudentAssistantCreated: ok(
    'The created student assistant',
    ref('StudentAssistant'),
  ),

  TimeEntryList: ok('All time entries', list('TimeEntry')),
  TimeEntry: ok('The requested time entry', ref('TimeEntry')),
  TimeEntryCreated: ok('The created time entry', ref('TimeEntry')),
  ClockInResult: ok('The new time entry and its matched block', ref('ClockInResult')),

  AdminList: ok('All admins', list('Admin')),
  Admin: ok('The requested admin', ref('Admin')),
  AdminCreated: ok('The created admin', ref('Admin')),

  TodayShifts: ok("The day's shifts", ref('TodayShiftsResult')),
  TermAnalytics: ok('Punctuality metrics for the term', ref('TermAnalytics')),
  StudentAnalytics: ok(
    'Punctuality metrics for the student within the term',
    ref('StudentAnalytics'),
  ),
  NormalizationPreview: ok(
    'Proposed and rejected matches, with nothing written yet',
    ref('NormalizationPreview'),
  ),
  NormalizationApplyResult: ok(
    'Counts of applied and skipped matches',
    ref('NormalizationApplyResult'),
  ),
  ScheduleImportResult: ok(
    'Import preview or applied result',
    ref('ScheduleImportResult'),
  ),
  HoursByDay: ok('Hours worked per day', ref('HoursByDay')),
};
