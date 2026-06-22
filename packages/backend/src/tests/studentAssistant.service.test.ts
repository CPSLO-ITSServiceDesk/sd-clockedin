import { describe, it, expect } from 'vitest';
import { studentAssistantService } from '../services/studentAssistantService';

describe('studentAssistantService - basic existence', () => {
  it('should have all expected methods', () => {
    expect(studentAssistantService).toBeDefined();
    expect(typeof studentAssistantService.getAll).toBe('function');
    expect(typeof studentAssistantService.getById).toBe('function');
    expect(typeof studentAssistantService.create).toBe('function');
    expect(typeof studentAssistantService.update).toBe('function');
    expect(typeof studentAssistantService.remove).toBe('function');
  });
});
