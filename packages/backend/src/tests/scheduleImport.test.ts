import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScheduleSpreadsheet } from '../lib/scheduleImportParser';
import { normalizeTime, transformImportRows } from '../lib/scheduleImportTransform';

const fixturePath = join(__dirname, 'fixtures', 'schedule-import-sample.csv');

describe('scheduleImportParser', () => {
  it('parses When I Work CSV rows', () => {
    const buffer = readFileSync(fixturePath);
    const rows = parseScheduleSpreadsheet(buffer, 'sample.csv');

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      member: 'Darryl James Arce Cruz',
      workEmail: 'dcruz44@calpoly.edu',
      startDate: '6/22/2026',
      startTime: '08:00',
      endTime: '11:00',
    });
  });

  it('only imports Service Desk group rows', () => {
    const buffer = readFileSync(fixturePath);
    const rows = parseScheduleSpreadsheet(buffer, 'sample.csv');

    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.workEmail !== 'jdiaz183@calpoly.edu')).toBe(
      true,
    );
  });

  it('rejects files with missing headers', () => {
    const buffer = Buffer.from('Member,Email\nAlice,alice@test.com');
    expect(() => parseScheduleSpreadsheet(buffer, 'bad.csv')).toThrow(
      'Row 1 must contain the header columns',
    );
  });

  it('reads the Shifts sheet from a multi-sheet When I Work xlsx', () => {
    const xlsxPath = join(
      __dirname,
      '../../../../ScheduleImportFormat_2026-6-22_TO_2026-6-28_TEAM_9ae983c2-abc1-4ebd-9625-8330e4e042c9_f1cd392811b6463e9da1dcf78d9b5ad5.xlsx',
    );

    let buffer: Buffer;
    try {
      buffer = readFileSync(xlsxPath);
    } catch {
      return;
    }

    const rows = parseScheduleSpreadsheet(buffer, 'schedule.xlsx');
    expect(rows.length).toBeGreaterThan(100);
    expect(rows.length).toBeLessThan(131);
    expect(rows.every((row) => row.workEmail !== 'jdiaz183@calpoly.edu')).toBe(
      true,
    );
    expect(rows[0]).toMatchObject({
      member: 'Darryl James Arce Cruz',
      workEmail: 'dcruz44@calpoly.edu',
    });
  });
});

describe('scheduleImportTransform', () => {
  it('maps dates to weekday blocks grouped by email', () => {
    const buffer = readFileSync(fixturePath);
    const rows = parseScheduleSpreadsheet(buffer, 'sample.csv');
    const result = transformImportRows(rows, '2026-06-01', '2026-06-30');

    expect(result.skippedRows).toBe(0);
    expect(result.students).toHaveLength(2);

    const darryl = result.students.find(
      (student) => student.workEmail === 'dcruz44@calpoly.edu',
    );
    expect(darryl).toBeDefined();
    expect(darryl!.blocks).toEqual(
      expect.arrayContaining([
        { day: 'monday', start_time: '08:00', end_time: '11:00' },
        { day: 'monday', start_time: '12:00', end_time: '17:00' },
        { day: 'tuesday', start_time: '08:00', end_time: '11:00' },
      ]),
    );

    expect(darryl!.firstName).toBe('Darryl');
    expect(darryl!.lastName).toBe('James Arce Cruz');
  });

  it('skips rows outside the selected term', () => {
    const buffer = readFileSync(fixturePath);
    const rows = parseScheduleSpreadsheet(buffer, 'sample.csv');
    const result = transformImportRows(rows, '2025-01-01', '2025-01-31');

    expect(result.students).toHaveLength(0);
    expect(result.skippedRows).toBe(4);
    expect(result.warnings.some((warning) => warning.includes('outside'))).toBe(
      true,
    );
  });
});

describe('normalizeTime', () => {
  it('normalizes HH:mm values', () => {
    expect(normalizeTime('8:00')).toBe('08:00');
    expect(normalizeTime('17:00')).toBe('17:00');
    expect(normalizeTime('bad')).toBeNull();
  });
});
