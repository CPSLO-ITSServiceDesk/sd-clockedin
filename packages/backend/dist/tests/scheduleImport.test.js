"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const scheduleImportParser_1 = require("../lib/scheduleImportParser");
const scheduleImportTransform_1 = require("../lib/scheduleImportTransform");
const fixturePath = (0, node_path_1.join)(__dirname, 'fixtures', 'schedule-import-sample.csv');
(0, vitest_1.describe)('scheduleImportParser', () => {
    (0, vitest_1.it)('parses When I Work CSV rows', () => {
        const buffer = (0, node_fs_1.readFileSync)(fixturePath);
        const rows = (0, scheduleImportParser_1.parseScheduleSpreadsheet)(buffer, 'sample.csv');
        (0, vitest_1.expect)(rows).toHaveLength(4);
        (0, vitest_1.expect)(rows[0]).toMatchObject({
            member: 'Darryl James Arce Cruz',
            workEmail: 'dcruz44@calpoly.edu',
            startDate: '6/22/2026',
            startTime: '08:00',
            endTime: '11:00',
        });
    });
    (0, vitest_1.it)('only imports Service Desk group rows', () => {
        const buffer = (0, node_fs_1.readFileSync)(fixturePath);
        const rows = (0, scheduleImportParser_1.parseScheduleSpreadsheet)(buffer, 'sample.csv');
        (0, vitest_1.expect)(rows).toHaveLength(4);
        (0, vitest_1.expect)(rows.every((row) => row.workEmail !== 'jdiaz183@calpoly.edu')).toBe(true);
    });
    (0, vitest_1.it)('rejects files with missing headers', () => {
        const buffer = Buffer.from('Member,Email\nAlice,alice@test.com');
        (0, vitest_1.expect)(() => (0, scheduleImportParser_1.parseScheduleSpreadsheet)(buffer, 'bad.csv')).toThrow('Row 1 must contain the header columns');
    });
    (0, vitest_1.it)('reads the Shifts sheet from a multi-sheet When I Work xlsx', () => {
        const xlsxPath = (0, node_path_1.join)(__dirname, '../../../../ScheduleImportFormat_2026-6-22_TO_2026-6-28_TEAM_9ae983c2-abc1-4ebd-9625-8330e4e042c9_f1cd392811b6463e9da1dcf78d9b5ad5.xlsx');
        let buffer;
        try {
            buffer = (0, node_fs_1.readFileSync)(xlsxPath);
        }
        catch {
            return;
        }
        const rows = (0, scheduleImportParser_1.parseScheduleSpreadsheet)(buffer, 'schedule.xlsx');
        (0, vitest_1.expect)(rows.length).toBeGreaterThan(100);
        (0, vitest_1.expect)(rows.length).toBeLessThan(131);
        (0, vitest_1.expect)(rows.every((row) => row.workEmail !== 'jdiaz183@calpoly.edu')).toBe(true);
        (0, vitest_1.expect)(rows[0]).toMatchObject({
            member: 'Darryl James Arce Cruz',
            workEmail: 'dcruz44@calpoly.edu',
        });
    });
});
(0, vitest_1.describe)('scheduleImportTransform', () => {
    (0, vitest_1.it)('maps dates to weekday blocks grouped by email', () => {
        const buffer = (0, node_fs_1.readFileSync)(fixturePath);
        const rows = (0, scheduleImportParser_1.parseScheduleSpreadsheet)(buffer, 'sample.csv');
        const result = (0, scheduleImportTransform_1.transformImportRows)(rows, '2026-06-01', '2026-06-30');
        (0, vitest_1.expect)(result.skippedRows).toBe(0);
        (0, vitest_1.expect)(result.students).toHaveLength(2);
        const darryl = result.students.find((student) => student.workEmail === 'dcruz44@calpoly.edu');
        (0, vitest_1.expect)(darryl).toBeDefined();
        (0, vitest_1.expect)(darryl.blocks).toEqual(vitest_1.expect.arrayContaining([
            { day: 'monday', start_time: '08:00', end_time: '11:00' },
            { day: 'monday', start_time: '12:00', end_time: '17:00' },
            { day: 'tuesday', start_time: '08:00', end_time: '11:00' },
        ]));
        (0, vitest_1.expect)(darryl.firstName).toBe('Darryl');
        (0, vitest_1.expect)(darryl.lastName).toBe('James Arce Cruz');
    });
    (0, vitest_1.it)('skips rows outside the selected term', () => {
        const buffer = (0, node_fs_1.readFileSync)(fixturePath);
        const rows = (0, scheduleImportParser_1.parseScheduleSpreadsheet)(buffer, 'sample.csv');
        const result = (0, scheduleImportTransform_1.transformImportRows)(rows, '2025-01-01', '2025-01-31');
        (0, vitest_1.expect)(result.students).toHaveLength(0);
        (0, vitest_1.expect)(result.skippedRows).toBe(4);
        (0, vitest_1.expect)(result.warnings.some((warning) => warning.includes('outside'))).toBe(true);
    });
});
(0, vitest_1.describe)('normalizeTime', () => {
    (0, vitest_1.it)('normalizes HH:mm values', () => {
        (0, vitest_1.expect)((0, scheduleImportTransform_1.normalizeTime)('8:00')).toBe('08:00');
        (0, vitest_1.expect)((0, scheduleImportTransform_1.normalizeTime)('17:00')).toBe('17:00');
        (0, vitest_1.expect)((0, scheduleImportTransform_1.normalizeTime)('bad')).toBeNull();
    });
});
