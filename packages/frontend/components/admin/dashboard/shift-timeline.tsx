"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import {
  formatHourTick,
  toTimelinePercent,
  type TimelineRange,
  type TimelineRow,
  type TimelineSegment,
} from "@/lib/shifts/dashboard-timeline"

const NAME_COLUMN_CLASS = "grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)] gap-3"

function formatNowLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")}`
}

function scheduledBarClassName(tone: TimelineSegment["tone"]): string {
  switch (tone) {
    case "absent":
      return "bg-destructive/15"
    case "time-off":
      return "border-[1.5px] border-dashed border-sky-500/60 bg-transparent"
    case "scheduled":
      return "bg-accent/25"
  }
}

function SegmentBars({
  segment,
  range,
}: Readonly<{ segment: TimelineSegment; range: TimelineRange }>) {
  const scheduled = segment.scheduled
  const worked = segment.worked
  const scheduledLeft = scheduled ? toTimelinePercent(scheduled.start, range) : null
  const tagLeft = scheduledLeft ?? (worked ? toTimelinePercent(worked.start, range) : 0)

  return (
    <>
      {scheduled ? (
        <div
          className={cn("absolute inset-y-[7px] rounded-full", scheduledBarClassName(segment.tone))}
          style={{
            left: `${scheduledLeft}%`,
            width: `${toTimelinePercent(scheduled.end, range) - (scheduledLeft ?? 0)}%`,
          }}
        />
      ) : null}
      {worked ? (
        <div
          className={cn(
            "absolute inset-y-[7px] rounded-full",
            segment.late ? "bg-[var(--status-pending)]" : "bg-accent",
          )}
          style={{
            left: `${toTimelinePercent(worked.start, range)}%`,
            width: `${toTimelinePercent(worked.end, range) - toTimelinePercent(worked.start, range)}%`,
          }}
        />
      ) : null}
      {segment.tag ? (
        <span
          className={cn(
            "absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold",
            segment.tone === "absent" ? "text-destructive" : "text-sky-700 dark:text-sky-300",
            worked && "text-accent-foreground",
          )}
          style={{ left: `calc(${tagLeft}% + 10px)` }}
        >
          {segment.tag}
        </span>
      ) : null}
    </>
  )
}

export function ShiftTimeline({
  rows,
  range,
  nowMinutes,
  isLoading,
  error,
}: Readonly<{
  rows: TimelineRow[]
  range: TimelineRange
  nowMinutes: number
  isLoading: boolean
  error: unknown
}>) {
  const hours = Array.from(
    { length: range.endHour - range.startHour },
    (_, index) => range.startHour + index,
  )
  const showNow =
    nowMinutes >= range.startHour * 60 && nowMinutes <= range.endHour * 60
  const nowPercent = toTimelinePercent(nowMinutes, range)
  const gridBackground = `repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px calc(100% / ${hours.length}))`

  let body: React.ReactNode
  if (isLoading) {
    body = <p className="py-12 text-center text-sm text-muted-foreground">Loading shifts...</p>
  } else if (error) {
    body = <p className="py-12 text-center text-sm text-destructive">Failed to load today&apos;s shifts</p>
  } else if (rows.length === 0) {
    body = <p className="py-12 text-center text-sm text-muted-foreground">No shifts scheduled for today.</p>
  } else {
    body = (
      <div className="relative flex flex-col gap-1">
        {showNow ? (
          <div
            className={cn(NAME_COLUMN_CLASS, "pointer-events-none absolute inset-x-0 -top-7 bottom-0 z-10")}
            aria-hidden
          >
            <span />
            <div className="relative">
              <div
                className="absolute bottom-0 top-5 w-0.5 -translate-x-1/2 rounded-full bg-accent"
                style={{ left: `${nowPercent}%` }}
              />
              <span
                className="absolute top-0 -translate-x-1/2 rounded-full bg-accent px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent-foreground"
                style={{ left: `${nowPercent}%` }}
              >
                {formatNowLabel(nowMinutes)}
              </span>
            </div>
          </div>
        ) : null}
        {rows.map((row) => (
          <div key={row.studentAssistantId} className={cn(NAME_COLUMN_CLASS, "h-[34px] items-center")}>
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "truncate text-[13px] font-semibold",
                  row.isTimeOff && "text-muted-foreground",
                )}
              >
                {row.name}
              </span>
              {row.isRemote ? (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-bold text-muted-foreground">
                  Remote
                </span>
              ) : null}
            </div>
            <div className="relative h-full" style={{ background: gridBackground }}>
              {row.segments.map((segment) => (
                <SegmentBars key={segment.key} segment={segment} range={range} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card px-4 pb-5 pt-4 sm:px-5">
      <div className={cn(NAME_COLUMN_CLASS, "pb-1.5", showNow && rows.length > 0 && "mb-6")}>
        <span className="text-xs font-semibold text-muted-foreground">Person</span>
        <div
          className="grid font-mono text-xs text-muted-foreground"
          style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}
        >
          {hours.map((hour) => (
            <span key={hour}>{formatHourTick(hour)}</span>
          ))}
        </div>
      </div>
      {body}
      <div className="flex flex-wrap gap-4 pt-2.5 text-xs text-muted-foreground">
        <LegendSwatch className="bg-accent/25" label="Scheduled" />
        <LegendSwatch className="bg-accent" label="Worked" />
        <LegendSwatch className="bg-[var(--status-pending)]" label="Late" />
        <LegendSwatch className="bg-destructive/15" label="Absent" />
        <LegendSwatch className="border-[1.5px] border-dashed border-sky-500/60" label="Time off" />
      </div>
    </div>
  )
}

function LegendSwatch({ className, label }: Readonly<{ className: string; label: string }>) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-[18px] rounded-full", className)} />
      {label}
    </span>
  )
}
