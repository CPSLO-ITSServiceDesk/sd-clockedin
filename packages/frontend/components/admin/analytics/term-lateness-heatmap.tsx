"use client"

import type { ReactNode } from "react"

import type { LateHeatmapCell } from "@/lib/api/analytics"
import {
  formatDayShort,
  formatHourLabel,
  HEATMAP_DAYS,
} from "@/lib/analytics/term-summary"
import { cn } from "@/lib/utils"

/** Late-rate bands, in percent, matching the legend left to right. */
const SCALE = [
  { below: 3, className: "bg-muted text-muted-foreground" },
  { below: 8, className: "bg-amber-500/20 text-amber-800 dark:text-amber-200" },
  { below: 14, className: "bg-amber-500/45 text-amber-950 dark:text-amber-100" },
  { below: 20, className: "bg-[var(--status-pending)] text-white" },
  { below: Number.POSITIVE_INFINITY, className: "bg-amber-700 text-white" },
]

function scaleClass(rate: number): string {
  return SCALE.find((band) => rate < band.below)?.className ?? SCALE[0].className
}

export function TermLatenessHeatmap({
  cells,
  isLoading,
  error,
}: Readonly<{ cells: LateHeatmapCell[]; isLoading: boolean; error: unknown }>) {
  const hours = cells.map((cell) => cell.hour)
  const columns =
    hours.length > 0
      ? Array.from(
          { length: Math.max(...hours) - Math.min(...hours) + 1 },
          (_, i) => Math.min(...hours) + i,
        )
      : []
  const byKey = new Map(cells.map((cell) => [`${cell.day}-${cell.hour}`, cell]))
  const gridTemplate = { gridTemplateColumns: `40px repeat(${columns.length}, minmax(0, 1fr))` }

  let body: ReactNode
  if (isLoading) {
    body = <p className="py-16 text-center text-sm text-muted-foreground">Loading...</p>
  } else if (error) {
    body = <p className="py-16 text-center text-sm text-destructive">Failed to load lateness patterns</p>
  } else if (columns.length === 0) {
    body = <p className="py-16 text-center text-sm text-muted-foreground">No shifts evaluated yet this term</p>
  } else {
    body = (
      <>
        <div className="grid gap-1" style={gridTemplate}>
          <span />
          {columns.map((hour) => (
            <span key={hour} className="text-center font-mono text-[11px] text-muted-foreground">
              {formatHourLabel(hour)}
            </span>
          ))}
        </div>
        {HEATMAP_DAYS.map((day) => (
          <div key={day} className="grid items-center gap-1" style={gridTemplate}>
            <span className="text-[13px] font-semibold text-muted-foreground">{formatDayShort(day)}</span>
            {columns.map((hour) => {
              const cell = byKey.get(`${day}-${hour}`)
              if (!cell || cell.total === 0) {
                return (
                  <div
                    key={hour}
                    title={`${formatDayShort(day)} ${formatHourLabel(hour, "long")}: no shifts`}
                    className="h-8 rounded-lg border border-dashed border-border"
                  />
                )
              }
              const rate = Math.round((cell.late / cell.total) * 100)
              return (
                <div
                  key={hour}
                  title={`${formatDayShort(day)} ${formatHourLabel(hour, "long")}: ${cell.late} of ${cell.total} late (${rate}%)`}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-lg font-mono text-[11px] font-semibold",
                    scaleClass(rate),
                  )}
                >
                  {rate}%
                </div>
              )
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          0%
          <div className="flex gap-0.5">
            {SCALE.map((band) => (
              <span key={band.below} className={cn("h-2.5 w-5 rounded-[3px]", band.className)} />
            ))}
          </div>
          20%+
        </div>
      </>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-border bg-card px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">When lateness happens</h2>
        <span className="text-xs text-muted-foreground">late rate · weekday × start</span>
      </div>
      {body}
    </section>
  )
}
