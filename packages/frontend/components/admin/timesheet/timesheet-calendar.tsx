"use client"

import type { TimesheetDay } from "@/lib/api/timesheet"
import {
  buildMonthWeeks,
  formatCellDate,
  formatHours,
  formatSignedHours,
} from "@/lib/timesheet/month-calendar"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const GRID =
  "grid grid-cols-[minmax(0,0.55fr)_repeat(5,minmax(0,1fr))_minmax(0,0.55fr)_64px] sm:grid-cols-[minmax(0,0.55fr)_repeat(5,minmax(0,1fr))_minmax(0,0.55fr)_84px]"

interface CellView {
  hours: string
  sub: string
  tone: string
  subTone: string
  background: string
  dashed?: boolean
}

function cellView(day: TimesheetDay): CellView {
  const base = {
    hours: formatHours(day.workedHours),
    sub: day.scheduledHours > 0 ? `of ${formatHours(day.scheduledHours)}` : "",
    tone: "text-foreground",
    subTone: "text-muted-foreground",
    background: "bg-card",
  }
  const amber = "text-amber-700 dark:text-amber-300"

  switch (day.status) {
    case "off":
      return {
        ...base,
        tone: amber,
        subTone: amber,
        sub: `${formatSignedHours(day.workedHours - day.scheduledHours)} vs ${formatHours(day.scheduledHours)}`,
        background: "bg-amber-500/5",
      }
    case "absent":
      return { ...base, hours: "0.0", sub: "Absent", tone: "text-destructive", subTone: "text-destructive", background: "bg-destructive/5" }
    case "open":
      return { ...base, hours: "—", sub: "No clock-out", tone: amber, subTone: amber, background: "bg-amber-500/5" }
    case "unscheduled":
      return { ...base, sub: "Unscheduled", tone: amber, subTone: amber, background: "bg-amber-500/5" }
    case "excused":
      return {
        ...base,
        hours: "—",
        sub: "Excused",
        tone: "text-sky-800 dark:text-sky-200",
        subTone: "text-sky-800 dark:text-sky-200",
        background: "bg-sky-500/5",
        dashed: true,
      }
    case "remote":
      return { ...base, hours: "—", sub: "Remote", subTone: "text-muted-foreground" }
    case "upcoming":
      return {
        ...base,
        hours: "",
        sub: day.scheduledHours > 0 ? `${formatHours(day.scheduledHours)}h scheduled` : day.remoteHours > 0 ? "Remote" : "",
      }
    case "in-progress":
      return { ...base, sub: "Today" }
    default:
      return base
  }
}

export function TimesheetCalendar({
  month,
  days,
  selectedDate,
  onSelectDate,
}: Readonly<{
  month: string
  days: TimesheetDay[]
  selectedDate: string | null
  onSelectDate: (_date: string) => void
}>) {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const weeks = buildMonthWeeks(month)

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className={cn(GRID, "border-b border-border bg-muted/40")}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="px-2.5 py-2 text-xs font-semibold text-muted-foreground">
            {label}
          </span>
        ))}
        <span className="px-3 py-2 text-right text-xs font-semibold text-accent">Week</span>
      </div>

      {weeks.map((week, weekIndex) => {
        const weekDays = week.flatMap((date) => (date && byDate.get(date)) || [])
        const worked = weekDays.reduce((sum, day) => sum + day.workedHours, 0)
        const scheduled = weekDays
          .filter((day) => day.status !== "upcoming" && day.status !== "in-progress")
          .reduce((sum, day) => sum + day.scheduledHours, 0)

        return (
          <div key={weekIndex} className={cn(GRID, "border-b border-border/60 last:border-0")}>
            {week.map((date, dayIndex) => {
              const weekend = dayIndex === 0 || dayIndex === 6
              if (!date) {
                return <div key={dayIndex} className="min-h-[78px] border-r border-border/60 bg-muted/40" />
              }
              const day = byDate.get(date)
              const view = day ? cellView(day) : null
              const selected = date === selectedDate
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => onSelectDate(date)}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-h-[78px] min-w-0 flex-col gap-1 border-r border-border/60 px-2.5 py-2 text-left transition-colors hover:bg-muted/50",
                    view?.background ?? (weekend ? "bg-muted/20" : "bg-card"),
                    selected && "shadow-[inset_0_0_0_2px_var(--accent)]",
                  )}
                >
                  <span className="truncate font-mono text-[11px] text-muted-foreground">{formatCellDate(date)}</span>
                  {view ? (
                    <>
                      <span className={cn("font-mono text-lg font-semibold leading-tight", view.tone)}>
                        {view.hours}
                      </span>
                      {view.sub ? (
                        <span
                          className={cn(
                            "self-start truncate text-[11px] font-semibold",
                            view.subTone,
                            view.dashed && "rounded-full border-[1.5px] border-dashed border-sky-400 px-1.5",
                          )}
                        >
                          {view.sub}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </button>
              )
            })}
            <div className="flex flex-col items-end justify-center bg-muted/40 px-3 py-2">
              <span className="font-mono text-base font-semibold text-accent">{formatHours(worked)}</span>
              <span className="font-mono text-[11px] text-muted-foreground">of {formatHours(scheduled)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
