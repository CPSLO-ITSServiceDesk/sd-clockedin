"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PublishRange } from "@/lib/api/teams-publish"
import type { Term } from "@/lib/api/terms"
import { getOrgLocalDateString } from "@/lib/org-time"
import { currentWeekIndex, termWeeks, type TermWeek } from "@/lib/schedule-builder/live-schedule"
import { cn } from "@/lib/utils"

export interface WeekSpan {
  from: number
  to: number
}

const short = (date: string) => format(parseISO(date), "MMM d")

/** Weeks that can still change: the current week onward (or the whole term if it hasn't started). */
export function useTermWeeks(term: Pick<Term, "start_date" | "end_date">) {
  return useMemo(() => {
    const weeks = termWeeks(term)
    const today = getOrgLocalDateString()
    const started = Boolean(term.start_date && today >= term.start_date)
    return { weeks, today, firstOpen: started ? currentWeekIndex(weeks, today) : 0 }
  }, [term])
}

/**
 * Concrete dates for a week span, clipped to the term and never before today,
 * so past days (already worked) are left alone.
 */
export function spanToRange(span: WeekSpan, weeks: TermWeek[], term: Pick<Term, "start_date" | "end_date">, today: string): PublishRange | null {
  const first = weeks[span.from]
  const last = weeks[span.to]
  if (!first || !last || !term.start_date || !term.end_date) return null
  const candidates = [first.monday, term.start_date, today].sort()
  const fromDate = candidates[candidates.length - 1]
  const toDate = [last.dates[4], term.end_date].sort()[0]
  return fromDate <= toDate ? { fromDate, toDate } : null
}

/** "From week of / Through week of" picker with presets and a week strip (14.4 and 14.5). */
export function WeekRangePicker({
  term,
  value,
  onChange,
}: Readonly<{
  term: Term
  value: WeekSpan
  onChange: (_span: WeekSpan) => void
}>) {
  const { weeks, today, firstOpen } = useTermWeeks(term)
  const last = weeks.length - 1
  if (weeks.length === 0) {
    return <span className="text-xs text-muted-foreground">Set the term&apos;s start and end dates in Terms first.</span>
  }

  const presets: { label: string; span: WeekSpan }[] = [
    ...(firstOpen === 0 ? [{ label: "Whole term", span: { from: 0, to: last } }] : []),
    { label: "This week only", span: { from: firstOpen, to: firstOpen } },
    { label: "Next 2 weeks", span: { from: firstOpen, to: Math.min(last, firstOpen + 1) } },
    ...(firstOpen > 0 ? [{ label: "Rest of term", span: { from: firstOpen, to: last } }] : []),
  ]
  const count = value.to - value.from + 1
  const range = spanToRange(value, weeks, term, today)
  const returns = weeks[value.to + 1]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-bold">When it applies</span>
        <span className="font-mono text-xs font-semibold text-accent">
          {count} {count === 1 ? "week" : "weeks"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["from", "From week of"],
            ["to", "Through week of"],
          ] as const
        ).map(([field, label]) => (
          <label key={field} className="flex flex-col gap-[3px]">
            <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
            <Select
              value={String(value[field])}
              onValueChange={(next) => {
                const index = Number(next)
                onChange(
                  field === "from"
                    ? { from: index, to: Math.max(index, value.to) }
                    : { from: Math.min(value.from, index), to: index },
                )
              }}
            >
              <SelectTrigger className="h-9 rounded-[10px] font-mono text-[13px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((week) => (
                  <SelectItem
                    key={week.monday}
                    value={String(week.index)}
                    disabled={week.index < firstOpen || (field === "to" && week.index < value.from)}
                  >
                    {short(week.monday)}
                    {week.index === firstOpen && firstOpen > 0 ? " (now)" : ""}
                    {week.index === last ? " (end)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ))}
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((week) => {
          const past = week.index < firstOpen
          const inRange = week.index >= value.from && week.index <= value.to
          return (
            <button
              key={week.monday}
              type="button"
              disabled={past}
              title={`Week of ${short(week.monday)}${past ? " · already worked" : ""}`}
              onClick={() =>
                onChange(week.index < value.from ? { from: week.index, to: value.to } : { from: value.from, to: week.index })
              }
              className={cn(
                "flex h-[30px] flex-col items-center justify-center rounded-[7px] font-mono text-[10px] leading-[1.1] font-bold",
                past
                  ? "cursor-not-allowed bg-muted text-muted-foreground/50"
                  : inRange
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent/10 text-accent hover:bg-accent/20",
              )}
            >
              <span>W{week.index + 1}</span>
              <span className="font-medium opacity-80">{format(parseISO(week.monday), "M/d")}</span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const on = preset.span.from === value.from && preset.span.to === value.to
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.span)}
              className={cn(
                "h-[26px] rounded-full border px-2.5 text-[11px] font-bold",
                on ? "border-accent bg-accent/10 text-accent" : "border-border bg-card hover:bg-muted",
              )}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
      {range ? (
        <span className="text-xs leading-[1.45] text-muted-foreground">
          {format(parseISO(range.fromDate), "EEE MMM d")} through {format(parseISO(range.toDate), "EEE MMM d")}.{" "}
          {value.to === last
            ? "Replaces the regular schedule for the rest of the term."
            : returns
              ? `The regular schedule returns Mon ${short(returns.monday)}.`
              : ""}{" "}
          Past days and timesheets stay as they were.
        </span>
      ) : null}
    </div>
  )
}
