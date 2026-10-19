import * as XLSX from 'xlsx';
import { SLOT_MINUTES, WEEKDAYS, type DaySlots, type Weekday } from './model';

/**
 * Reads a Microsoft Forms availability export (one row per response):
 * Email, Name, "What times are you available on Monday?" … Friday,
 * minimum / maximum / ideal weekly hours, and Additional Notes.
 */

export type AvailabilityField =
  | 'email'
  | 'name'
  | Weekday
  | 'min_hours'
  | 'max_hours'
  | 'ideal_hours'
  | 'notes';

export interface ColumnMapping {
  field: AvailabilityField;
  header: string;
  /** Rows with a non-empty value in this column. */
  filled: number;
}

export interface AvailabilityResponse {
  rowNumber: number;
  name: string;
  email: string;
  availability: DaySlots;
  min_hours: number | null;
  ideal_hours: number | null;
  max_hours: number | null;
  notes: string;
  warnings: string[];
}

export interface AvailabilityImportResult {
  columns: ColumnMapping[];
  responses: AvailabilityResponse[];
}

const FIELD_PATTERNS: [AvailabilityField, RegExp][] = [
  ['email', /^e-?mail$/i],
  ['name', /^name$/i],
  ...WEEKDAYS.map((day): [AvailabilityField, RegExp] => [day, new RegExp(`available on ${day}`, 'i')]),
  ['min_hours', /minimum number of hours/i],
  ['max_hours', /maximum number of hours/i],
  ['ideal_hours', /ideal number of hours/i],
  ['notes', /notes/i],
];

const REQUIRED_FIELDS: AvailabilityField[] = ['name', ...WEEKDAYS];

const DAY_LABEL: Record<Weekday, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
};

/** Forms' "Available all day" option when it doesn't spell out the hours. */
const ALL_DAY_MINUTES: [number, number] = [8 * 60, 17 * 60];

const RANGE_PATTERN =
  /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;

function to24h(hour: number, meridiem: string): number {
  const pm = meridiem.toLowerCase() === 'pm';
  if (hour === 12) return pm ? 12 : 0;
  return pm ? hour + 12 : hour;
}

/** Parse "10–11 AM", "11 AM–12 PM", "8-10:20 AM", "1:30 - 3:00 PM" into minutes since midnight. */
export function parseTimeRange(text: string): [number, number] | null {
  const match = RANGE_PATTERN.exec(text);
  if (!match) return null;
  const [, sh, sm, smer, eh, em, emer] = match;
  const endMinutes = to24h(Number(eh), emer) * 60 + Number(em ?? 0);
  let startMinutes = to24h(Number(sh), smer ?? emer) * 60 + Number(sm ?? 0);
  // "11–1 PM" means 11 AM to 1 PM.
  if (!smer && startMinutes >= endMinutes) startMinutes -= 12 * 60;
  if (startMinutes < 0 || startMinutes >= endMinutes) return null;
  return [startMinutes, endMinutes];
}

/** Half-hour slots fully inside [start, end): "8-10:20 AM" gives 8:00–10:00. */
export function minutesToSlots([start, end]: [number, number]): number[] {
  const slots: number[] = [];
  for (let slot = Math.ceil(start / SLOT_MINUTES); (slot + 1) * SLOT_MINUTES <= end; slot += 1) {
    slots.push(slot);
  }
  return slots;
}

/** One weekday cell: semicolon-separated picks plus any free text a student typed in. */
export function parseDayCell(cell: string): { slots: number[]; unread: string[] } {
  const slots = new Set<number>();
  const unread: string[] = [];

  for (const raw of cell.split(';')) {
    const token = raw.trim();
    if (!token) continue;

    const range = parseTimeRange(token);
    if (range) {
      minutesToSlots(range).forEach((slot) => slots.add(slot));
      continue;
    }
    if (/available all day/i.test(token)) {
      minutesToSlots(ALL_DAY_MINUTES).forEach((slot) => slots.add(slot));
      continue;
    }
    unread.push(token);
  }

  return { slots: [...slots].sort((a, b) => a - b), unread };
}

function parseHours(value: string): number | null {
  const match = /\d+(\.\d+)?/.exec(value);
  return match ? Number(match[0]) : null;
}

function mapColumns(header: string[]): Map<AvailabilityField, number> {
  const columns = new Map<AvailabilityField, number>();
  header.forEach((title, index) => {
    const clean = title.replace(/^﻿/, '').trim();
    for (const [field, pattern] of FIELD_PATTERNS) {
      if (!columns.has(field) && pattern.test(clean)) {
        columns.set(field, index);
        break;
      }
    }
  });
  return columns;
}

export function parseAvailabilityWorkbook(buffer: Buffer, filename: string): AvailabilityImportResult {
  // Forms CSVs are UTF-8 (en dashes in "10–11 AM"); SheetJS would read a raw buffer as Latin-1.
  const workbook = filename.toLowerCase().endsWith('.csv')
    ? XLSX.read(buffer.toString('utf8').replace(/^\uFEFF/, ''), { type: 'string', raw: true })
    : XLSX.read(buffer, { type: 'buffer' });

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: '',
    });
    if (rows.length === 0) continue;

    const header = rows[0].map((value) => String(value ?? ''));
    const columns = mapColumns(header);
    if (!REQUIRED_FIELDS.every((field) => columns.has(field))) continue;

    return buildResult(header, columns, rows.slice(1));
  }

  throw new Error(
    'No availability responses found. Expected a Forms export with Name and "What times are you available on Monday…Friday" columns.',
  );
}

function buildResult(
  header: string[],
  columns: Map<AvailabilityField, number>,
  dataRows: unknown[][],
): AvailabilityImportResult {
  const cell = (row: unknown[], field: AvailabilityField) => {
    const index = columns.get(field);
    return index == null ? '' : String(row[index] ?? '').trim();
  };

  const responses: AvailabilityResponse[] = [];
  dataRows.forEach((row, index) => {
    const name = cell(row, 'name');
    const email = cell(row, 'email').toLowerCase();
    if (!name && !email) return;

    const availability: DaySlots = {};
    const warnings: string[] = [];
    for (const day of WEEKDAYS) {
      const { slots, unread } = parseDayCell(cell(row, day));
      if (slots.length > 0) availability[day] = slots;
      unread.forEach((text) => warnings.push(`${DAY_LABEL[day]}: ${text}`));
    }

    responses.push({
      rowNumber: index + 2,
      name,
      email,
      availability,
      min_hours: parseHours(cell(row, 'min_hours')),
      ideal_hours: parseHours(cell(row, 'ideal_hours')),
      max_hours: parseHours(cell(row, 'max_hours')),
      notes: cell(row, 'notes'),
      warnings,
    });
  });

  const mapping: ColumnMapping[] = [...columns.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([field, index]) => ({
      field,
      header: header[index].replace(/^﻿/, '').trim(),
      filled: dataRows.filter((row) => String(row[index] ?? '').trim() !== '').length,
    }));

  return { columns: mapping, responses };
}
