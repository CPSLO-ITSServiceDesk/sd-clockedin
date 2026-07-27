"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shiftNormalization_1 = require("../lib/shiftNormalization");
const term = {
    id: 1,
    name: 'Summer 2026',
    start_date: '2026-06-22',
    end_date: '2026-06-26',
    is_active: true,
    remote_shifts_allowed: false,
    off_days: {
        vacations: [{ date: '2026-06-24' }],
        special_schedules: [],
    },
    created_at: '2026-06-01T00:00:00Z',
};
const schedules = [
    {
        id: 10,
        academic_term_id: 1,
        student_assistant_id: 100,
        start_date: null,
        end_date: null,
        created_at: '2026-06-01T00:00:00Z',
    },
];
const scheduleBlocks = [
    {
        id: 20,
        schedule_id: 10,
        days: 'monday',
        start_time: '09:00',
        end_time: '12:00',
        is_remote: false,
        created_at: '2026-06-01T00:00:00Z',
    },
    {
        id: 21,
        schedule_id: 10,
        days: 'monday',
        start_time: '13:00',
        end_time: '16:00',
        is_remote: false,
        created_at: '2026-06-01T00:00:00Z',
    },
];
const students = [
    {
        id: 100,
        first_name: 'Alex',
        last_name: 'Student',
        is_active: true,
        polycard_id: null,
        position: 'student_assistant',
        work_email: 'alex@example.com',
        created_at: '2026-06-01T00:00:00Z',
    },
];
/** Monday 2026-06-22, 9:10 AM Pacific (PDT) */
const mondayMorningClockIn = '2026-06-22T16:10:00.000Z';
/** Monday 2026-06-22, 8:20 AM Pacific — within 60-min early window for 9:00 block */
const mondayEarlyClockIn = '2026-06-22T15:20:00.000Z';
/** Monday 2026-06-22, 7:00 AM Pacific — too early for 9:00 block */
const mondayTooEarlyClockIn = '2026-06-22T14:00:00.000Z';
/** Monday 2026-06-22, 1:30 PM Pacific */
const mondayAfternoonClockIn = '2026-06-22T20:30:00.000Z';
const now = new Date('2026-06-23T19:00:00.000Z');
(0, vitest_1.describe)('buildNormalizationPreview', () => {
    (0, vitest_1.it)('proposes a match when clock-in is within the early-arrival window', () => {
        const timeEntries = [
            {
                id: 1,
                schedule_block_id: null,
                student_assistant_id: 100,
                clock_in: mondayMorningClockIn,
                clock_out: '2026-06-22T19:00:00.000Z',
                created_at: '2026-06-22T09:10:00Z',
            },
        ];
        const preview = (0, shiftNormalization_1.buildNormalizationPreview)(term, schedules, scheduleBlocks, timeEntries, students, now);
        (0, vitest_1.expect)(preview.summary).toEqual({
            totalUnscheduled: 1,
            proposedMatches: 1,
            noMatch: 0,
        });
        (0, vitest_1.expect)(preview.proposals[0]).toMatchObject({
            timeEntryId: 1,
            proposedBlockId: 20,
            blockDay: 'monday',
        });
    });
    (0, vitest_1.it)('proposes a match for early arrival within 60 minutes of block start', () => {
        const timeEntries = [
            {
                id: 2,
                schedule_block_id: null,
                student_assistant_id: 100,
                clock_in: mondayEarlyClockIn,
                clock_out: null,
                created_at: '2026-06-22T08:20:00Z',
            },
        ];
        const preview = (0, shiftNormalization_1.buildNormalizationPreview)(term, schedules, scheduleBlocks, timeEntries, students, now);
        (0, vitest_1.expect)(preview.proposals).toHaveLength(1);
        (0, vitest_1.expect)(preview.proposals[0].proposedBlockId).toBe(20);
    });
    (0, vitest_1.it)('returns no match when clock-in is too early', () => {
        const timeEntries = [
            {
                id: 3,
                schedule_block_id: null,
                student_assistant_id: 100,
                clock_in: mondayTooEarlyClockIn,
                clock_out: null,
                created_at: '2026-06-22T07:00:00Z',
            },
        ];
        const preview = (0, shiftNormalization_1.buildNormalizationPreview)(term, schedules, scheduleBlocks, timeEntries, students, now);
        (0, vitest_1.expect)(preview.proposals).toHaveLength(0);
        (0, vitest_1.expect)(preview.unmatched[0].reason).toBe('outside_window');
    });
    (0, vitest_1.it)('skips when block is already claimed by another entry', () => {
        const singleBlock = scheduleBlocks.filter((b) => b.id === 20);
        const timeEntries = [
            {
                id: 10,
                schedule_block_id: 20,
                student_assistant_id: 100,
                clock_in: mondayMorningClockIn,
                clock_out: '2026-06-22T19:00:00.000Z',
                created_at: '2026-06-22T09:10:00Z',
            },
            {
                id: 11,
                schedule_block_id: null,
                student_assistant_id: 100,
                clock_in: mondayMorningClockIn,
                clock_out: null,
                created_at: '2026-06-22T09:15:00Z',
            },
        ];
        const preview = (0, shiftNormalization_1.buildNormalizationPreview)(term, schedules, singleBlock, timeEntries, students, now);
        (0, vitest_1.expect)(preview.proposals).toHaveLength(0);
        (0, vitest_1.expect)(preview.unmatched[0].reason).toBe('block_already_claimed');
    });
    (0, vitest_1.it)('assigns two unscheduled entries on the same day to different blocks', () => {
        const timeEntries = [
            {
                id: 20,
                schedule_block_id: null,
                student_assistant_id: 100,
                clock_in: mondayMorningClockIn,
                clock_out: '2026-06-22T19:00:00.000Z',
                created_at: '2026-06-22T09:10:00Z',
            },
            {
                id: 21,
                schedule_block_id: null,
                student_assistant_id: 100,
                clock_in: mondayAfternoonClockIn,
                clock_out: '2026-06-22T23:00:00.000Z',
                created_at: '2026-06-22T13:30:00Z',
            },
        ];
        const preview = (0, shiftNormalization_1.buildNormalizationPreview)(term, schedules, scheduleBlocks, timeEntries, students, now);
        (0, vitest_1.expect)(preview.proposals).toHaveLength(2);
        (0, vitest_1.expect)(preview.proposals.map((p) => p.proposedBlockId).sort()).toEqual([20, 21]);
    });
    (0, vitest_1.it)('excludes vacation days', () => {
        const timeEntries = [
            {
                id: 30,
                schedule_block_id: null,
                student_assistant_id: 100,
                clock_in: '2026-06-24T16:10:00.000Z',
                clock_out: null,
                created_at: '2026-06-24T09:10:00Z',
            },
        ];
        const afterTerm = new Date('2026-06-26T19:00:00.000Z');
        const preview = (0, shiftNormalization_1.buildNormalizationPreview)(term, schedules, scheduleBlocks, timeEntries, students, afterTerm);
        (0, vitest_1.expect)(preview.proposals).toHaveLength(0);
        (0, vitest_1.expect)(preview.unmatched[0].reason).toBe('no_blocks_that_day');
    });
    (0, vitest_1.it)('reports no_schedule when student has no term schedule', () => {
        const timeEntries = [
            {
                id: 40,
                schedule_block_id: null,
                student_assistant_id: 999,
                clock_in: mondayMorningClockIn,
                clock_out: null,
                created_at: '2026-06-22T09:10:00Z',
            },
        ];
        const preview = (0, shiftNormalization_1.buildNormalizationPreview)(term, schedules, scheduleBlocks, timeEntries, students, now);
        (0, vitest_1.expect)(preview.unmatched[0].reason).toBe('no_schedule');
    });
});
(0, vitest_1.describe)('validateNormalizationMatch', () => {
    const context = {
        term,
        schedules,
        scheduleBlocks,
        timeEntries: [
            {
                id: 1,
                schedule_block_id: null,
                student_assistant_id: 100,
                clock_in: mondayMorningClockIn,
                clock_out: null,
                created_at: '2026-06-22T09:10:00Z',
            },
        ],
        students,
    };
    (0, vitest_1.it)('accepts a valid proposed match', () => {
        const result = (0, shiftNormalization_1.validateNormalizationMatch)({ timeEntryId: 1, scheduleBlockId: 20 }, context, now);
        (0, vitest_1.expect)(result).toEqual({ valid: true });
    });
    (0, vitest_1.it)('rejects when entry is already linked', () => {
        const linkedContext = {
            ...context,
            timeEntries: [
                {
                    ...context.timeEntries[0],
                    schedule_block_id: 20,
                },
            ],
        };
        const result = (0, shiftNormalization_1.validateNormalizationMatch)({ timeEntryId: 1, scheduleBlockId: 20 }, linkedContext, now);
        (0, vitest_1.expect)(result).toEqual({
            valid: false,
            reason: 'Time entry already linked to a block',
        });
    });
    (0, vitest_1.it)('rejects when block is already claimed', () => {
        const claimedContext = {
            ...context,
            timeEntries: [
                ...context.timeEntries,
                {
                    id: 2,
                    schedule_block_id: 20,
                    student_assistant_id: 100,
                    clock_in: mondayMorningClockIn,
                    clock_out: '2026-06-22T19:00:00.000Z',
                    created_at: '2026-06-22T09:10:00Z',
                },
            ],
        };
        const result = (0, shiftNormalization_1.validateNormalizationMatch)({ timeEntryId: 1, scheduleBlockId: 20 }, claimedContext, now);
        (0, vitest_1.expect)(result).toEqual({
            valid: false,
            reason: 'Block already claimed for this student and date',
        });
    });
});
