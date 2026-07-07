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
import { termService } from './termService';
import { timeEntryService } from './timeEntryService';

async function loadContext(termId: number): Promise<NormalizationContext> {
  const term = await termService.getById(termId);
  if (!term) {
    throw new HttpError(404, 'Term not found');
  }

  const [schedules, scheduleBlocks, timeEntries, students] = await Promise.all([
    schedulesService.getAll(),
    scheduleBlocksService.getAll(),
    timeEntryService.getAll(),
    studentAssistantService.getAll(),
  ]);

  return { term, schedules, scheduleBlocks, timeEntries, students };
}

export const shiftNormalizationService = {
  async getPreview(termId: number): Promise<NormalizationPreview> {
    const context = await loadContext(termId);
    return buildNormalizationPreview(
      context.term,
      context.schedules,
      context.scheduleBlocks,
      context.timeEntries,
      context.students,
    );
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
