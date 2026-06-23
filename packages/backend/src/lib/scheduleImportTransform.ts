import type { Database } from '../types/database.types';
import {
  parseThemeColorIsRemote,
  type ScheduleImportRow,
} from './scheduleImportParser';

type Weekday = Database['public']['Enums']['days'];

export interface DraftScheduleBlock {
  day: Weekday;
  start_time: string;
  end_time: string;
  is_remote: boolean;
}

export interface StudentScheduleImport {
  workEmail: string;
  member: string;
  firstName: string;
  lastName: string;
  blocks: DraftScheduleBlock[];
}

export interface TransformResult {
  students: StudentScheduleImport[];
  warnings: string[];
  skippedRows: number;
  remoteRowsSkipped: number;
}

const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

function parseMemberName(member: string): { firstName: string; lastName: string } {
  const trimmed = member.trim();
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) {
    return { firstName: trimmed, lastName: '' };
  }
  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1).trim(),
  };
}

function parseSpreadsheetDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(`${trimmed}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
}

function dateToIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateToWeekday(date: Date): Weekday | null {
  const dayIndex = date.getDay();
  if (dayIndex >= 1 && dayIndex <= 5) {
    return WEEKDAYS[dayIndex - 1];
  }
  return null;
}

export function normalizeTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function mergeBlocks(blocks: DraftScheduleBlock[]): DraftScheduleBlock[] {
  const sorted = [...blocks].sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
  );

  const merged: DraftScheduleBlock[] = [];

  for (const block of sorted) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.is_remote === block.is_remote &&
      timeToMinutes(block.start_time) <= timeToMinutes(last.end_time)
    ) {
      if (timeToMinutes(block.end_time) > timeToMinutes(last.end_time)) {
        last.end_time = block.end_time;
      }
      continue;
    }
    merged.push({ ...block });
  }

  return merged;
}

function mergeBlocksByDay(blocks: DraftScheduleBlock[]): DraftScheduleBlock[] {
  const byDayAndMode = new Map<string, DraftScheduleBlock[]>();

  for (const block of blocks) {
    const key = `${block.day}:${block.is_remote}`;
    const list = byDayAndMode.get(key) ?? [];
    list.push(block);
    byDayAndMode.set(key, list);
  }

  const result: DraftScheduleBlock[] = [];
  for (const day of WEEKDAYS) {
    for (const isRemote of [false, true]) {
      const dayBlocks = byDayAndMode.get(`${day}:${isRemote}`);
      if (!dayBlocks?.length) continue;
      result.push(...mergeBlocks(dayBlocks));
    }
  }

  return result;
}

export function transformImportRows(
  rows: ScheduleImportRow[],
  termStartDate: string,
  termEndDate: string,
  remoteShiftsAllowed = false,
): TransformResult {
  const warnings: string[] = [];
  let skippedRows = 0;
  let remoteRowsSkipped = 0;

  const byEmail = new Map<
    string,
    { member: string; blocks: DraftScheduleBlock[] }
  >();

  for (const row of rows) {
    if (!row.workEmail) {
      warnings.push(`Row ${row.rowNumber}: missing Work Email`);
      skippedRows += 1;
      continue;
    }

    if (!row.member) {
      warnings.push(`Row ${row.rowNumber}: missing Member name`);
      skippedRows += 1;
      continue;
    }

    const themeRemote = parseThemeColorIsRemote(row.themeColor);
    if (themeRemote === null) {
      warnings.push(
        `Row ${row.rowNumber}: unknown Theme Color "${row.themeColor}" — treated as in-person`,
      );
    }

    const isRemote = themeRemote === true;

    if (isRemote && !remoteShiftsAllowed) {
      warnings.push(
        `Row ${row.rowNumber}: remote shift skipped (term does not allow remote shifts)`,
      );
      skippedRows += 1;
      remoteRowsSkipped += 1;
      continue;
    }

    const startDate = parseSpreadsheetDate(row.startDate);
    if (!startDate) {
      warnings.push(`Row ${row.rowNumber}: invalid Start Date "${row.startDate}"`);
      skippedRows += 1;
      continue;
    }

    const weekday = dateToWeekday(startDate);
    if (!weekday) {
      warnings.push(
        `Row ${row.rowNumber}: ${row.startDate} falls on a weekend and was skipped`,
      );
      skippedRows += 1;
      continue;
    }

    const isoDate = dateToIsoDate(startDate);
    if (isoDate < termStartDate || isoDate > termEndDate) {
      warnings.push(
        `Row ${row.rowNumber}: ${row.startDate} is outside the selected term (${termStartDate}–${termEndDate})`,
      );
      skippedRows += 1;
      continue;
    }

    const startTime = normalizeTime(row.startTime);
    const endTime = normalizeTime(row.endTime);
    if (!startTime || !endTime) {
      warnings.push(`Row ${row.rowNumber}: invalid start or end time`);
      skippedRows += 1;
      continue;
    }

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      warnings.push(`Row ${row.rowNumber}: end time must be after start time`);
      skippedRows += 1;
      continue;
    }

    const existing = byEmail.get(row.workEmail) ?? {
      member: row.member,
      blocks: [],
    };
    existing.member = row.member;
    existing.blocks.push({
      day: weekday,
      start_time: startTime,
      end_time: endTime,
      is_remote: isRemote,
    });
    byEmail.set(row.workEmail, existing);
  }

  const students: StudentScheduleImport[] = [];

  for (const [workEmail, entry] of byEmail) {
    const { firstName, lastName } = parseMemberName(entry.member);
    const blocks = mergeBlocksByDay(entry.blocks);

    if (blocks.length === 0) continue;

    students.push({
      workEmail,
      member: entry.member,
      firstName,
      lastName,
      blocks,
    });
  }

  return { students, warnings, skippedRows, remoteRowsSkipped };
}
