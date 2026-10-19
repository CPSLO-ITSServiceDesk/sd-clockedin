import { config } from '../config/environment';
import { findClockOutFixes, type ClockOutFix } from '../lib/clockOutFixes';
import {
  buildNormalizationPreview,
  validateNormalizationMatch,
  type NormalizationApplyResult,
  type NormalizationContext,
  type NormalizationMatchInput,
  type NormalizationPreview,
} from '../lib/shiftNormalization';
import { getClockInDate } from '../lib/shiftStatus';
import { HttpError } from '../middleware/errorHandler';
import { scheduleBlocksService } from './scheduleBlocksService';
import { schedulesService } from './schedulesService';
import { studentAssistantService } from './studentAssistantService';
import { studentTimeOffService } from './studentTimeOffService';
import { termService } from './termService';
import { timeEntryService } from './timeEntryService';

export type NormalizationPreviewWithClockOuts = NormalizationPreview & {
  /** Linked entries whose clock-out looks wrong, with the scheduled end as the fix. */
  clockOutFixes: ClockOutFix[];
};

export interface ClockOutFixResult {
  applied: number;
  skipped: { timeEntryId: number; reason: string }[];
}

function clockOutFixesFor(context: NormalizationContext, now: Date = new Date()): ClockOutFix[] {
  const { enabled, hour, minute } = config.autoClockOut;
  return findClockOutFixes({
    term: context.term,
    schedules: context.schedules,
    scheduleBlocks: context.scheduleBlocks,
    timeEntries: context.timeEntries,
    students: context.students,
    now,
    autoClockOutMinutes: enabled ? hour * 60 + minute : null,
  });
}

async function loadContext(termId: number): Promise<NormalizationContext> {
  const term = await termService.getById(termId);
  if (!term) {
    throw new HttpError(404, 'Term not found');
  }

  const [schedules, scheduleBlocks, timeEntries, students, studentTimeOff] = await Promise.all([
    schedulesService.getAll(),
    scheduleBlocksService.getAll(),
    timeEntryService.getAll(),
    studentAssistantService.getAll(),
    studentTimeOffService.listByTerm(termId),
  ]);

  return { term, schedules, scheduleBlocks, timeEntries, students, studentTimeOff };
}

export const shiftNormalizationService = {
  async getPreview(termId: number): Promise<NormalizationPreviewWithClockOuts> {
    const context = await loadContext(termId);
    const preview = buildNormalizationPreview(
      context.term,
      context.schedules,
      context.scheduleBlocks,
      context.timeEntries,
      context.students,
      new Date(),
      context.studentTimeOff ?? [],
    );
    return { ...preview, clockOutFixes: clockOutFixesFor(context) };
  },

  /**
   * Set each selected entry's clock-out to its shift's scheduled end. Fixes are
   * recomputed first, so entries that no longer look wrong are skipped.
   */
  async applyClockOutFixes(termId: number, timeEntryIds: number[]): Promise<ClockOutFixResult> {
    const context = await loadContext(termId);
    const fixes = new Map(clockOutFixesFor(context).map((fix) => [fix.timeEntryId, fix]));
    const skipped: ClockOutFixResult['skipped'] = [];
    let applied = 0;

    for (const timeEntryId of new Set(timeEntryIds)) {
      const fix = fixes.get(timeEntryId);
      if (!fix) {
        skipped.push({ timeEntryId, reason: 'Clock-out no longer needs fixing' });
        continue;
      }
      const updated = await timeEntryService.update(timeEntryId, { clock_out: fix.proposedClockOut });
      if (!updated) {
        skipped.push({ timeEntryId, reason: 'Time entry not found' });
        continue;
      }
      applied += 1;
    }

    return { applied, skipped };
  },

  async applyMatches(
    termId: number,
    matches: NormalizationMatchInput[],
  ): Promise<NormalizationApplyResult> {
    const context = await loadContext(termId);
    const skipped: NormalizationApplyResult['skipped'] = [];
    let applied = 0;
    const appliedKeys = new Set<string>();

    for (const match of matches) {
      const entry = context.timeEntries.find((e) => e.id === match.timeEntryId);
      if (!entry?.student_assistant_id) {
        skipped.push({ timeEntryId: match.timeEntryId, reason: 'Time entry not found' });
        continue;
      }

      const validation = validateNormalizationMatch(match, context);
      if (!validation.valid) {
        skipped.push({ timeEntryId: match.timeEntryId, reason: validation.reason });
        continue;
      }

      const entryDate = getClockInDate(entry.clock_in);
      if (!entryDate) {
        skipped.push({ timeEntryId: match.timeEntryId, reason: 'Could not determine entry date' });
        continue;
      }

      const claimKey = `${match.scheduleBlockId}-${entry.student_assistant_id}-${entryDate}`;

      if (appliedKeys.has(claimKey)) {
        skipped.push({
          timeEntryId: match.timeEntryId,
          reason: 'Duplicate block claim in this batch',
        });
        continue;
      }

      const updated = await timeEntryService.update(match.timeEntryId, {
        schedule_block_id: match.scheduleBlockId,
      });

      if (!updated) {
        skipped.push({ timeEntryId: match.timeEntryId, reason: 'Failed to update time entry' });
        continue;
      }

      appliedKeys.add(claimKey);
      applied += 1;

      const entryIndex = context.timeEntries.findIndex((e) => e.id === match.timeEntryId);
      if (entryIndex >= 0) {
        context.timeEntries[entryIndex] = updated;
      }
    }

    return { applied, skipped };
  },
};
