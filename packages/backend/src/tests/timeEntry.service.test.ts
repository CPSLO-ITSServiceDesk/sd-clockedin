import { describe, it, expect } from 'vitest';
import { timeEntryService } from '../services/timeEntryService';

describe('timeEntryService - basic existence', () => {
  it('should have all expected methods', () => {
    expect(timeEntryService).toBeDefined();
    expect(typeof timeEntryService.getAll).toBe('function');
    expect(typeof timeEntryService.getById).toBe('function');
    expect(typeof timeEntryService.create).toBe('function');
    expect(typeof timeEntryService.update).toBe('function');
    expect(typeof timeEntryService.remove).toBe('function');
    expect(typeof timeEntryService.getOpenByScheduleAndAssistant).toBe('function');
    expect(typeof timeEntryService.getOpenByAssistant).toBe('function');
    expect(typeof timeEntryService.clockIn).toBe('function');
    expect(typeof timeEntryService.closeOpenByAssistant).toBe('function');
  });
});