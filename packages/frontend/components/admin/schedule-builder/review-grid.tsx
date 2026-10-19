"use client"

import { memo } from "react"

import { HoursBar } from "@/components/admin/schedule-builder/builder-ui"
import type { Weekday } from "@/components/admin/terms/term-types"
import type { DraftPerson, DraftRules, ShiftRole } from "@/lib/api/schedule-drafts"
import {
  DAY_SHORT,
  GROUP_LABEL,
  ROLE_LABEL,
  assignedHours,
  deskHours,
  hourShort,
  isAvailable,
  requestedLabel,
  roleAt,
  slotRange,
  type DraftChecks,
} from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

export type Layer = "shifts" | "availability"

export interface GridCell {
  studentId: number
  day: Weekday
  slot: number
}

export const ROLE_BG: Record<ShiftRole, string> = {
  L: "bg-role-lead",
  m: "bg-role-main",
  t: "bg-role-training",
}

interface ReviewGridProps {
  days: Weekday[]
  people: DraftPerson[]
  rules: DraftRules
  checks: DraftChecks
  layer: Layer
  nameOf: (_studentId: number) => string
  onCellDown: (_cell: GridCell) => void
  onCellEnter: (_cell: GridCell) => void
}

/** Week (or single-day) grid: people as rows, each desk hour split into two half-hour cells. */
export function ReviewGrid({
  days,
  people,
  rules,
  checks,
  layer,
  nameOf,
  onCellDown,
  onCellEnter,
}: Readonly<ReviewGridProps>) {
  const hours = deskHours(rules)
  const wide = days.length === 1
  const template = {
    gridTemplateColumns: `140px repeat(${days.length}, minmax(0, 1fr)) 112px`,
  }
  const hourTemplate = { gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }
  const minOnDesk = rules.min_on_desk.enabled ? rules.min_on_desk.value : 1

  const coverage = (kind: "all" | "leads") => (
    <div className="grid items-center gap-2.5" style={template}>
      <span className="text-xs font-bold">{kind === "all" ? "On desk" : "Leads"}</span>
      {days.map((day) => (
        <div key={day} className="grid gap-0.5" style={hourTemplate}>
          {hours.map((hour) => {
            const slots = [hour * 2, hour * 2 + 1].filter((slot) => slot < rules.desk_end_slot)
            const value = Math.min(
              ...slots.map((slot) => (kind === "all" ? checks.headcount(day, slot) : checks.leads(day, slot))),
            )
            const noLead = rules.lead_every_slot.enabled && Math.min(...slots.map((s) => checks.leads(day, s))) === 0
            const thin = Math.min(...slots.map((s) => checks.headcount(day, s))) < minOnDesk
            return (
              <span
                key={hour}
                className={cn(
                  "flex h-[22px] items-center justify-center rounded-[5px] font-mono text-[11px] font-semibold",
                  kind === "leads"
                    ? noLead
                      ? "bg-destructive/15 text-destructive"
                      : "bg-accent/10 text-accent"
                    : thin
                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                      : "bg-muted text-foreground",
                )}
              >
                {value}
              </span>
            )
          })}
        </div>
      ))}
      <span />
    </div>
  )

  let lastGroup: string | null = null
  return (
    <div className="overflow-x-auto">
      <div className={cn("flex flex-col gap-[3px] select-none", wide ? "min-w-[760px]" : "min-w-[1080px]")}>
        <div className="grid items-end gap-2.5 pb-1" style={template}>
          <span />
          {days.map((day) => (
            <div key={day} className="flex flex-col gap-1">
              <span className="text-[13px] font-bold">{DAY_SHORT[day]}</span>
              <div className="grid gap-0.5" style={hourTemplate}>
                {hours.map((hour) => (
                  <span key={hour} className="text-center font-mono text-[11px] tracking-[-0.03em] text-muted-foreground">
                    {hourShort(hour)}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <span className="flex flex-col items-end text-[11px] leading-tight">
            <span className="font-bold">{wide ? "Week total" : "Scheduled"}</span>
            <span className="text-muted-foreground">vs. requested</span>
          </span>
        </div>

        {coverage("all")}
        {rules.lead_every_slot.enabled ? coverage("leads") : null}

        {people.map((person) => {
          const head = person.group !== lastGroup ? GROUP_LABEL[person.group] : null
          lastGroup = person.group
          return (
            <div key={person.student_assistant_id} className="flex flex-col">
              {head ? (
                <span className="pt-2.5 pb-1 text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                  {head}
                </span>
              ) : null}
              <PersonRow
                person={person}
                name={nameOf(person.student_assistant_id)}
                days={days}
                hours={hours}
                deskEnd={rules.desk_end_slot}
                layer={layer}
                tall={wide}
                onCellDown={onCellDown}
                onCellEnter={onCellEnter}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PersonRow = memo(function PersonRow({
  person,
  name,
  days,
  hours,
  deskEnd,
  layer,
  tall,
  onCellDown,
  onCellEnter,
}: Readonly<{
  person: DraftPerson
  name: string
  days: Weekday[]
  hours: number[]
  deskEnd: number
  layer: Layer
  tall: boolean
  onCellDown: (_cell: GridCell) => void
  onCellEnter: (_cell: GridCell) => void
}>) {
  const template = { gridTemplateColumns: `140px repeat(${days.length}, minmax(0, 1fr)) 112px` }
  const hourTemplate = { gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }
  const studentId = person.student_assistant_id
  const total = assignedHours(person)
  const dayHours = tall ? assignedHours(person, days) : null

  return (
    <div className="grid items-center gap-2.5 py-px" style={template}>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[13px] font-semibold">{name}</span>
        {dayHours != null && dayHours > 0 ? (
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{dayHours}h</span>
        ) : null}
      </span>
      {days.map((day) => (
        <div key={day} className="grid gap-0.5" style={hourTemplate}>
          {hours.map((hour) => (
            <div key={hour} className={cn("flex overflow-hidden rounded-[5px]", tall ? "h-7" : "h-5")}>
              {[hour * 2, hour * 2 + 1]
                .filter((slot) => slot < deskEnd)
                .map((slot) => {
                  const role = roleAt(person, day, slot)
                  const open = isAvailable(person, day, slot)
                  const cell = { studentId, day, slot }
                  return (
                    <div
                      key={slot}
                      title={`${name} · ${DAY_SHORT[day]} ${slotRange(slot, slot + 1)}${role ? ` · ${ROLE_LABEL[role]}` : open ? " · available" : ""}`}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        onCellDown(cell)
                      }}
                      onMouseEnter={() => onCellEnter(cell)}
                      className={cn(
                        "h-full flex-1",
                        role
                          ? cn(ROLE_BG[role], layer === "availability" && "opacity-40")
                          : open
                            ? "bg-avail"
                            : "bg-muted/50",
                        layer === "availability" || open || role ? "cursor-crosshair" : "cursor-not-allowed",
                      )}
                    />
                  )
                })}
            </div>
          ))}
        </div>
      ))}
      <HoursBar hours={total} min={person.min_hours} max={person.max_hours} label={requestedLabel(person)} />
    </div>
  )
})
