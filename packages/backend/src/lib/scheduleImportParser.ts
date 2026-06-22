import * as XLSX from 'xlsx';

export const REQUIRED_HEADERS = [
  'Member',
  'Work Email',
  'Group',
  'Start Date',
  'Start Time',
  'End Date',
  'End Time',
] as const;

export const IMPORT_GROUP = 'Service Desk';

const PREFERRED_SHEET_NAMES = ['Shifts', 'Schedule', 'Schedules'];

export interface ScheduleImportRow {
  member: string;
  workEmail: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  rowNumber: number;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim();
}

function headerRowHasRequiredColumns(headerRow: string[]): boolean {
  const headerSet = new Set(headerRow.map(normalizeHeader).filter(Boolean));
  return REQUIRED_HEADERS.every((header) => headerSet.has(header));
}

function cellValue(row: unknown[], index: number): string {
  const value = row[index];
  if (value == null) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
}

function findWorksheetRows(workbook: XLSX.WorkBook): unknown[][] {
  for (const preferredName of PREFERRED_SHEET_NAMES) {
    const sheetName = workbook.SheetNames.find(
      (name) => name.toLowerCase() === preferredName.toLowerCase(),
    );
    if (!sheetName) continue;

    const rows = sheetToRows(workbook.Sheets[sheetName]);
    if (rows.length > 0 && headerRowHasRequiredColumns(rows[0].map(normalizeHeader))) {
      return rows;
    }
  }

  for (const sheetName of workbook.SheetNames) {
    const rows = sheetToRows(workbook.Sheets[sheetName]);
    if (rows.length > 0 && headerRowHasRequiredColumns(rows[0].map(normalizeHeader))) {
      return rows;
    }
  }

  throw new Error(
    'No worksheet found with schedule headers on row 1. Expected columns like Member, Work Email, Group, Start Date, and Start Time (When I Work exports usually include a Shifts sheet).',
  );
}

function parseWorksheetRows(rows: unknown[][]): ScheduleImportRow[] {
  if (rows.length === 0) {
    throw new Error('Spreadsheet is empty');
  }

  const headerRow = rows[0].map(normalizeHeader);
  if (!headerRowHasRequiredColumns(headerRow)) {
    const missing = REQUIRED_HEADERS.filter((header) => !headerRow.includes(header));
    throw new Error(
      `Row 1 must contain the header columns. Missing: ${missing.join(', ')}`,
    );
  }

  const headerIndex = new Map(headerRow.map((header, index) => [header, index]));

  const memberIdx = headerIndex.get('Member')!;
  const emailIdx = headerIndex.get('Work Email')!;
  const groupIdx = headerIndex.get('Group')!;
  const startDateIdx = headerIndex.get('Start Date')!;
  const startTimeIdx = headerIndex.get('Start Time')!;
  const endDateIdx = headerIndex.get('End Date')!;
  const endTimeIdx = headerIndex.get('End Time')!;

  const parsed: ScheduleImportRow[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!Array.isArray(row)) continue;

    const member = cellValue(row, memberIdx);
    const workEmail = cellValue(row, emailIdx).toLowerCase();
    const group = cellValue(row, groupIdx);
    const startDate = cellValue(row, startDateIdx);
    const startTime = cellValue(row, startTimeIdx);
    const endDate = cellValue(row, endDateIdx);
    const endTime = cellValue(row, endTimeIdx);

    if (!member && !workEmail && !startDate && !startTime) {
      continue;
    }

    if (group.toLowerCase() !== IMPORT_GROUP.toLowerCase()) {
      continue;
    }

    parsed.push({
      member,
      workEmail,
      startDate,
      startTime,
      endDate,
      endTime,
      rowNumber: rowIndex + 1,
    });
  }

  if (parsed.length === 0) {
    throw new Error(`No ${IMPORT_GROUP} schedule rows found in spreadsheet`);
  }

  return parsed;
}

function parseCsvRows(buffer: Buffer): unknown[][] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('Spreadsheet is empty');
  }

  return lines.map((line) => line.split(',').map((cell) => cell.trim()));
}

export function parseScheduleSpreadsheet(
  buffer: Buffer,
  filename: string,
): ScheduleImportRow[] {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith('.csv')) {
    return parseWorksheetRows(parseCsvRows(buffer));
  }

  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
    throw new Error('File must be .xlsx, .xls, or .csv');
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  if (workbook.SheetNames.length === 0) {
    throw new Error('Spreadsheet has no worksheets');
  }

  const rows = findWorksheetRows(workbook);
  return parseWorksheetRows(rows);
}
