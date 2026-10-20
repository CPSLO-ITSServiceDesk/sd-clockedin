import { getOrgLocalInstant } from './orgTime';
import { parseOffDays } from './timeOffCoverage';
import type { Database } from '../types/database.types';

type Term = Database['public']['Tables']['academic_term']['Row'];
type Weekday = Database['public']['Enums']['days'];

const WEEKDAY_BY_INDEX: (Weekday | null)[] = [null, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', null];

/** Teams shift colors the sync reads back: blue is remote, everything else in person. */
export const TEAMS_THEME = { inPerson: 'green', training: 'purple', remote: 'blue' } as const;

export interface WeeklyShift {
  day: Weekday;
  /** Org-local minutes since midnight, end exclusive. */
  startMinutes: number;
  endMinutes: number;
  theme: string;
}

export interface DesiredShift {
  userId: string;
  date: string;
  start: string;
  end: string;
  theme: string;
}

export interface ExistingTeamsShift {
  id: string;
  userId: string;
  /** What the shift will be once shared: the pending draft if there is one, else the shared version. */
  start: string;
  end: string;
  /** True when it has never been shared (only a draftShift). */
  draftOnly: boolean;
  isStagedForDeletion: boolean;
}

export interface TeamsShiftPlan {
  create: DesiredShift[];
  /** Already in Teams as wanted. */
  keep: string[];
  /** Matching shifts that were staged for deletion: un-stage them. */
  unstage: string[];
  /** Shared shifts no longer wanted: stage for deletion (takes effect when shared). */
  stage: string[];
  /** Unshared drafts no longer wanted: delete outright (nobody has seen them). */
  deleteDrafts: string[];
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayOf(date: string): Weekday | null {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAY_BY_INDEX[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function instant(date: string, minutes: number): string {
  return getOrgLocalInstant(date, Math.floor(minutes / 60), minutes % 60).toISOString();
}

/**
 * Dated shifts for a weekly pattern over [fromDate, toDate], inside the term:
 * campus vacation days are skipped and special-schedule days run the swapped
 * weekday's shifts.
 */
export function expandWeeklyShifts(
  userId: string,
  weekly: WeeklyShift[],
  fromDate: string,
  toDate: string,
  term: Pick<Term, 'start_date' | 'end_date' | 'off_days'>,
): DesiredShift[] {
  if (!term.start_date || !term.end_date) return [];
  const start = fromDate > term.start_date ? fromDate : term.start_date;
  const end = toDate < term.end_date ? toDate : term.end_date;
  const offDays = parseOffDays(term as Term);
  const vacations = new Set((offDays?.vacations ?? []).map((entry) => entry.date));
  const swaps = new Map((offDays?.special_schedules ?? []).map((entry) => [entry.date, entry.swap_to_day]));

  const shifts: DesiredShift[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (vacations.has(date)) continue;
    const weekday = weekdayOf(date);
    if (!weekday) continue;
    const runs = swaps.get(date) ?? weekday;
    for (const shift of weekly) {
      if (shift.day !== runs || shift.endMinutes <= shift.startMinutes) continue;
      shifts.push({
        userId,
        date,
        start: instant(date, shift.startMinutes),
        end: instant(date, shift.endMinutes),
        theme: shift.theme,
      });
    }
  }
  return shifts;
}

const keyOf = (userId: string, start: string, end: string) =>
  `${userId}|${Date.parse(start)}|${Date.parse(end)}`;

/**
 * Diff wanted shifts against what's in Teams for the same people and dates.
 * Everything is a draft change: nothing students see changes until a
 * manager shares the schedule.
 */
export function planShiftChanges(desired: DesiredShift[], existing: ExistingTeamsShift[]): TeamsShiftPlan {
  const available = new Map<string, ExistingTeamsShift[]>();
  for (const shift of existing) {
    const key = keyOf(shift.userId, shift.start, shift.end);
    available.set(key, [...(available.get(key) ?? []), shift]);
  }

  const plan: TeamsShiftPlan = { create: [], keep: [], unstage: [], stage: [], deleteDrafts: [] };
  for (const shift of desired) {
    const candidates = available.get(keyOf(shift.userId, shift.start, shift.end)) ?? [];
    // Prefer a live match over one already staged for deletion.
    const index = candidates.findIndex((candidate) => !candidate.isStagedForDeletion);
    const match = candidates.splice(index === -1 ? 0 : index, 1)[0];
    if (!match) plan.create.push(shift);
    else if (match.isStagedForDeletion) plan.unstage.push(match.id);
    else plan.keep.push(match.id);
  }

  for (const leftovers of available.values()) {
    for (const shift of leftovers) {
      if (shift.isStagedForDeletion) continue;
      if (shift.draftOnly) plan.deleteDrafts.push(shift.id);
      else plan.stage.push(shift.id);
    }
  }
  return plan;
}

/** Monday on or before `date`. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

export { addDays as addCalendarDays };
