import { describe, expect, it } from 'vitest';
import { diffScheduleBlocks, type ExistingScheduleBlock } from '../lib/diffScheduleBlocks';
import type { DraftScheduleBlock } from '../lib/scheduleImportTransform';

const existing = (
  id: number,
  days: string,
  start_time: string,
  end_time: string,
  is_remote = false,
): ExistingScheduleBlock => ({ id, days, start_time, end_time, is_remote });

const draft = (
  day: DraftScheduleBlock['day'],
  start_time: string,
  end_time: string,
  is_remote = false,
): DraftScheduleBlock => ({ day, start_time, end_time, is_remote });

describe('diffScheduleBlocks', () => {
  it('keeps unchanged blocks even when the DB stores seconds', () => {
    const diff = diffScheduleBlocks(
      [existing(1, 'monday', '08:00:00', '12:00:00'), existing(2, 'wednesday', '13:00:00', '17:00:00')],
      [draft('monday', '08:00', '12:00'), draft('wednesday', '13:00', '17:00')],
    );

    expect(diff).toEqual({ keepIds: [1, 2], updates: [], removeIds: [], creates: [] });
  });

  it('removes dropped blocks and creates new ones without touching the rest', () => {
    const diff = diffScheduleBlocks(
      [existing(1, 'monday', '08:00:00', '12:00:00'), existing(2, 'friday', '09:00:00', '11:00:00')],
      [draft('monday', '08:00', '12:00'), draft('friday', '09:00', '12:00')],
    );

    expect(diff.keepIds).toEqual([1]);
    expect(diff.removeIds).toEqual([2]);
    expect(diff.creates).toEqual([draft('friday', '09:00', '12:00')]);
  });

  it('updates the remote flag in place so the block id survives', () => {
    const diff = diffScheduleBlocks(
      [existing(1, 'tuesday', '10:00:00', '14:00:00', false)],
      [draft('tuesday', '10:00', '14:00', true)],
    );

    expect(diff.updates).toEqual([{ id: 1, is_remote: true }]);
    expect(diff.keepIds).toEqual([]);
    expect(diff.removeIds).toEqual([]);
  });

  it('matches duplicate blocks one-to-one', () => {
    const diff = diffScheduleBlocks(
      [existing(1, 'monday', '08:00:00', '10:00:00'), existing(2, 'monday', '08:00:00', '10:00:00')],
      [draft('monday', '08:00', '10:00')],
    );

    expect(diff.keepIds).toEqual([1]);
    expect(diff.removeIds).toEqual([2]);
  });
});
