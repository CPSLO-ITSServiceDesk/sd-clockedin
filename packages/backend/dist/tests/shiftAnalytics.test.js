"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shiftAnalytics_1 = require("../lib/shiftAnalytics");
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
        is_remote: true,
        created_at: '2026-06-01T00:00:00Z',
    },
];
const now = new Date(2026, 5, 23, 12, 0);
(0, vitest_1.describe)('expandEvaluatedShifts', () => {
    (0, vitest_1.it)('expands in-person blocks and excludes remote and vacation days', () => {
        const shifts = (0, shiftAnalytics_1.expandEvaluatedShifts)(term, schedules, scheduleBlocks, [], { now });
        (0, vitest_1.expect)(shifts.map((shift) => shift.date)).toEqual(['2026-06-22']);
        (0, vitest_1.expect)(shifts.every((shift) => !shift.startTime.includes('13:00'))).toBe(true);
    });
    (0, vitest_1.it)('matches time entries by block, student, and clock-in date', () => {
        const timeEntries = [
            {
                id: 1,
                schedule_block_id: 20,
                student_assistant_id: 100,
                clock_in: '2026-06-22T09:10:00',
                clock_out: '2026-06-22T12:00:00',
                created_at: '2026-06-22T09:10:00Z',
            },
        ];
        const shifts = (0, shiftAnalytics_1.expandEvaluatedShifts)(term, schedules, scheduleBlocks, timeEntries, { now });
        (0, vitest_1.expect)(shifts).toHaveLength(1);
        (0, vitest_1.expect)(shifts[0].status).toBe('late');
        (0, vitest_1.expect)(shifts[0].minutesLate).toBe(5);
    });
    (0, vitest_1.it)('marks past shifts without clock-in as absent', () => {
        const shifts = (0, shiftAnalytics_1.expandEvaluatedShifts)(term, schedules, scheduleBlocks, [], { now });
        (0, vitest_1.expect)(shifts[0].status).toBe('absent');
    });
});
(0, vitest_1.describe)('buildTermAnalytics', () => {
    (0, vitest_1.it)('aggregates summary and late-by-slot metrics', () => {
        const timeEntries = [
            {
                id: 1,
                schedule_block_id: 20,
                student_assistant_id: 100,
                clock_in: '2026-06-22T09:00:00',
                clock_out: '2026-06-22T12:00:00',
                created_at: '2026-06-22T09:00:00Z',
            },
        ];
        const result = (0, shiftAnalytics_1.buildTermAnalytics)(term, schedules, scheduleBlocks, timeEntries, now);
        (0, vitest_1.expect)(result.summary.totalEvaluated).toBe(1);
        (0, vitest_1.expect)(result.summary.onTime).toBe(1);
        (0, vitest_1.expect)(result.dailyTrend).toHaveLength(1);
        (0, vitest_1.expect)(result.lateByTimeSlot[0]).toMatchObject({
            startTime: '09:00',
            lateCount: 0,
            totalShifts: 1,
        });
    });
});
(0, vitest_1.describe)('buildStudentAnalytics', () => {
    (0, vitest_1.it)('returns student-specific recent issues', () => {
        const timeEntries = [
            {
                id: 1,
                schedule_block_id: 20,
                student_assistant_id: 100,
                clock_in: '2026-06-22T09:15:00',
                clock_out: '2026-06-22T12:00:00',
                created_at: '2026-06-22T09:15:00Z',
            },
        ];
        const result = (0, shiftAnalytics_1.buildStudentAnalytics)(term, 100, schedules, scheduleBlocks, timeEntries, now);
        (0, vitest_1.expect)(result.summary.late).toBe(1);
        (0, vitest_1.expect)(result.recentIssues).toHaveLength(1);
        (0, vitest_1.expect)(result.recentIssues[0].status).toBe('late');
        (0, vitest_1.expect)(result.recentIssues[0].minutesLate).toBe(10);
    });
});
