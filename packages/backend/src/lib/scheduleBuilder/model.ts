import type { Database } from '../../types/database.types';

export type Weekday = Database['public']['Enums']['days'];

export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/** Length of one schedule slot. Slot n starts at n * 30 minutes after midnight (16 = 8:00). */
export const SLOT_MINUTES = 30;

/** Desk role painted on a slot: Lead, Main desk, Training. */
export type ShiftRole = 'L' | 'm' | 't';

export type PersonGroup = 'lead' | 'student' | 'trainee';

/** Slots per weekday, as absolute half-hour indexes. */
export type DaySlots = Partial<Record<Weekday, number[]>>;

/** Assigned role per slot index (as a string key, since this round-trips through JSON). */
export type DayAssignments = Partial<Record<Weekday, Record<string, ShiftRole>>>;

export interface DraftPerson {
  student_assistant_id: number;
  group: PersonGroup;
  /** True when this person's availability came from the imported form. */
  responded: boolean;
  min_hours: number | null;
  ideal_hours: number | null;
  max_hours: number | null;
  notes: string;
  availability: DaySlots;
  assignments: DayAssignments;
  /** Cells the parser couldn't read, kept so an admin can fix them by hand. */
  import_warnings: string[];
}

/** An imported form response that didn't match anyone on the roster. */
export interface UnmatchedResponse {
  key: string;
  name: string;
  email: string;
  min_hours: number | null;
  ideal_hours: number | null;
  max_hours: number | null;
  notes: string;
  availability: DaySlots;
  import_warnings: string[];
}

export interface DraftRules {
  desk_start_slot: number;
  desk_end_slot: number;
  min_on_desk: { enabled: boolean; value: number };
  lead_every_slot: { enabled: boolean };
  shift_length: { enabled: boolean; min_hours: number; max_hours: number };
  within_requested: { enabled: boolean };
  weekly_budget: { enabled: boolean; hours: number };
  trainee_with_lead: { enabled: boolean };
}

export interface ChangeLogEntry {
  at: string;
  by: 'you' | 'builder' | 'import';
  text: string;
}

export const DEFAULT_RULES: DraftRules = {
  desk_start_slot: 16,
  desk_end_slot: 34,
  min_on_desk: { enabled: true, value: 3 },
  lead_every_slot: { enabled: true },
  shift_length: { enabled: true, min_hours: 2, max_hours: 5 },
  within_requested: { enabled: true },
  weekly_budget: { enabled: false, hours: 400 },
  trainee_with_lead: { enabled: false },
};

export function defaultRoleFor(group: PersonGroup): ShiftRole {
  if (group === 'lead') return 'L';
  if (group === 'trainee') return 't';
  return 'm';
}

export function slotToTime(slot: number): string {
  const minutes = slot * SLOT_MINUTES;
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function deskSlots(rules: Pick<DraftRules, 'desk_start_slot' | 'desk_end_slot'>): number[] {
  const slots: number[] = [];
  for (let slot = rules.desk_start_slot; slot < rules.desk_end_slot; slot += 1) slots.push(slot);
  return slots;
}

export function assignedSlots(person: Pick<DraftPerson, 'assignments'>, day: Weekday): number[] {
  return Object.keys(person.assignments[day] ?? {})
    .map(Number)
    .sort((a, b) => a - b);
}

export function assignedHours(person: Pick<DraftPerson, 'assignments'>): number {
  return WEEKDAYS.reduce((sum, day) => sum + assignedSlots(person, day).length, 0) * (SLOT_MINUTES / 60);
}

/** Contiguous runs of slots, e.g. [16,17,18,22] → [[16,19],[22,23]] (end exclusive). */
export function toRuns(slots: number[]): [number, number][] {
  const sorted = [...new Set(slots)].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const slot of sorted) {
    const last = runs[runs.length - 1];
    if (last && last[1] === slot) last[1] = slot + 1;
    else runs.push([slot, slot + 1]);
  }
  return runs;
}

/** Merge stored rules over the defaults so older drafts pick up new rule keys. */
export function normalizeRules(value: unknown): DraftRules {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<DraftRules>;
  return {
    ...DEFAULT_RULES,
    ...raw,
    min_on_desk: { ...DEFAULT_RULES.min_on_desk, ...raw.min_on_desk },
    lead_every_slot: { ...DEFAULT_RULES.lead_every_slot, ...raw.lead_every_slot },
    shift_length: { ...DEFAULT_RULES.shift_length, ...raw.shift_length },
    within_requested: { ...DEFAULT_RULES.within_requested, ...raw.within_requested },
    weekly_budget: { ...DEFAULT_RULES.weekly_budget, ...raw.weekly_budget },
    trainee_with_lead: { ...DEFAULT_RULES.trainee_with_lead, ...raw.trainee_with_lead },
  };
}
