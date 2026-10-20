"use client"

import { useState } from "react"
import { X } from "lucide-react"

import { HoursBar, Panel } from "@/components/admin/schedule-builder/builder-ui"
import { ROLE_BG } from "@/components/admin/schedule-builder/review-grid"
import type { BuilderContext } from "@/components/admin/schedule-builder/schedule-builder"
import type { Weekday } from "@/components/admin/terms/term-types"
import type { DraftPerson, ShiftRole } from "@/lib/api/schedule-drafts"
import {
  DAY_SHORT,
  GROUP_LABEL,
  ROLE_LABEL,
  WEEKDAYS,
  assignedHours,
  deskHours,
  hourShort,
  hoursLabel,
  isAvailable,
  requestedLabel,
  roleAt,
  setRole,
  slotRange,
  type DraftChecks,
} from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

const LEDGER_SIZE = 12

/** Hours outside the requested range: negative when under the minimum, positive when over the maximum. */
function offBy(person: DraftPerson): number {
  const hours = assignedHours(person)
  if (person.min_hours != null && hours < person.min_hours) return hours - person.min_hours
  if (person.max_hours != null && hours > person.max_hours) return hours - person.max_hours
  return 0
}

function rolesFor(person: DraftPerson): ShiftRole[] {
  if (person.group === "lead") return ["L", "m"]
  if (person.group === "trainee") return ["t"]
  return ["m", "t"]
}

/** 14.3c · fill slots, not rows: pick an hour, see who's on and who could be. */
export function SlotFiller({ context, checks }: Readonly<{ context: BuilderContext; checks: DraftChecks }>) {
  const { draft, people, nameOf, students, edit, log } = context
  const hours = deskHours(draft.rules)
  const [selected, setSelected] = useState<{ day: Weekday; hour: number }>({ day: "monday", hour: hours[0] ?? 8 })
  const minOnDesk = draft.rules.min_on_desk.enabled ? draft.rules.min_on_desk.value : 1
  const firstName = (id: number) => students.get(id)?.first_name?.trim() || nameOf(id)

  const slotsOf = (hour: number) =>
    [hour * 2, hour * 2 + 1].filter((slot) => slot >= draft.rules.desk_start_slot && slot < draft.rules.desk_end_slot)
  const onAt = (day: Weekday, hour: number) =>
    people.filter((person) => slotsOf(hour).some((slot) => roleAt(person, day, slot)))
  const hourStats = (day: Weekday, hour: number) => {
    const slots = slotsOf(hour)
    const all = Math.min(...slots.map((slot) => checks.headcount(day, slot)))
    const leads = onAt(day, hour).filter((person) => slots.some((slot) => roleAt(person, day, slot) === "L"))
    return { all, leads }
  }

  const updatePerson = (studentId: number, update: (person: DraftPerson) => DraftPerson) =>
    edit((current) => ({
      ...current,
      people: current.people.map((person) => (person.student_assistant_id === studentId ? update(person) : person)),
    }))

  const { day, hour } = selected
  const slots = slotsOf(hour)
  const label = `${DAY_SHORT[day]} ${slotRange(slots[0], slots[slots.length - 1] + 1)}`
  const on = onAt(day, hour)
  const available = people
    .filter((person) => !on.includes(person) && slots.some((slot) => isAvailable(person, day, slot)))
    .sort((a, b) => offBy(a) - offBy(b) || nameOf(a.student_assistant_id).localeCompare(nameOf(b.student_assistant_id)))
  const stats = hourStats(day, hour)

  const assign = (person: DraftPerson, role: ShiftRole) => {
    const open = slots.filter((slot) => isAvailable(person, day, slot))
    updatePerson(person.student_assistant_id, (current) => setRole(current, day, open, role))
    log(`${nameOf(person.student_assistant_id)}: ${DAY_SHORT[day]} ${slotRange(open[0], open[open.length - 1] + 1)} → ${ROLE_LABEL[role]}`)
  }
  const remove = (person: DraftPerson) => {
    updatePerson(person.student_assistant_id, (current) => setRole(current, day, slots, null))
    log(`${nameOf(person.student_assistant_id)}: removed ${label}`)
  }

  const ledger = [...people]
    .filter((person) => person.responded || assignedHours(person) > 0)
    .sort((a, b) => Math.abs(offBy(b)) - Math.abs(offBy(a)))
    .slice(0, LEDGER_SIZE)

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex flex-col gap-3.5">
        <Panel className="flex flex-col gap-1.5 px-[18px] py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
            <span className="text-base font-bold">Coverage</span>
            <span className="text-xs text-muted-foreground">Red: no lead · amber: under {minOnDesk} people · click any hour</span>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[640px] gap-[5px]" style={{ gridTemplateColumns: `56px repeat(${hours.length}, minmax(0, 1fr))` }}>
              <span />
              {hours.map((h) => (
                <span key={h} className="text-center font-mono text-[13px] font-semibold text-muted-foreground">
                  {hourShort(h)}
                </span>
              ))}
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="contents">
                  <span className="self-center text-sm font-bold">{DAY_SHORT[weekday]}</span>
                  {hours.map((h) => {
                    const { all, leads } = hourStats(weekday, h)
                    const noLead = draft.rules.lead_every_slot.enabled && leads.length === 0
                    const thin = all < minOnDesk
                    const isSelected = weekday === day && h === hour
                    return (
                      <button
                        key={h}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelected({ day: weekday, hour: h })}
                        className={cn(
                          "flex h-[62px] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border-2 px-1",
                          noLead
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : thin
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200"
                              : "border-transparent bg-accent/10 text-accent",
                          isSelected && "outline-2 outline-offset-2 outline-foreground",
                        )}
                      >
                        <span className="font-mono text-lg font-semibold">{all}</span>
                        <span className="max-w-full truncate text-[11px] font-bold">
                          {leads.length ? leads.map((person) => firstName(person.student_assistant_id)).join(", ") : "no lead"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-2.5 px-[18px] py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-base font-bold">Hours ledger</span>
            <span className="text-xs text-muted-foreground">Scheduled vs. requested, furthest off first</span>
          </div>
          <div className="grid gap-x-[18px] gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            {ledger.map((person) => (
              <div key={person.student_assistant_id} className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-2.5">
                <span className="truncate text-[13px] font-semibold">{nameOf(person.student_assistant_id)}</span>
                <HoursBar hours={assignedHours(person)} min={person.min_hours} max={person.max_hours} label={requestedLabel(person)} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="flex flex-col gap-3.5 px-5 py-[18px] xl:sticky xl:top-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">Selected hour</span>
          <span className="font-mono text-[22px] font-semibold tracking-[-0.01em]">{label}</span>
          <span
            className={cn(
              "text-[13px] font-semibold",
              stats.leads.length === 0 ? "text-destructive" : stats.all < minOnDesk ? "text-amber-700 dark:text-amber-300" : "text-accent",
            )}
          >
            {stats.leads.length === 0
              ? "No lead this hour"
              : stats.all < minOnDesk
                ? `Thin: ${stats.all} people`
                : `${stats.all} people · ${stats.leads.length > 1 ? "leads" : "lead"} ${stats.leads.map((person) => firstName(person.student_assistant_id)).join(", ")}`}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">On desk · {on.length}</span>
          {on.length === 0 ? <span className="text-[13px] text-muted-foreground">Nobody yet.</span> : null}
          {on.map((person) => {
            const role = slots.map((slot) => roleAt(person, day, slot)).find(Boolean)!
            const off = offBy(person)
            return (
              <div key={person.student_assistant_id} className="flex items-center gap-2.5 rounded-xl bg-muted/50 py-1.5 pr-2 pl-2.5">
                <span className={cn("flex size-[22px] items-center justify-center rounded-md text-[11px] font-extrabold text-role-foreground", ROLE_BG[role])}>
                  {role === "m" ? "M" : role === "t" ? "T" : "L"}
                </span>
                <span className="flex-1 truncate text-[13px] font-semibold">{nameOf(person.student_assistant_id)}</span>
                <span className={cn("font-mono text-xs", off ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                  {assignedHours(person)}/{requestedLabel(person)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(person)}
                  title="Remove from this hour"
                  aria-label={`Remove ${nameOf(person.student_assistant_id)} from this hour`}
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">Available, not scheduled · {available.length}</span>
          {available.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">
              Nobody else marked this hour available. Open hours in the Availability layer.
            </span>
          ) : null}
          {available.map((person) => {
            const off = offBy(person)
            const note = off < 0 ? `needs ${hoursLabel(-off)} more` : off > 0 ? "already over" : "in range"
            return (
              <div
                key={person.student_assistant_id}
                className="flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 py-1.5 pr-2 pl-2.5"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold">{nameOf(person.student_assistant_id)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {GROUP_LABEL[person.group]} · {note}
                  </span>
                </span>
                <span className={cn("font-mono text-xs font-semibold", off < 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                  {assignedHours(person)}/{requestedLabel(person)}
                </span>
                <span className="flex gap-1">
                  {rolesFor(person).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => assign(person, role)}
                      className={cn("h-7 rounded-full px-2.5 text-xs font-bold text-role-foreground", ROLE_BG[role])}
                    >
                      + {ROLE_LABEL[role]}
                    </button>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
