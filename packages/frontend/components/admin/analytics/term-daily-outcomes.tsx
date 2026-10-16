"use client"

import type { ReactNode } from "react"

import type { DailyTrendPoint } from "@/lib/api/analytics"
import { formatShortDate } from "@/lib/analytics/term-summary"
import { cn } from "@/lib/utils"

const SERIES = [
  { key: "punctual", label: "On time", className: "bg-accent" },
  { key: "late", label: "Late", className: "bg-[var(--status-pending)]" },
  { key: "absent", label: "Absent", className: "bg-destructive" },
  { key: "excused", label: "Excused", className: "bg-sky-400/60" },
] as const

const AXIS_LABEL_COUNT = 4

function dayTooltip(point: DailyTrendPoint): string {
  const date = new Date(`${point.date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  })
  return `${date}: ${point.punctual} on time, ${point.late} late, ${point.absent} absent, ${point.excused ?? 0} excused`
}

export function TermDailyOutcomes({
  data,
  isLoading,
  error,
}: Readonly<{ data: DailyTrendPoint[]; isLoading: boolean; error: unknown }>) {
  const totals = data.map((point) => point.punctual + point.late + point.absent + (point.excused ?? 0))
  const max = Math.max(1, ...totals)
  const axisIndexes =
    data.length <= AXIS_LABEL_COUNT
      ? data.map((_, index) => index)
      : Array.from({ length: AXIS_LABEL_COUNT }, (_, i) =>
          Math.round((i * (data.length - 1)) / (AXIS_LABEL_COUNT - 1)),
        )

  let body: ReactNode
  if (isLoading) {
    body = <p className="flex h-[218px] items-center justify-center text-sm text-muted-foreground">Loading...</p>
  } else if (error) {
    body = <p className="flex h-[218px] items-center justify-center text-sm text-destructive">Failed to load daily outcomes</p>
  } else if (data.length === 0) {
    body = <p className="flex h-[218px] items-center justify-center text-sm text-muted-foreground">No shifts evaluated yet this term</p>
  } else {
    body = (
      <>
        <div className={cn("flex h-[218px] items-end", data.length > 50 ? "gap-px" : "gap-[3px]")}>
          {data.map((point, index) => (
            <div
              key={point.date}
              title={dayTooltip(point)}
              className="flex min-w-0 flex-1 flex-col-reverse gap-px overflow-hidden rounded-[3px]"
              style={{ height: `${(totals[index] / max) * 100}%` }}
            >
              {SERIES.map((series) => {
                const value = point[series.key] ?? 0
                return value > 0 ? (
                  <div key={series.key} className={series.className} style={{ flex: value }} />
                ) : null
              })}
            </div>
          ))}
        </div>
        <div className="flex justify-between font-mono text-xs text-muted-foreground">
          {axisIndexes.map((index) => (
            <span key={index}>{formatShortDate(data[index].date)}</span>
          ))}
        </div>
      </>
    )
  }

  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border border-border bg-card px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">Daily outcomes</h2>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {SERIES.map((series) => (
            <span key={series.key} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-[3px]", series.className)} />
              {series.label}
            </span>
          ))}
        </div>
      </div>
      {body}
    </section>
  )
}
