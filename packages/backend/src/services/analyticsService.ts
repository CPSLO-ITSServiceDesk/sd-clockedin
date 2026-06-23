import {
  buildStudentAnalytics,
  buildTermAnalytics,
  type StudentAnalyticsResult,
  type TermAnalyticsResult,
} from '../lib/shiftAnalytics';
import { HttpError } from '../middleware/errorHandler';
import { scheduleBlocksService } from './scheduleBlocksService';
import { schedulesService } from './schedulesService';
import { termService } from './termService';
import { timeEntryService } from './timeEntryService';

export const analyticsService = {
  async getTermAnalytics(termId: number): Promise<TermAnalyticsResult> {
    const term = await termService.getById(termId);
    if (!term) {
      throw new HttpError(404, 'Term not found');
    }

    const [schedules, scheduleBlocks, timeEntries] = await Promise.all([
      schedulesService.getAll(),
      scheduleBlocksService.getAll(),
      timeEntryService.getAll(),
    ]);

    return buildTermAnalytics(term, schedules, scheduleBlocks, timeEntries);
  },

  async getStudentAnalytics(
    studentAssistantId: number,
    termId: number,
  ): Promise<StudentAnalyticsResult> {
    const term = await termService.getById(termId);
    if (!term) {
      throw new HttpError(404, 'Term not found');
    }

    const [schedules, scheduleBlocks, timeEntries] = await Promise.all([
      schedulesService.getAll(),
      scheduleBlocksService.getAll(),
      timeEntryService.getAll(),
    ]);

    return buildStudentAnalytics(
      term,
      studentAssistantId,
      schedules,
      scheduleBlocks,
      timeEntries,
    );
  },
};
