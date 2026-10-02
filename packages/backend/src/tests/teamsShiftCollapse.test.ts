import { describe, expect, it } from 'vitest';
import {
  collapseShiftsByEntraUserId,
  collapseShiftsToWeekdayTemplates,
  isoDateToWeekday,
  pickModePreferUpcoming,
} from '../lib/teamsShiftCollapse';
import type { TeamsShiftDto } from '../lib/teamsShiftsAdapter';

const USER_A = 'user-a';
const USER_B = 'user-b';

function shift(overrides: Partial<TeamsShiftDto> & Pick<TeamsShiftDto, 'localStartDate' | 'localStartTime' | 'localEndTime'>): TeamsShiftDto {
  return {
    id: overrides.id ?? `shift-${overrides.localStartDate}-${overrides.localStartTime}`,
    entraUserId: overrides.entraUserId ?? USER_A,
    schedulingGroupId: overrides.schedulingGroupId ?? 'group',
    startDateTime: overrides.startDateTime ?? '2026-06-22T15:00:00.000Z',
    endDateTime: overrides.endDateTime ?? '2026-06-22T18:00:00.000Z',
    theme: overrides.theme ?? 'green',
    displayName: overrides.displayName ?? 'Desk',
    localStartDate: overrides.localStartDate,
    localStartTime: overrides.localStartTime,
    localEndDate: overrides.localEndDate ?? overrides.localStartDate,
    localEndTime: overrides.localEndTime,
    isRemote: overrides.isRemote ?? false,
  };
}

describe('isoDateToWeekday', () => {
  it('maps calendar dates to Mon–Fri and skips weekends', () => {
    expect(isoDateToWeekday('2026-06-22')).toBe('monday');
    expect(isoDateToWeekday('2026-06-25')).toBe('thursday');
    expect(isoDateToWeekday('2026-06-26')).toBe('friday');
    expect(isoDateToWeekday('2026-06-27')).toBeNull();
    expect(isoDateToWeekday('2026-06-28')).toBeNull();
  });
});

describe('pickModePreferUpcoming', () => {
  it('returns the unique mode key even when it is not the upcoming week', () => {
    const items = [
      { key: '08:00|11:00', date: '2026-06-22' },
      { key: '08:00|11:00', date: '2026-06-29' },
      { key: '09:00|12:00', date: '2026-07-06' },
    ];

    const winner = pickModePreferUpcoming(
      items,
      (item) => item.key,
      (item) => item.date,
      '2026-07-01',
    );
    expect(winner.key).toBe('08:00|11:00');
  });

  it('breaks a tie by preferring the upcoming week', () => {
    const items = [
      { key: '08:00|11:00', date: '2026-06-22' },
      { key: '08:00|11:00', date: '2026-06-29' },
      { key: '09:00|12:00', date: '2026-07-06' },
      { key: '09:00|12:00', date: '2026-07-13' },
    ];

    const winner = pickModePreferUpcoming(
      items,
      (item) => item.key,
      (item) => item.date,
      '2026-07-01',
    );
    expect(winner.key).toBe('09:00|12:00');
    expect(winner.date).toBe('2026-07-06');
  });

  it('uses the last week in the term when every occurrence is in the past', () => {
    const items = [
      { key: '08:00|11:00', date: '2026-06-22' },
      { key: '08:00|11:00', date: '2026-06-29' },
      { key: '09:00|12:00', date: '2026-07-06' },
      { key: '09:00|12:00', date: '2026-07-13' },
    ];

    const winner = pickModePreferUpcoming(
      items,
      (item) => item.key,
      (item) => item.date,
      '2026-07-20',
    );
    expect(winner.key).toBe('09:00|12:00');
    expect(winner.date).toBe('2026-07-13');
  });
});

describe('collapseShiftsToWeekdayTemplates', () => {
  it('collapses to one mode start/end per weekday instead of merging intervals', () => {
    const blocks = collapseShiftsToWeekdayTemplates(
      [
        shift({ localStartDate: '2026-06-22', localStartTime: '08:00', localEndTime: '11:00' }),
        shift({ localStartDate: '2026-06-29', localStartTime: '08:00', localEndTime: '11:00' }),
        shift({ localStartDate: '2026-07-06', localStartTime: '08:00', localEndTime: '11:00' }),
        shift({
          id: 'late-monday',
          localStartDate: '2026-07-13',
          localStartTime: '13:00',
          localEndTime: '17:00',
        }),
      ],
      { now: new Date('2026-06-20T17:00:00.000Z'), remoteShiftsAllowed: true },
    );

    expect(blocks).toEqual([
      { day: 'monday', start_time: '08:00', end_time: '11:00', is_remote: false },
    ]);
  });

  it('does not interval-merge split shifts on the same weekday into one long block', () => {
    const blocks = collapseShiftsToWeekdayTemplates(
      [
        shift({ localStartDate: '2026-06-22', localStartTime: '08:00', localEndTime: '11:00' }),
        shift({ localStartDate: '2026-06-22', localStartTime: '13:00', localEndTime: '17:00' }),
      ],
      { now: new Date('2026-06-20T17:00:00.000Z') },
    );

    expect(blocks).toEqual([
      { day: 'monday', start_time: '08:00', end_time: '11:00', is_remote: false },
    ]);
    expect(blocks).not.toEqual([
      { day: 'monday', start_time: '08:00', end_time: '17:00', is_remote: false },
    ]);
  });

  it('on a tied start/end, prefers the upcoming week rather than merging', () => {
    const blocks = collapseShiftsToWeekdayTemplates(
      [
        shift({ localStartDate: '2026-06-22', localStartTime: '08:00', localEndTime: '11:00' }),
        shift({ localStartDate: '2026-06-29', localStartTime: '08:00', localEndTime: '11:00' }),
        shift({ localStartDate: '2026-07-06', localStartTime: '09:00', localEndTime: '12:00' }),
        shift({ localStartDate: '2026-07-13', localStartTime: '09:00', localEndTime: '12:00' }),
      ],
      { now: new Date('2026-07-01T17:00:00.000Z') },
    );

    expect(blocks).toEqual([
      { day: 'monday', start_time: '09:00', end_time: '12:00', is_remote: false },
    ]);
  });

  it('skips weekend shifts and remote shifts when the term disallows remote', () => {
    const blocks = collapseShiftsToWeekdayTemplates(
      [
        shift({
          localStartDate: '2026-06-27',
          localStartTime: '10:00',
          localEndTime: '14:00',
        }),
        shift({
          localStartDate: '2026-06-23',
          localStartTime: '12:00',
          localEndTime: '16:00',
          isRemote: true,
          theme: 'blue',
        }),
        shift({
          localStartDate: '2026-06-24',
          localStartTime: '08:00',
          localEndTime: '11:00',
        }),
      ],
      { now: new Date('2026-06-22T17:00:00.000Z'), remoteShiftsAllowed: false },
    );

    expect(blocks).toEqual([
      { day: 'wednesday', start_time: '08:00', end_time: '11:00', is_remote: false },
    ]);
  });

  it('keeps remote when the term allows it', () => {
    const blocks = collapseShiftsToWeekdayTemplates(
      [
        shift({
          localStartDate: '2026-06-23',
          localStartTime: '12:00',
          localEndTime: '16:00',
          isRemote: true,
        }),
      ],
      { now: new Date('2026-06-22T17:00:00.000Z'), remoteShiftsAllowed: true },
    );

    expect(blocks).toEqual([
      { day: 'tuesday', start_time: '12:00', end_time: '16:00', is_remote: true },
    ]);
  });
});

describe('collapseShiftsByEntraUserId', () => {
  it('builds independent weekday templates per student', () => {
    const templates = collapseShiftsByEntraUserId(
      [
        shift({
          entraUserId: USER_A,
          localStartDate: '2026-06-22',
          localStartTime: '08:00',
          localEndTime: '11:00',
        }),
        shift({
          entraUserId: USER_B,
          localStartDate: '2026-06-25',
          localStartTime: '13:00',
          localEndTime: '17:00',
        }),
      ],
      { now: new Date('2026-06-22T17:00:00.000Z') },
    );

    expect(templates.get(USER_A)).toEqual([
      { day: 'monday', start_time: '08:00', end_time: '11:00', is_remote: false },
    ]);
    expect(templates.get(USER_B)).toEqual([
      { day: 'thursday', start_time: '13:00', end_time: '17:00', is_remote: false },
    ]);
  });
});
