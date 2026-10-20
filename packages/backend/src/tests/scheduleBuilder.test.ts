import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  minutesToSlots,
  parseAvailabilityWorkbook,
  parseDayCell,
  parseTimeRange,
} from '../lib/scheduleBuilder/availabilityImport';
import { assignmentsToRuns, generateDraft } from '../lib/scheduleBuilder/generateDraft';
import {
  DEFAULT_RULES,
  WEEKDAYS,
  assignedRoleRuns,
  assignedSlots,
  deskSlots,
  toRuns,
  type DraftPerson,
  type DraftRules,
} from '../lib/scheduleBuilder/model';
import { applyImport, matchStudent, withRoster } from '../lib/scheduleBuilder/roster';
import type { Database } from '../types/database.types';

type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];

const fixturePath = join(__dirname, 'fixtures', 'forms-availability-sample.csv');

const student = (
  id: number,
  first_name: string,
  last_name: string,
  work_email: string | null,
  position: StudentAssistant['position'] = 'student_assistant',
): StudentAssistant => ({
  id,
  first_name,
  last_name,
  work_email,
  position,
  is_active: true,
  polycard_id: null,
  entra_user_id: null,
  created_at: '2026-01-01T00:00:00Z',
});

describe('availability import', () => {
  it('parses Forms time picks, including mid-hour free text', () => {
    expect(parseTimeRange('11 AM–12 PM')).toEqual([660, 720]);
    expect(parseTimeRange('12–1 PM')).toEqual([720, 780]);
    expect(parseTimeRange('8-10:20 AM')).toEqual([480, 620]);
    expect(parseTimeRange('1:30 - 3:00 PM')).toEqual([810, 900]);
    expect(minutesToSlots([480, 620])).toEqual([16, 17, 18, 19]);
    expect(minutesToSlots([810, 900])).toEqual([27, 28, 29]);
  });

  it('expands "Available all day" and keeps unreadable text as a warning', () => {
    expect(parseDayCell('Available all day (8 AM–5 PM);').slots).toEqual(deskSlots(DEFAULT_RULES));
    const cell = parseDayCell('9–10 AM;I might be available all-day Friday depending on waitlist coursework.');
    expect(cell.slots).toEqual([18, 19]);
    expect(cell.unread).toEqual(['I might be available all-day Friday depending on waitlist coursework.']);
  });

  it('reads a Forms CSV export into one response per row', () => {
    const result = parseAvailabilityWorkbook(readFileSync(fixturePath), 'availability.csv');

    expect(result.responses).toHaveLength(3);
    const [lena, sam] = result.responses;
    expect(lena).toMatchObject({ name: 'Lena Ortiz', email: 'lead.one@example.edu', min_hours: 10, ideal_hours: 15, max_hours: 20 });
    expect(lena.availability.monday).toEqual([16, 17, 18, 19, 20, 21, 22, 23]);
    expect(lena.availability.wednesday).toHaveLength(18);
    expect(lena.availability.thursday).toBeUndefined();
    expect(sam.availability.tuesday).toEqual([16, 17, 18, 19, 27, 28, 29]);
    expect(sam.warnings).toEqual(['Fri: I might be available all-day Friday depending on waitlist coursework.']);
    expect(sam.notes).toBe("My schedule could change, I'm on two waitlists.");
    expect(result.columns.map((column) => column.field)).toEqual([
      'email', 'name', ...WEEKDAYS, 'min_hours', 'max_hours', 'ideal_hours', 'notes',
    ]);
  });

  it('matches responses by email, then by name, ignoring accents', () => {
    const roster = [student(1, 'Lena', 'Ortiz', 'LEAD.ONE@example.edu'), student(2, 'Jose', 'Nunez', null)];
    expect(matchStudent({ email: 'lead.one@example.edu', name: 'x' }, roster)?.id).toBe(1);
    expect(matchStudent({ email: '', name: 'José Núñez' }, roster)?.id).toBe(2);
    expect(matchStudent({ email: '', name: 'Nobody Here' }, roster)).toBeNull();
  });

  it('merges responses into the draft and returns the rest as unmatched', () => {
    const roster = [student(1, 'Lena', 'Ortiz', 'lead.one@example.edu', 'student_lead'), student(2, 'Pat', 'Kim', 'pat@example.edu')];
    const { responses } = parseAvailabilityWorkbook(readFileSync(fixturePath), 'availability.csv');
    const result = applyImport(withRoster([], roster), responses, roster);

    expect(result.matched).toBe(1);
    expect(result.unmatched.map((row) => row.name)).toEqual(['Sam Reed', 'José Núñez']);
    const lena = result.people.find((person) => person.student_assistant_id === 1);
    expect(lena).toMatchObject({ group: 'lead', responded: true, ideal_hours: 15 });
    expect(result.people.find((person) => person.student_assistant_id === 2)?.responded).toBe(false);
  });
});

const allWeek = (start: number, end: number) =>
  Object.fromEntries(WEEKDAYS.map((day) => [day, Array.from({ length: end - start }, (_, i) => start + i)]));

const person = (id: number, overrides: Partial<DraftPerson> = {}): DraftPerson => ({
  student_assistant_id: id,
  group: 'student',
  responded: true,
  min_hours: 10,
  ideal_hours: 10,
  max_hours: 12,
  notes: '',
  availability: allWeek(16, 34),
  assignments: {},
  import_warnings: [],
  ...overrides,
});

const hoursOf = (p: DraftPerson) => WEEKDAYS.reduce((sum, day) => sum + assignedSlots(p, day).length, 0) / 2;

describe('generateDraft', () => {
  const rules: DraftRules = { ...DEFAULT_RULES, min_on_desk: { enabled: true, value: 2 } };

  it('covers every desk slot with a lead and the minimum headcount', () => {
    const people = [
      person(1, { group: 'lead', ideal_hours: 20, max_hours: 25 }),
      person(2, { group: 'lead', ideal_hours: 20, max_hours: 25 }),
      ...[3, 4, 5, 6, 7, 8].map((id) => person(id)),
    ];
    const result = generateDraft(people, rules);

    for (const day of WEEKDAYS) {
      for (const slot of deskSlots(rules)) {
        const onDesk = result.filter((p) => p.assignments[day]?.[String(slot)]);
        expect(onDesk.length, `${day} ${slot}`).toBeGreaterThanOrEqual(2);
        expect(onDesk.some((p) => p.group === 'lead'), `${day} ${slot} lead`).toBe(true);
      }
    }
  });

  it('respects availability, requested max hours and shift length', () => {
    const people = [
      person(1, { group: 'lead', ideal_hours: 20, max_hours: 22 }),
      person(2, { group: 'lead', ideal_hours: 20, max_hours: 22 }),
      person(3, { availability: { monday: [20, 21, 22, 23, 24, 25] }, max_hours: 2, ideal_hours: 2 }),
      ...[4, 5, 6, 7].map((id) => person(id)),
    ];
    const result = generateDraft(people, rules);

    const limited = result.find((p) => p.student_assistant_id === 3)!;
    expect(hoursOf(limited)).toBeLessThanOrEqual(2);
    expect(Object.keys(limited.assignments)).toEqual(limited.assignments.monday ? ['monday'] : []);
    for (const slot of assignedSlots(limited, 'monday')) expect(slot >= 20 && slot < 26).toBe(true);

    for (const p of result) {
      expect(hoursOf(p)).toBeLessThanOrEqual(p.max_hours ?? Infinity);
      for (const day of WEEKDAYS) {
        for (const [start, end] of toRuns(assignedSlots(p, day))) {
          expect(end - start, `person ${p.student_assistant_id} ${day}`).toBeGreaterThanOrEqual(4);
          expect(end - start).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it('tops people up to their target hours even where the desk is already covered', () => {
    const relaxed: DraftRules = { ...rules, min_on_desk: { enabled: true, value: 1 } };
    const people = [person(1, { group: 'lead', ideal_hours: 45, max_hours: 45 }), ...[2, 3, 4].map((id) => person(id))];
    const result = generateDraft(people, relaxed);

    for (const p of result.slice(1)) expect(hoursOf(p), `person ${p.student_assistant_id}`).toBeGreaterThanOrEqual(10);
  });

  it('paints leads as L and everyone else as Main', () => {
    const result = generateDraft([person(1, { group: 'lead' }), person(2)], rules);
    const roles = (p: DraftPerson) => new Set(WEEKDAYS.flatMap((day) => Object.values(p.assignments[day] ?? {})));
    expect([...roles(result[0])]).toEqual(['L']);
    expect([...roles(result[1])]).toEqual(['m']);
  });

  it('splits runs where the role changes, for Teams themes', () => {
    expect(assignedRoleRuns({ tuesday: { '16': 'L', '17': 'L', '18': 't', '20': 't' } })).toEqual([
      { day: 'tuesday', start: 16, end: 18, role: 'L' },
      { day: 'tuesday', start: 18, end: 19, role: 't' },
      { day: 'tuesday', start: 20, end: 21, role: 't' },
    ]);
  });

  it('turns contiguous slots into one block per run', () => {
    expect(assignmentsToRuns({ monday: { '16': 'L', '17': 'm', '20': 'm' } })).toEqual([
      { day: 'monday', start: 16, end: 18 },
      { day: 'monday', start: 20, end: 21 },
    ]);
  });
});
