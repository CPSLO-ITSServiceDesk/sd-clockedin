import { parseScheduleSpreadsheet } from '../lib/scheduleImportParser';
import {
  transformImportRows,
  type DraftScheduleBlock,
  type StudentScheduleImport,
} from '../lib/scheduleImportTransform';
import { HttpError } from '../middleware/errorHandler';
import { scheduleBlocksService } from './scheduleBlocksService';
import { schedulesService } from './schedulesService';
import { studentAssistantService } from './studentAssistantService';
import { termService } from './termService';
import type { Database } from '../types/database.types';

type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];

export interface ImportStudentPreview {
  workEmail: string;
  member: string;
  action: 'create' | 'match';
  studentId?: number;
  blockCount: number;
  remoteBlockCount: number;
  blocks: DraftScheduleBlock[];
}

export interface ScheduleImportSummary {
  studentsCreated: number;
  studentsMatched: number;
  schedulesUpdated: number;
  totalBlocks: number;
  remoteBlocks: number;
  skippedRows: number;
  remoteRowsSkipped: number;
}

export interface ScheduleImportResult {
  dryRun: boolean;
  termId: number;
  termName: string;
  summary: ScheduleImportSummary;
  students: ImportStudentPreview[];
  warnings: string[];
}

async function upsertStudent(
  entry: StudentScheduleImport,
  dryRun: boolean,
): Promise<{ student: StudentAssistant | null; action: 'create' | 'match' }> {
  const existing = await studentAssistantService.findByWorkEmail(entry.workEmail);

  if (existing) {
    if (!dryRun) {
      const updates: Database['public']['Tables']['student_assistant']['Update'] = {};
      if (!existing.first_name?.trim() && entry.firstName) {
        updates.first_name = entry.firstName;
      }
      if (!existing.last_name?.trim() && entry.lastName) {
        updates.last_name = entry.lastName;
      }
      if (!existing.work_email) {
        updates.work_email = entry.workEmail;
      }

      if (Object.keys(updates).length > 0) {
        await studentAssistantService.update(existing.id, updates);
      }
    }

    return { student: existing, action: 'match' };
  }

  if (dryRun) {
    return { student: null, action: 'create' };
  }

  const created = await studentAssistantService.create({
    first_name: entry.firstName,
    last_name: entry.lastName,
    work_email: entry.workEmail,
    is_active: true,
    position: 'student_assistant',
  });

  return { student: created, action: 'create' };
}

async function replaceScheduleBlocks(
  studentId: number,
  termId: number,
  blocks: DraftScheduleBlock[],
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;

  // Re-import replaces blocks only; existing start_date/end_date overrides are preserved.
  let schedule = await schedulesService.getByStudentAndTerm(studentId, termId);

  if (!schedule) {
    schedule = await schedulesService.create({
      student_assistant_id: studentId,
      academic_term_id: termId,
    });
  }

  const existingBlocks = await scheduleBlocksService.getByScheduleId(schedule.id);
  await scheduleBlocksService.removeMany(existingBlocks.map((block) => block.id));

  await Promise.all(
    blocks.map((block) =>
      scheduleBlocksService.create({
        schedule_id: schedule!.id,
        days: block.day,
        start_time: block.start_time,
        end_time: block.end_time,
        is_remote: block.is_remote,
      }),
    ),
  );
}

export const scheduleImportService = {
  async importFromBuffer(
    buffer: Buffer,
    filename: string,
    termId: number,
    dryRun: boolean,
  ): Promise<ScheduleImportResult> {
    const term = await termService.getById(termId);
    if (!term) {
      throw new HttpError(404, 'Academic term not found');
    }

    if (!term.start_date || !term.end_date) {
      throw new HttpError(400, 'Selected term is missing start or end date');
    }

    const rows = parseScheduleSpreadsheet(buffer, filename);
    const { students, warnings, skippedRows, remoteRowsSkipped } =
      transformImportRows(
        rows,
        term.start_date,
        term.end_date,
        term.remote_shifts_allowed ?? false,
      );

    if (students.length === 0) {
      throw new HttpError(
        400,
        'No valid schedule rows found for the selected term',
      );
    }

    const previews: ImportStudentPreview[] = [];
    let studentsCreated = 0;
    let studentsMatched = 0;

    for (const entry of students) {
      const { student, action } = await upsertStudent(entry, dryRun);

      if (action === 'create') {
        studentsCreated += 1;
      } else {
        studentsMatched += 1;
      }

      if (!dryRun && student) {
        await replaceScheduleBlocks(student.id, termId, entry.blocks, dryRun);
      }

      previews.push({
        workEmail: entry.workEmail,
        member: entry.member,
        action,
        studentId: student?.id,
        blockCount: entry.blocks.length,
        remoteBlockCount: entry.blocks.filter((block) => block.is_remote).length,
        blocks: entry.blocks,
      });
    }

    const totalBlocks = previews.reduce(
      (sum, preview) => sum + preview.blockCount,
      0,
    );
    const remoteBlocks = previews.reduce(
      (sum, preview) => sum + preview.remoteBlockCount,
      0,
    );

    return {
      dryRun,
      termId,
      termName: term.name ?? `Term ${termId}`,
      summary: {
        studentsCreated,
        studentsMatched,
        schedulesUpdated: previews.length,
        totalBlocks,
        remoteBlocks,
        skippedRows,
        remoteRowsSkipped,
      },
      students: previews,
      warnings,
    };
  },
};
