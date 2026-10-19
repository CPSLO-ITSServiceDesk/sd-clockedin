"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"

import { Panel, Pill, Segmented } from "@/components/admin/schedule-builder/builder-ui"
import { ROLE_BG, ReviewGrid, type GridCell, type Layer } from "@/components/admin/schedule-builder/review-grid"
import type { BuilderContext } from "@/components/admin/schedule-builder/schedule-builder"
import type { Weekday } from "@/components/admin/terms/term-types"
import { usePaintStroke } from "@/hooks/use-paint-stroke"
import type { DraftPerson, ShiftRole } from "@/lib/api/schedule-drafts"
import {
  DAY_SHORT,
  ROLE_LABEL,
  WEEKDAYS,
  assignedHours,
  computeChecks,
  hoursLabel,
  isAvailable,
  roleAt,
  setAvailable,
  setRole,
  slotRange,
  summarizeCells,
  toRuns,
} from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

type Brush = ShiftRole | "erase"
type View = "week" | "day"

/** What one drag does: paint a role, erase, or open/close availability. */
type StrokeMode = { kind: "role"; role: ShiftRole | null } | { kind: "availability"; open: boolean }

const BRUSHES: { value: Brush; label: string }[] = [
  { value: "L", label: "Lead" },
  { value: "m", label: "Main" },
  { value: "t", label: "Training" },
  { value: "erase", label: "Erase" },
]

const LOG_PREVIEW = 8

function describeStroke(name: string, cells: GridCell[], mode: StrokeMode): string {
  const byDay = new Map<Weekday, number[]>()
  for (const cell of cells) byDay.set(cell.day, [...(byDay.get(cell.day) ?? []), cell.slot])
  const where = [...byDay.entries()]
    .map(([day, slots]) =>
      toRuns(slots)
        .map(([start, end]) => `${DAY_SHORT[day]} ${slotRange(start, end)}`)
        .join(", "),
    )
    .join("; ")
  if (mode.kind === "availability") return `${name}: ${mode.open ? "opened" : "closed"} ${where}`
  return mode.role ? `${name}: ${where} → ${ROLE_LABEL[mode.role]}` : `${name}: removed ${where}`
}

export function StepReview(context: Readonly<BuilderContext>) {
  const { draft, people, nameOf, edit, log, goTo } = context
  const [view, setView] = useState<View>("week")
  const [day, setDay] = useState<Weekday>("monday")
  const [layer, setLayer] = useState<Layer>("shifts")
  const [brush, setBrush] = useState<Brush>("m")

  const visible = useMemo(
    () => people.filter((person) => person.responded || assignedHours(person) > 0 || person.group === "lead"),
    [people],
  )
  const checks = useMemo(() => computeChecks(draft.people, draft.rules), [draft.people, draft.rules])

  // Read the latest person inside paint callbacks without re-creating them per edit.
  const peopleRef = useRef(draft.people)
  peopleRef.current = draft.people
  const personById = (studentId: number) => peopleRef.current.find((p) => p.student_assistant_id === studentId)

  const applyCell = useCallback(
    (cell: GridCell, mode: StrokeMode) => {
      edit((current) => ({
        ...current,
        people: current.people.map((person) => {
          if (person.student_assistant_id !== cell.studentId) return person
          if (mode.kind === "availability") return setAvailable(person, cell.day, [cell.slot], mode.open)
          // Shifts only go where the person is available; open hours in the Availability layer first.
          if (mode.role && !isAvailable(person, cell.day, cell.slot)) return person
          return setRole(person, cell.day, [cell.slot], mode.role)
        }),
      }))
    },
    [edit],
  )

  const paint = usePaintStroke<GridCell, StrokeMode>({
    onPaint: applyCell,
    sameStroke: (first, next) => first.studentId === next.studentId,
    onFinish: (cells, mode) => log(describeStroke(nameOf(cells[0].studentId), cells, mode)),
  })

  const onCellDown = useCallback(
    (cell: GridCell) => {
      const person = personById(cell.studentId)
      if (!person) return
      if (layer === "availability") {
        paint.start(cell, { kind: "availability", open: !isAvailable(person, cell.day, cell.slot) })
        return
      }
      const current = roleAt(person, cell.day, cell.slot)
      // Starting on a cell that already has the brush's role erases instead.
      const role = brush === "erase" || current === brush ? null : brush
      paint.start(cell, { kind: "role", role })
    },
    // personById reads a ref, so it's safe to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layer, brush, paint],
  )

  const total = checks.totalHours
  const budget = draft.rules.weekly_budget
  const recent = [...draft.change_log].reverse().slice(0, LOG_PREVIEW)
  const lastGenerated = draft.change_log.map((entry) => entry.by).lastIndexOf("builder")
  const sinceDraft = draft.change_log.length - lastGenerated - 1

  const dayCount = (weekday: Weekday) => visible.filter((person) => assignedHours(person, [weekday]) > 0).length

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={checks.noLead.length ? "warn" : "good"}>
            {checks.noLead.length ? `${checks.noLead.length / 2}h without a lead` : "Lead every hour"}
          </Pill>
          <Pill tone={checks.thin.length ? "warn" : "good"}>
            {checks.thin.length ? `${checks.thin.length / 2} thin hours` : "No thin hours"}
          </Pill>
          <Pill tone={checks.outOfRange.length ? "warn" : "good"}>
            {checks.outOfRange.length ? `${checks.outOfRange.length} outside requested hours` : "Everyone in range"}
          </Pill>
          <Pill tone={checks.overBudget ? "warn" : "muted"}>
            {hoursLabel(total)}
            {budget.enabled ? ` of ${budget.hours}h` : " scheduled"}
          </Pill>
          {checks.shortShifts > 0 ? <Pill tone="warn">{checks.shortShifts} short shifts</Pill> : null}
          {checks.traineesAlone.length > 0 ? (
            <Pill tone="warn">{checks.traineesAlone.length / 2}h training without a lead</Pill>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            options={[
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
            ]}
            value={view}
            onChange={setView}
          />
          <span className="hidden h-[22px] w-px bg-border sm:block" />
          <Segmented
            options={[
              { value: "shifts", label: "Shifts" },
              { value: "availability", label: "Availability" },
            ]}
            value={layer}
            onChange={setLayer}
          />
          {layer === "shifts" ? (
            <Segmented
              options={BRUSHES.map((option) => ({
                value: option.value,
                label: (
                  <>
                    <span
                      className={cn(
                        "size-3 rounded-[3px]",
                        option.value === "erase" ? "border border-border bg-card" : ROLE_BG[option.value],
                      )}
                    />
                    {option.label}
                  </>
                ),
              }))}
              value={brush}
              onChange={setBrush}
            />
          ) : (
            <span className="rounded-full bg-amber-500/15 px-3 py-[7px] text-xs font-semibold text-amber-800 dark:text-amber-200">
              Drag to open or close hours · closing removes shifts in them
            </span>
          )}
        </div>
      </div>

      {view === "day" ? (
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((weekday) => (
            <button
              key={weekday}
              type="button"
              aria-pressed={day === weekday}
              onClick={() => setDay(weekday)}
              className={cn(
                "flex min-w-[110px] flex-col items-start gap-px rounded-[14px] border border-border px-4 py-2",
                day === weekday ? "bg-accent/10" : "bg-card hover:bg-muted/50",
              )}
            >
              <span className={cn("text-sm font-bold", day === weekday && "text-accent")}>{DAY_SHORT[weekday]}</span>
              <span className="text-xs font-semibold text-muted-foreground">{dayCount(weekday)} on desk</span>
            </button>
          ))}
        </div>
      ) : null}

      <Panel className="px-4 py-3.5">
        <ReviewGrid
          days={view === "day" ? [day] : WEEKDAYS}
          people={visible}
          rules={draft.rules}
          checks={checks}
          layer={layer}
          nameOf={nameOf}
          onCellDown={onCellDown}
          onCellEnter={paint.enter}
        />
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 pt-3 text-xs text-muted-foreground">
          <Legend className="bg-avail" label="Available" />
          <Legend className="bg-role-lead" label="Lead" />
          <Legend className="bg-role-main" label="Main" />
          <Legend className="bg-role-training" label="Training" />
          <Legend className="h-1 rounded-full bg-accent/25" label="Requested range" />
          <span className="flex-1" />
          <span>
            {layer === "shifts"
              ? "Drag along a row to paint. Start on a cell that already has the brush's role to erase."
              : "Edits override the imported form for this term."}
          </span>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <IssuesPanel context={context} checks={checks} />
        <Panel className="flex flex-col gap-2.5 px-[18px] py-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Changes</span>
            <span className="text-xs text-muted-foreground">{sinceDraft} since the draft</span>
          </div>
          {recent.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">No changes yet. Paint cells to adjust.</span>
          ) : (
            recent.map((entry) => (
              <div key={`${entry.at}-${entry.text}`} className="flex items-start gap-2.5 text-[13px]">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    entry.by === "you" ? "bg-role-main" : entry.by === "builder" ? "bg-role-lead" : "bg-role-training",
                  )}
                />
                <span className="flex-1 leading-[1.4]">{entry.text}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {entry.by === "you" ? "You" : entry.by === "builder" ? "Builder" : "Import"}
                </span>
              </div>
            ))
          )}
          <div className="flex-1" />
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={() => goTo(2)} className="text-[13px] font-semibold text-accent hover:underline">
              Back
            </button>
            <button
              type="button"
              onClick={() => goTo(4)}
              className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              Review and publish
              <ArrowRight className="size-[15px]" strokeWidth={2.25} />
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function IssuesPanel({
  context,
  checks,
}: Readonly<{ context: BuilderContext; checks: ReturnType<typeof computeChecks> }>) {
  const { nameOf } = context
  const items: { tone: "warn" | "bad"; text: string }[] = []
  if (checks.noLead.length > 0) {
    items.push({ tone: "bad", text: `No lead: ${summarizeCells(checks.noLead, 4)}` })
  }
  if (checks.thin.length > 0) {
    items.push({ tone: "warn", text: `Under the minimum on desk: ${summarizeCells(checks.thin, 4)}` })
  }
  for (const person of checks.outOfRange.slice(0, 6)) {
    items.push({ tone: "warn", text: outOfRangeText(nameOf(person.student_assistant_id), person) })
  }
  if (checks.outOfRange.length > 6) {
    items.push({ tone: "warn", text: `${checks.outOfRange.length - 6} more people outside their requested hours` })
  }
  if (checks.traineesAlone.length > 0) {
    items.push({ tone: "warn", text: `Training without a lead: ${summarizeCells(checks.traineesAlone, 4)}` })
  }

  return (
    <Panel className="flex flex-col gap-2.5 px-[18px] py-4">
      <span className="text-[15px] font-bold">Needs attention</span>
      {items.length === 0 ? (
        <span className="text-[13px] text-muted-foreground">
          Every rule is met. Paint any tweaks, then review and publish.
        </span>
      ) : (
        items.map((item) => (
          <div key={item.text} className="flex items-start gap-2.5 text-[13px] leading-[1.4]">
            <span
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.tone === "bad" ? "bg-destructive" : "bg-amber-500")}
            />
            {item.text}
          </div>
        ))
      )}
    </Panel>
  )
}

function outOfRangeText(name: string, person: DraftPerson): string {
  const hours = assignedHours(person)
  if (person.min_hours != null && hours < person.min_hours) {
    return `${name} has ${hoursLabel(hours)}, wants at least ${person.min_hours}h`
  }
  return `${name} has ${hoursLabel(hours)}, wants at most ${person.max_hours}h`
}

function Legend({ className, label }: Readonly<{ className: string; label: string }>) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-4 rounded-[3px]", className)} />
      {label}
    </span>
  )
}
