import { describe, expect, it } from 'vitest';
import { seedFromBlocks } from '../lib/scheduleBuilder/copyFromTerm';
import type { DraftPerson } from '../lib/scheduleBuilder/model';

const person = (id: number, group: DraftPerson['group'] = 'student'): DraftPerson => ({
  student_assistant_id: id,
  group,
  responded: false,
  min_hours: null,
  ideal_hours: null,
  max_hours: null,
  notes: '',
  availability: {},
  assignments: {},
  import_warnings: [],
});

describe('seedFromBlocks', () => {
  it("copies another term's in-person blocks as assigned, available slots", () => {
    const { people, copied } = seedFromBlocks(
      [person(1, 'lead'), person(2)],
      [
        { student_assistant_id: 1, day: 'monday', start_time: '08:00:00+00', end_time: '10:30:00+00', is_remote: false },
        { student_assistant_id: 2, day: 'tuesday', start_time: '13:00', end_time: '15:00', is_remote: true },
        { student_assistant_id: 9, day: 'friday', start_time: '09:00', end_time: '11:00', is_remote: false },
      ],
    );

    expect(copied).toBe(1);
    expect(people[0].assignments.monday).toEqual({ '16': 'L', '17': 'L', '18': 'L', '19': 'L', '20': 'L' });
    expect(people[0].availability.monday).toEqual([16, 17, 18, 19, 20]);
    expect(people[1].assignments).toEqual({});
  });
});
