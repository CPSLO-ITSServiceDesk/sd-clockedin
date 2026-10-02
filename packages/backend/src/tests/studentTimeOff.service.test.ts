import { describe, it, expect } from 'vitest';
import { studentTimeOffService } from '../services/studentTimeOffService';

describe('studentTimeOffService - basic existence', () => {
  it('should have all expected methods', () => {
    expect(studentTimeOffService).toBeDefined();
    expect(typeof studentTimeOffService.listByTerm).toBe('function');
    expect(typeof studentTimeOffService.upsertByTeamsTimeOffId).toBe('function');
    expect(typeof studentTimeOffService.deleteMissingForTerm).toBe('function');
    expect(typeof studentTimeOffService.replaceForTerm).toBe('function');
  });
});
