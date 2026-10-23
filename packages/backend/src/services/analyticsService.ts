import { withStudentAnalyticsCache, withTermAnalyticsCache } from '../lib/derivedReadsCache';
import {
  buildStudentAnalytics,
  buildTermAnalytics,
  type StudentAnalyticsResult,
  type TermAnalyticsResult,
} from '../lib/shiftAnalytics';
import { HttpError } from '../middleware/errorHandler';
import { scheduleBlocksService } from './scheduleBlocksService';
import { schedulesService } from './schedulesService';
import { studentTimeOffService } from './studentTimeOffService';
import { termService } from './termService';
import { timeEntryService } from './timeEntryService';

export const analyticsService = {
  async getTermAnalytics(termId: number): Promise<TermAnalyticsResult> {
    const term = await termService.getById(termId);
    if (!term) {
      throw new HttpError(404, 'Term not found');
    }

    return withTermAnalyticsCache(term.id, term.end_date, async () => {
      const [schedules, scheduleBlocks, timeEntries, studentTimeOff] = await Promise.all([
        schedulesService.getAll(),
        scheduleBlocksService.getAll(),
        timeEntryService.getAll(),
        studentTimeOffService.listByTerm(termId),
      ]);

      return buildTermAnalytics(
        term,
        schedules,
        scheduleBlocks,
        timeEntries,
        new Date(),
        studentTimeOff,
      );
    });
  },

  async getStudentAnalytics(
    studentAssistantId: number,
    termId: number,
  ): Promise<StudentAnalyticsResult> {
    const term = await termService.getById(termId);
    if (!term) {
      throw new HttpError(404, 'Term not found');
    }

    return withStudentAnalyticsCache(term.id, studentAssistantId, term.end_date, async () => {
      const [schedules, scheduleBlocks, timeEntries, studentTimeOff] = await Promise.all([
        schedulesService.getAll(),
        scheduleBlocksService.getAll(),
        timeEntryService.getAll(),
        studentTimeOffService.listByTerm(termId),
      ]);

      return buildStudentAnalytics(
        term,
        studentAssistantId,
        schedules,
        scheduleBlocks,
        timeEntries,
        new Date(),
        studentTimeOff,
      );
    });
  },
};
