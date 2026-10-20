import { timeToMinutes } from '../time';
import { SLOT_MINUTES, defaultRoleFor, type DraftPerson, type Weekday } from './model';

export interface CopiedBlock {
  student_assistant_id: number;
  day: Weekday;
  start_time: string;
  end_time: string;
  is_remote: boolean;
}

/**
 * Seed a draft from another term's weekly blocks: each in-person block becomes
 * assigned half-hour slots (in the person's default role), and those hours are
 * marked available so they stay editable. Remote blocks aren't copied.
 */
export function seedFromBlocks(people: DraftPerson[], blocks: CopiedBlock[]): { people: DraftPerson[]; copied: number } {
  const byStudent = new Map<number, CopiedBlock[]>();
  for (const block of blocks) {
    if (block.is_remote) continue;
    byStudent.set(block.student_assistant_id, [...(byStudent.get(block.student_assistant_id) ?? []), block]);
  }

  let copied = 0;
  const seeded = people.map((person) => {
    const own = byStudent.get(person.student_assistant_id);
    if (!own?.length) return person;
    const role = defaultRoleFor(person.group);
    const assignments = { ...person.assignments };
    const availability = { ...person.availability };
    for (const block of own) {
      const start = Math.floor(timeToMinutes(block.start_time) / SLOT_MINUTES);
      const end = Math.ceil(timeToMinutes(block.end_time) / SLOT_MINUTES);
      if (!(end > start)) continue;
      const day = { ...(assignments[block.day] ?? {}) };
      const open = new Set(availability[block.day] ?? []);
      for (let slot = start; slot < end; slot += 1) {
        day[String(slot)] = role;
        open.add(slot);
      }
      assignments[block.day] = day;
      availability[block.day] = [...open].sort((a, b) => a - b);
      copied += 1;
    }
    return { ...person, assignments, availability };
  });
  return { people: seeded, copied };
}
