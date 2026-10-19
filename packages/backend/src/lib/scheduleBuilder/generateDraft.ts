import {
  SLOT_MINUTES,
  WEEKDAYS,
  defaultRoleFor,
  deskSlots,
  toRuns,
  type DayAssignments,
  type DraftPerson,
  type DraftRules,
  type Weekday,
} from './model';

const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;

/** Weekly target when a person didn't give an ideal or minimum. */
const FALLBACK_TARGET_HOURS = 10;

interface Planner {
  person: DraftPerson;
  available: Record<Weekday, Set<number>>;
  assigned: Record<Weekday, Set<number>>;
  targetSlots: number;
  capSlots: number;
}

function emptyDays(): Record<Weekday, Set<number>> {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, new Set<number>()])) as Record<
    Weekday,
    Set<number>
  >;
}

function totalAssigned(planner: Planner): number {
  return WEEKDAYS.reduce((sum, day) => sum + planner.assigned[day].size, 0);
}

function runAround(slots: Set<number>, slot: number): [number, number] {
  let start = slot;
  let end = slot + 1;
  while (slots.has(start - 1)) start -= 1;
  while (slots.has(end)) end += 1;
  return [start, end];
}

/**
 * Smallest set of new slots that puts `planner` on desk at `slot` while keeping
 * shifts contiguous and within the shift-length rule, or null if impossible.
 * When a new shift is needed, the window that fills the most short-staffed
 * slots (by `need`) wins, so shifts reach into uncovered hours.
 */
function slotsToCover(
  planner: Planner,
  day: Weekday,
  slot: number,
  minLen: number,
  maxLen: number,
  need: (slot: number) => number,
): number[] | null {
  const available = planner.available[day];
  const assigned = planner.assigned[day];
  if (!available.has(slot) || assigned.has(slot)) return null;

  // Extending an existing shift by one slot keeps the schedule tidy.
  const withSlot = new Set(assigned).add(slot);
  const [runStart, runEnd] = runAround(withSlot, slot);
  if ((assigned.has(slot - 1) || assigned.has(slot + 1)) && runEnd - runStart <= maxLen) {
    return [slot];
  }

  // Otherwise open a new shift of the minimum length that contains `slot`.
  let best: number[] | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let start = slot - minLen + 1; start <= slot; start += 1) {
    const window: number[] = [];
    for (let s = start; s < start + minLen; s += 1) window.push(s);
    if (!window.every((s) => available.has(s) && !assigned.has(s))) continue;
    // Don't butt up against another shift so they merge past the max length.
    const merged = new Set([...assigned, ...window]);
    const [mergedStart, mergedEnd] = runAround(merged, slot);
    if (mergedEnd - mergedStart > maxLen) continue;
    const score = window.reduce((sum, s) => sum + need(s), 0);
    if (score > bestScore) {
      best = window;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Rule-based first draft: cover every desk slot (a lead, then the minimum
 * headcount, scarcest slots first), then top people up toward their target
 * hours. Existing assignments are discarded.
 */
export function generateDraft(people: DraftPerson[], rules: DraftRules): DraftPerson[] {
  const desk = new Set(deskSlots(rules));
  const minLen = rules.shift_length.enabled
    ? Math.max(1, Math.round(rules.shift_length.min_hours * SLOTS_PER_HOUR))
    : 1;
  const maxLen = rules.shift_length.enabled
    ? Math.max(minLen, Math.round(rules.shift_length.max_hours * SLOTS_PER_HOUR))
    : desk.size;
  const minOnDesk = rules.min_on_desk.enabled ? rules.min_on_desk.value : 1;
  const budgetSlots = rules.weekly_budget.enabled
    ? Math.round(rules.weekly_budget.hours * SLOTS_PER_HOUR)
    : Number.POSITIVE_INFINITY;

  const planners: Planner[] = people.map((person) => {
    const available = emptyDays();
    for (const day of WEEKDAYS) {
      for (const slot of person.availability[day] ?? []) if (desk.has(slot)) available[day].add(slot);
    }
    const target = person.ideal_hours ?? person.min_hours ?? person.max_hours ?? FALLBACK_TARGET_HOURS;
    const cap =
      rules.within_requested.enabled && person.max_hours != null
        ? person.max_hours
        : Number.POSITIVE_INFINITY;
    return {
      person,
      available,
      assigned: emptyDays(),
      targetSlots: Math.round(target * SLOTS_PER_HOUR),
      capSlots: cap === Number.POSITIVE_INFINITY ? cap : Math.round(cap * SLOTS_PER_HOUR),
    };
  });

  const onDesk = (day: Weekday, slot: number) =>
    planners.filter((planner) => planner.assigned[day].has(slot));
  const hasLead = (day: Weekday, slot: number) =>
    onDesk(day, slot).some((planner) => planner.person.group === 'lead');
  /** How short a slot is: missing headcount, plus one if it still needs a lead. */
  const shortfall = (day: Weekday, slot: number) => {
    const people = onDesk(day, slot);
    const missingLead =
      rules.lead_every_slot.enabled && !people.some((planner) => planner.person.group === 'lead') ? 1 : 0;
    return Math.max(0, minOnDesk - people.length) + missingLead;
  };
  const grandTotal = () => planners.reduce((sum, planner) => sum + totalAssigned(planner), 0);

  /** Furthest below target first; trainees last so they don't take core coverage. */
  const byNeed = (a: Planner, b: Planner) => {
    const traineeDiff =
      Number(a.person.group === 'trainee') - Number(b.person.group === 'trainee');
    if (traineeDiff !== 0) return traineeDiff;
    const needDiff = b.targetSlots - totalAssigned(b) - (a.targetSlots - totalAssigned(a));
    if (needDiff !== 0) return needDiff;
    return a.person.student_assistant_id - b.person.student_assistant_id;
  };

  /** Leads are scarce, so once a slot has one, fill the rest of the headcount with others first. */
  const tryAssign = (pool: Planner[], day: Weekday, slot: number, saveLeads = false): boolean => {
    const ordered = [...pool].sort(
      (a, b) =>
        (saveLeads ? Number(a.person.group === 'lead') - Number(b.person.group === 'lead') : 0) ||
        byNeed(a, b),
    );
    for (const planner of ordered) {
      const add = slotsToCover(planner, day, slot, minLen, maxLen, (s) => shortfall(day, s));
      if (!add || totalAssigned(planner) + add.length > planner.capSlots) continue;
      add.forEach((s) => planner.assigned[day].add(s));
      return true;
    }
    return false;
  };

  // Phase 1: coverage, scarcest slots first.
  const deskCells = WEEKDAYS.flatMap((day) => [...desk].map((slot) => ({ day, slot })));
  const supply = (day: Weekday, slot: number) =>
    planners.filter((planner) => planner.available[day].has(slot)).length;
  deskCells.sort((a, b) => supply(a.day, a.slot) - supply(b.day, b.slot) || a.slot - b.slot);

  for (const { day, slot } of deskCells) {
    if (rules.lead_every_slot.enabled && !hasLead(day, slot)) {
      tryAssign(
        planners.filter((planner) => planner.person.group === 'lead'),
        day,
        slot,
      );
    }
    while (onDesk(day, slot).length < minOnDesk) {
      if (!tryAssign(planners, day, slot, rules.lead_every_slot.enabled && hasLead(day, slot))) break;
    }
  }

  // Phase 2: top up hours, adding to the least-staffed slots.
  let progress = true;
  while (progress && grandTotal() < budgetSlots) {
    progress = false;
    for (const planner of [...planners].sort(byNeed)) {
      if (totalAssigned(planner) >= Math.min(planner.targetSlots, planner.capSlots)) continue;
      const candidates = deskCells
        .filter(({ day, slot }) => planner.available[day].has(slot) && !planner.assigned[day].has(slot))
        .sort(
          (a, b) =>
            onDesk(a.day, a.slot).length - onDesk(b.day, b.slot).length ||
            WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) ||
            a.slot - b.slot,
        );
      for (const { day, slot } of candidates) {
        // Top-up prefers the thinnest slots so extra hours spread the desk evenly.
        const add = slotsToCover(planner, day, slot, minLen, maxLen, (s) => -onDesk(day, s).length);
        if (!add || totalAssigned(planner) + add.length > planner.capSlots) continue;
        if (grandTotal() + add.length > budgetSlots) continue;
        add.forEach((s) => planner.assigned[day].add(s));
        progress = true;
        break;
      }
    }
  }

  return planners.map(({ person, assigned }) => {
    const role = defaultRoleFor(person.group);
    const assignments: DayAssignments = {};
    for (const day of WEEKDAYS) {
      if (assigned[day].size === 0) continue;
      assignments[day] = Object.fromEntries([...assigned[day]].sort((a, b) => a - b).map((s) => [String(s), role]));
    }
    return { ...person, assignments };
  });
}

/** Weekly blocks to publish: one block per contiguous run of assigned slots, any role. */
export function assignmentsToRuns(assignments: DayAssignments): { day: Weekday; start: number; end: number }[] {
  return WEEKDAYS.flatMap((day) =>
    toRuns(Object.keys(assignments[day] ?? {}).map(Number)).map(([start, end]) => ({ day, start, end })),
  );
}
