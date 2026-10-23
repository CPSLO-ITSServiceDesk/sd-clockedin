import { withTimesheetMonthCache } from '../lib/derivedReadsCache';
import { supabase } from '../lib/supabase';
import {
  buildMonthTimesheets,
  emptyMonthTimesheet,
  monthBounds,
  type StudentMonthSummary,
  type StudentMonthTimesheet,
} from '../lib/timesheetMonth';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';
import { scheduleBlocksService } from './scheduleBlocksService';
import { schedulesService } from './schedulesService';
import { studentTimeOffService } from './studentTimeOffService';
import { termService } from './termService';
import { timeEntryService } from './timeEntryService';

type TimesheetVerification = Database['public']['Tables']['timesheet_verification']['Row'];

/** PostgREST/Postgres codes for a table that hasn't been created yet. */
const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01']);

export interface VerificationInfo {
  verifiedAt: string;
  verifiedBy: string | null;
}

export interface MonthTimesheetSummary {
  month: string;
  /** False until the timesheet_verification migration has been applied. */
  verificationAvailable: boolean;
  students: (StudentMonthSummary & { verification: VerificationInfo | null })[];
}

export type StudentMonthTimesheetResult = StudentMonthTimesheet & {
  month: string;
  verificationAvailable: boolean;
  verification: VerificationInfo | null;
};

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

async function computeMonth(month: string): Promise<StudentMonthTimesheet[]> {
  const { start, end } = monthBounds(month);
  // Pad a day each side so org-timezone edges are covered; the builder filters by org-local date.
  const fromIso = `${shiftDate(start, -1)}T00:00:00Z`;
  const toIso = `${shiftDate(end, 2)}T00:00:00Z`;

  const [terms, schedules, scheduleBlocks, timeEntries, timeOff] = await Promise.all([
    termService.getAll(),
    schedulesService.getAll(),
    scheduleBlocksService.getAll(),
    timeEntryService.getByClockInRange(fromIso, toIso),
    studentTimeOffService.listOverlapping(fromIso, toIso),
  ]);

  return Array.from(
    buildMonthTimesheets(month, { terms, schedules, scheduleBlocks, timeEntries, timeOff }).values(),
  );
}

async function loadMonth(month: string, studentAssistantId?: number) {
  const sheets = await withTimesheetMonthCache(month, () => computeMonth(month));
  const map = new Map<number, StudentMonthTimesheet>();
  for (const sheet of sheets) {
    if (studentAssistantId != null && sheet.studentAssistantId !== studentAssistantId) continue;
    map.set(sheet.studentAssistantId, sheet);
  }
  return map;
}

async function listVerifications(
  month: string,
  studentAssistantId?: number,
): Promise<{ available: boolean; rows: TimesheetVerification[] }> {
  let query = supabase.from('timesheet_verification').select('*').eq('month', `${month}-01`);
  if (studentAssistantId != null) query = query.eq('student_assistant_id', studentAssistantId);

  const { data, error } = await query;
  if (error) {
    if (error.code && MISSING_TABLE_CODES.has(error.code)) return { available: false, rows: [] };
    throw new HttpError(500, error.message);
  }
  return { available: true, rows: data ?? [] };
}

function toInfo(row: TimesheetVerification | undefined): VerificationInfo | null {
  return row ? { verifiedAt: row.verified_at, verifiedBy: row.verified_by } : null;
}

export const timesheetService = {
  async getMonthSummary(month: string): Promise<MonthTimesheetSummary> {
    const [timesheets, verifications] = await Promise.all([loadMonth(month), listVerifications(month)]);
    const byStudent = new Map(verifications.rows.map((row) => [row.student_assistant_id, row]));

    return {
      month,
      verificationAvailable: verifications.available,
      students: Array.from(timesheets.values()).map(({ days: _days, ...summary }) => ({
        ...summary,
        verification: toInfo(byStudent.get(summary.studentAssistantId)),
      })),
    };
  },

  async getStudentMonth(studentAssistantId: number, month: string): Promise<StudentMonthTimesheetResult> {
    const [timesheets, verifications] = await Promise.all([
      loadMonth(month, studentAssistantId),
      listVerifications(month, studentAssistantId),
    ]);

    return {
      ...(timesheets.get(studentAssistantId) ?? emptyMonthTimesheet(studentAssistantId)),
      month,
      verificationAvailable: verifications.available,
      verification: toInfo(verifications.rows[0]),
    };
  },

  async verify(studentAssistantId: number, month: string, verifiedBy: string | null): Promise<VerificationInfo> {
    const { data, error } = await supabase
      .from('timesheet_verification')
      .upsert(
        {
          student_assistant_id: studentAssistantId,
          month: `${month}-01`,
          verified_at: new Date().toISOString(),
          verified_by: verifiedBy,
        },
        { onConflict: 'student_assistant_id,month' },
      )
      .select()
      .single();

    if (error) {
      if (error.code && MISSING_TABLE_CODES.has(error.code)) {
        throw new HttpError(503, 'Timesheet verification is not set up yet. Apply the timesheet_verification migration.');
      }
      throw new HttpError(500, error.message);
    }
    return { verifiedAt: data.verified_at, verifiedBy: data.verified_by };
  },

  async unverify(studentAssistantId: number, month: string): Promise<void> {
    const { error } = await supabase
      .from('timesheet_verification')
      .delete()
      .eq('student_assistant_id', studentAssistantId)
      .eq('month', `${month}-01`);

    if (error) throw new HttpError(500, error.message);
  },
};
