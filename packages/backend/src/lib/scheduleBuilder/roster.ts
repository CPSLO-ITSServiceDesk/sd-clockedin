import type { Database } from '../../types/database.types';
import type { AvailabilityResponse } from './availabilityImport';
import type { DraftPerson, PersonGroup, UnmatchedResponse } from './model';

type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fullName(student: Pick<StudentAssistant, 'first_name' | 'last_name'>): string {
  return normalizeName(`${student.first_name ?? ''} ${student.last_name ?? ''}`);
}

export function groupForStudent(student: Pick<StudentAssistant, 'position'>): PersonGroup {
  return student.position === 'student_lead' ? 'lead' : 'student';
}

export function emptyPerson(student: StudentAssistant): DraftPerson {
  return {
    student_assistant_id: student.id,
    group: groupForStudent(student),
    responded: false,
    min_hours: null,
    ideal_hours: null,
    max_hours: null,
    notes: '',
    availability: {},
    assignments: {},
    import_warnings: [],
  };
}

/** Add active students that aren't in the draft yet (e.g. hired after it was started). */
export function withRoster(people: DraftPerson[], students: StudentAssistant[]): DraftPerson[] {
  const known = new Set(people.map((person) => person.student_assistant_id));
  const additions = students
    .filter((student) => student.is_active && !known.has(student.id))
    .map(emptyPerson);
  return additions.length > 0 ? [...people, ...additions] : people;
}

/** Find the roster student for a response: exact work email, then full name, then first + last word. */
export function matchStudent(
  response: Pick<AvailabilityResponse, 'email' | 'name'>,
  students: StudentAssistant[],
): StudentAssistant | null {
  const email = response.email.trim().toLowerCase();
  if (email) {
    const byEmail = students.find((student) => student.work_email?.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  const name = normalizeName(response.name);
  if (!name) return null;
  const byName = students.filter((student) => fullName(student) === name);
  if (byName.length === 1) return byName[0];

  const words = name.split(' ');
  const firstLast = `${words[0]} ${words[words.length - 1]}`;
  const byFirstLast = students.filter((student) => {
    const parts = fullName(student).split(' ');
    return `${parts[0]} ${parts[parts.length - 1]}` === firstLast;
  });
  return byFirstLast.length === 1 ? byFirstLast[0] : null;
}

export function responseToPerson(
  response: Omit<UnmatchedResponse, 'key' | 'name' | 'email'> & { import_warnings: string[] },
  base: DraftPerson,
): DraftPerson {
  return {
    ...base,
    responded: true,
    min_hours: response.min_hours,
    ideal_hours: response.ideal_hours,
    max_hours: response.max_hours,
    notes: response.notes,
    availability: response.availability,
    import_warnings: response.import_warnings,
  };
}

export interface ApplyImportResult {
  people: DraftPerson[];
  unmatched: UnmatchedResponse[];
  matched: number;
}

/**
 * Merge imported responses into the draft. Matched people get their form
 * availability, hours and notes; assignments are kept so a re-import doesn't
 * wipe a reviewed draft.
 */
export function applyImport(
  people: DraftPerson[],
  responses: AvailabilityResponse[],
  students: StudentAssistant[],
): ApplyImportResult {
  const byId = new Map(people.map((person) => [person.student_assistant_id, person]));
  const unmatched: UnmatchedResponse[] = [];
  let matched = 0;

  for (const response of responses) {
    const student = matchStudent(response, students);
    const imported = {
      min_hours: response.min_hours,
      ideal_hours: response.ideal_hours,
      max_hours: response.max_hours,
      notes: response.notes,
      availability: response.availability,
      import_warnings: response.warnings,
    };
    if (!student) {
      unmatched.push({
        key: `row-${response.rowNumber}`,
        name: response.name,
        email: response.email,
        ...imported,
      });
      continue;
    }
    matched += 1;
    byId.set(student.id, responseToPerson(imported, byId.get(student.id) ?? emptyPerson(student)));
  }

  return { people: [...byId.values()], unmatched, matched };
}
