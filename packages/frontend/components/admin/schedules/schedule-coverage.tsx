"use client"

import { formatDayShort } from "@/components/admin/schedules/schedule-utils"
import {
  formatHourShort,
  THIN_COVERAGE_THRESHOLD,
  type CoverageDay,
} from "@/lib/schedules/team-week"
import { cn } from "@/lib/utils"

export const TEAM_WEEK_GRID =
  "grid grid-cols-[minmax(0,1fr)_52px] md:grid-cols-[190px_repeat(5,minmax(0,1fr))_52px] gap-2.5"

export function ScheduleCoverage({ days }: Readonly<{ days: CoverageDay[] }>) {
  return (
    <section className="grid gap-2.5 rounded-[20px] border border-border bg-card px-5 pb-3 pt-4 md:grid-cols-[190px_repeat(5,minmax(0,1fr))_52px] md:items-end">
      <div className="flex flex-col gap-0.5 pb-1">
        <span className="text-sm font-bold">In-person coverage</span>
        <span className="text-xs text-muted-foreground">
          people per hour ·{" "}
          <span className="font-semibold text-amber-700 dark:text-amber-300">
            under {THIN_COVERAGE_THRESHOLD}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2.5 md:contents">
        {days.map((day) => (
          <div key={day.day} className="flex min-w-0 flex-col gap-1.5">
            <div className="flex h-[54px] items-end gap-0.5">
              {day.hours.map((hour) => (
                <div
                  key={hour.hour}
                  title={`${formatDayShort(day.day)} ${formatHourShort(hour.hour)}: ${hour.count} in person`}
                  className={cn(
                    "min-h-[3px] flex-1 rounded-t-[3px] rounded-b-[1px]",
                    hour.thin ? "bg-[var(--status-pending)]" : "bg-accent",
                  )}
                  style={{ height: `${hour.height}%` }}
                />
              ))}
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-bold">{formatDayShort(day.day)}</span>
              <span
                className={cn(
                  "font-mono text-[11px]",
                  day.thinCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                )}
              >
                {day.thinCount > 0 ? `${day.thinCount} thin` : "ok"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
