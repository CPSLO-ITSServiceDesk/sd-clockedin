import { WEEKDAY_OPTIONS, type Weekday } from "@/components/admin/terms/term-types"
import type {
  DaySlots,
  DraftPerson,
  DraftRules,
  PersonGroup,
  ShiftRole,
} from "@/lib/api/schedule-drafts"

/** Half-hour slots: slot n starts n * 30 minutes after midnight (16 = 8:00). */
export const SLOT_MINUTES = 30

export const WEEKDAYS: Weekday[] = WEEKDAY_OPTIONS.map((option) => option.value)

export const DAY_SHORT: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
}

export const ROLE_LABEL: Record<ShiftRole, string> = { L: "Lead", m: "Main", t: "Training" }

export const GROUP_LABEL: Record<PersonGroup, string> = {
  lead: "Leads",
  student: "Students",
  trainee: "Trainees",
}

export const GROUP_ORDER: PersonGroup[] = ["lead", "student", "trainee"]

/** Desk hours when no draft rules exist yet: 8:00 AM – 5:00 PM. */
export const DEFAULT_DESK: Pick<DraftRules, "desk_start_slot" | "desk_end_slot"> = {
  desk_start_slot: 16,
  desk_end_slot: 34,
}

export function defaultRoleFor(group: PersonGroup): ShiftRole {
  if (group === "lead") return "L"
  if (group === "trainee") return "t"
  return "m"
}

export function deskSlots(rules: Pick<DraftRules, "desk_start_slot" | "desk_end_slot">): number[] {
  const slots: number[] = []
  for (let slot = rules.desk_start_slot; slot < rules.desk_end_slot; slot += 1) slots.push(slot)
  return slots
}

/** Desk hours as whole-hour columns, e.g. 8..16 for an 8:00–5:00 desk. */
export function deskHours(rules: Pick<DraftRules, "desk_start_slot" | "desk_end_slot">): number[] {
  const hours: number[] = []
  for (let slot = rules.desk_start_slot; slot < rules.desk_end_slot; slot += 2) hours.push(Math.floor(slot / 2))
  return hours
}

function clock(slot: number): { h: number; m: number; pm: boolean } {
  const minutes = slot * SLOT_MINUTES
  const h24 = Math.floor(minutes / 60)
  return { h: h24 % 12 || 12, m: minutes % 60, pm: h24 >= 12 }
}

/** "8a", "12p" */
export function hourShort(hour: number): string {
  return `${hour % 12 || 12}${hour < 12 ? "a" : "p"}`
}

/** "9:00", "1:30" */
export function slotClock(slot: number): string {
  const { h, m } = clock(slot)
  return `${h}:${String(m).padStart(2, "0")}`
}

/** "9:00 AM", "1:30 PM" */
export function slotTimeLabel(slot: number): string {
  return `${slotClock(slot)} ${clock(slot).pm ? "PM" : "AM"}`
}

/** "9:00–11:30 AM", "11:00 AM–1:00 PM" (end exclusive). */
export function slotRange(start: number, end: number): string {
  const a = clock(start)
  const b = clock(end)
  const suffix = (pm: boolean) => (pm ? "PM" : "AM")
  return `${slotClock(start)}${a.pm === b.pm ? "" : ` ${suffix(a.pm)}`}–${slotClock(end)} ${suffix(b.pm)}`
}

export function hoursLabel(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}

/** "10–15", "10", or "—" */
export function requestedLabel(person: Pick<DraftPerson, "min_hours" | "max_hours">): string {
  const { min_hours: min, max_hours: max } = person
  if (min == null && max == null) return "—"
  if (min == null || max == null || min === max) return String(min ?? max)
  return `${min}–${max}`
}

/** Contiguous runs, end exclusive: [16,17,18,22] → [[16,19],[22,23]]. */
export function toRuns(slots: number[]): [number, number][] {
  const sorted = [...new Set(slots)].sort((a, b) => a - b)
  const runs: [number, number][] = []
  for (const slot of sorted) {
    const last = runs[runs.length - 1]
    if (last && last[1] === slot) last[1] = slot + 1
    else runs.push([slot, slot + 1])
  }
  return runs
}

export function isAvailable(person: Pick<DraftPerson, "availability">, day: Weekday, slot: number): boolean {
  return person.availability[day]?.includes(slot) ?? false
}

export function roleAt(person: Pick<DraftPerson, "assignments">, day: Weekday, slot: number): ShiftRole | null {
  return person.assignments[day]?.[String(slot)] ?? null
}

export function assignedSlots(person: Pick<DraftPerson, "assignments">, day: Weekday): number[] {
  return Object.keys(person.assignments[day] ?? {})
    .map(Number)
    .sort((a, b) => a - b)
}

export function assignedHours(person: Pick<DraftPerson, "assignments">, days: Weekday[] = WEEKDAYS): number {
  return days.reduce((sum, day) => sum + assignedSlots(person, day).length, 0) / 2
}

export function availableHours(person: Pick<DraftPerson, "availability">): number {
  return WEEKDAYS.reduce((sum, day) => sum + (person.availability[day]?.length ?? 0), 0) / 2
}

export function shiftCount(person: Pick<DraftPerson, "assignments">): number {
  return WEEKDAYS.reduce((sum, day) => sum + toRuns(assignedSlots(person, day)).length, 0)
}

export function setRole(person: DraftPerson, day: Weekday, slots: number[], role: ShiftRole | null): DraftPerson {
  const dayAssignments = { ...(person.assignments[day] ?? {}) }
  for (const slot of slots) {
    if (role) dayAssignments[String(slot)] = role
    else delete dayAssignments[String(slot)]
  }
  return { ...person, assignments: { ...person.assignments, [day]: dayAssignments } }
}

/** Opening or closing hours; closing also drops any shift in them. */
export function setAvailable(person: DraftPerson, day: Weekday, slots: number[], available: boolean): DraftPerson {
  const current = new Set(person.availability[day] ?? [])
  for (const slot of slots) {
    if (available) current.add(slot)
    else current.delete(slot)
  }
  const availability: DaySlots = { ...person.availability, [day]: [...current].sort((a, b) => a - b) }
  const next = { ...person, availability }
  return available ? next : setRole(next, day, slots, null)
}

export interface SlotCell {
  day: Weekday
  slot: number
}

export interface DraftChecks {
  headcount: (day: Weekday, slot: number) => number
  leads: (day: Weekday, slot: number) => number
  noLead: SlotCell[]
  thin: SlotCell[]
  outOfRange: DraftPerson[]
  shortShifts: number
  traineesAlone: SlotCell[]
  totalHours: number
  totalShifts: number
  overBudget: boolean
}

export function computeChecks(people: DraftPerson[], rules: DraftRules): DraftChecks {
  const key = (day: Weekday, slot: number) => `${day}|${slot}`
  const counts = new Map<string, { all: number; leads: number; trainees: number }>()
  for (const person of people) {
    for (const day of WEEKDAYS) {
      for (const [slotKey, role] of Object.entries(person.assignments[day] ?? {})) {
        const k = key(day, Number(slotKey))
        const entry = counts.get(k) ?? { all: 0, leads: 0, trainees: 0 }
        entry.all += 1
        if (role === "L") entry.leads += 1
        if (role === "t") entry.trainees += 1
        counts.set(k, entry)
      }
    }
  }

  const desk = deskSlots(rules)
  const cells = WEEKDAYS.flatMap((day) => desk.map((slot) => ({ day, slot })))
  const at = (day: Weekday, slot: number) => counts.get(key(day, slot)) ?? { all: 0, leads: 0, trainees: 0 }
  const minLen = rules.shift_length.min_hours * 2

  const totalHours = people.reduce((sum, person) => sum + assignedHours(person), 0)
  return {
    headcount: (day, slot) => at(day, slot).all,
    leads: (day, slot) => at(day, slot).leads,
    noLead: rules.lead_every_slot.enabled ? cells.filter((c) => at(c.day, c.slot).leads === 0) : [],
    thin: rules.min_on_desk.enabled
      ? cells.filter((c) => at(c.day, c.slot).all < rules.min_on_desk.value)
      : [],
    outOfRange: people.filter((person) => {
      const hours = assignedHours(person)
      if (hours === 0 && !person.responded) return false
      return (person.min_hours != null && hours < person.min_hours) ||
        (person.max_hours != null && hours > person.max_hours)
    }),
    shortShifts: rules.shift_length.enabled
      ? people.reduce(
          (sum, person) =>
            sum +
            WEEKDAYS.reduce(
              (daySum, day) =>
                daySum + toRuns(assignedSlots(person, day)).filter(([a, b]) => b - a < minLen).length,
              0,
            ),
          0,
        )
      : 0,
    traineesAlone: rules.trainee_with_lead.enabled
      ? cells.filter((c) => at(c.day, c.slot).trainees > 0 && at(c.day, c.slot).leads === 0)
      : [],
    totalHours,
    totalShifts: people.reduce((sum, person) => sum + shiftCount(person), 0),
    overBudget: rules.weekly_budget.enabled && totalHours > rules.weekly_budget.hours,
  }
}

/** "Mon 9:00, Tue 3:30 +4" for a list of slot cells. */
export function summarizeCells(cells: SlotCell[], limit = 3): string {
  const labels = cells.slice(0, limit).map((cell) => `${DAY_SHORT[cell.day]} ${slotClock(cell.slot)}`)
  return cells.length > limit ? `${labels.join(", ")} +${cells.length - limit}` : labels.join(", ")
}
