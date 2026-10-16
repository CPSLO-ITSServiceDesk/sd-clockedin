"use client"

import { formatStudentName } from "@/components/admin/mock-students"
import { TEAM_WEEK_GRID } from "@/components/admin/schedules/schedule-coverage"
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  SCHEDULE_WEEKDAYS,
  type DraftScheduleBlock,
} from "@/components/admin/schedules/schedule-types"
import {
  formatDayShort,
  formatWeeklyHours,
  totalWeeklyHours,
} from "@/components/admin/schedules/schedule-utils"
import { getAvatarToneClass } from "@/lib/avatar-tones"
import type { ScheduleStudent } from "@/lib/api/schedule-mappers"
import { formatTimeRange } from "@/lib/format-time"
import { buildTrackBars, formatHourShort } from "@/lib/schedules/team-week"
import { cn } from "@/lib/utils"

export const REMOTE_PATTERN =
  "repeating-linear-gradient(45deg, var(--muted-foreground) 0 2px, var(--border) 2px 4px)"

const TRACK_GRIDLINES = `repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px calc(100% / ${GRID_END_HOUR - GRID_START_HOUR}))`

export interface TeamWeekRow {
  student: ScheduleStudent
  blocks: DraftScheduleBlock[]
  unsaved: boolean
}

function initials(student: ScheduleStudent): string {
  return `${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toUpperCase()
}

export function TeamWeekTable({
  rows,
  selectedId,
  onSelect,
}: Readonly<{
  rows: TeamWeekRow[]
  selectedId: number | null
  onSelect: (_student: ScheduleStudent) => void
}>) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-card">
      <div
        className={cn(
          TEAM_WEEK_GRID,
          "border-b border-border/60 px-5 py-2.5 text-xs font-semibold text-muted-foreground",
        )}
      >
        <span>Student</span>
        {SCHEDULE_WEEKDAYS.map((weekday) => (
          <span key={weekday.value} className="hidden justify-between md:flex">
            <span>{formatDayShort(weekday.value)}</span>
            <span className="font-mono font-medium">
              {formatHourShort(GRID_START_HOUR)} · {formatHourShort(GRID_END_HOUR)}
            </span>
          </span>
        ))}
        <span className="text-right">Hrs</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">No students match these filters.</p>
      ) : (
        rows.map(({ student, blocks, unsaved }) => {
          const hours = totalWeeklyHours(blocks)
          const selected = student.id === selectedId
          return (
            <button
              key={student.id}
              type="button"
              onClick={() => onSelect(student)}
              aria-pressed={selected}
              className={cn(
                TEAM_WEEK_GRID,
                "w-full items-center border-b border-border/60 px-5 py-[7px] text-left last:border-0",
                selected ? "bg-accent/5 shadow-[inset_3px_0_0_var(--accent)]" : "hover:bg-muted/40",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    selected ? "bg-accent text-accent-foreground" : getAvatarToneClass(student.id),
                  )}
                >
                  {initials(student)}
                </span>
                <span className="truncate text-[13px] font-semibold">{formatStudentName(student)}</span>
                {student.role === "Student Lead" ? (
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] font-bold text-amber-800 dark:text-amber-200">
                    Lead
                  </span>
                ) : null}
                {unsaved ? (
                  <span
                    title="Unsaved changes"
                    className="size-1.5 shrink-0 rounded-full bg-[var(--status-pending)]"
                  />
                ) : null}
              </span>
              {SCHEDULE_WEEKDAYS.map((weekday) => (
                <span
                  key={weekday.value}
                  className="relative hidden h-[22px] rounded-md bg-muted/50 md:block"
                  style={{ backgroundImage: TRACK_GRIDLINES }}
                >
                  {buildTrackBars(blocks, weekday.value, formatTimeRange).map((bar) => (
                    <span
                      key={bar.left}
                      title={`${weekday.label} ${bar.label}`}
                      className={cn("absolute inset-y-[3px] rounded", !bar.isRemote && "bg-accent")}
                      style={{
                        left: `${bar.left}%`,
                        width: `${bar.width}%`,
                        ...(bar.isRemote ? { backgroundImage: REMOTE_PATTERN } : null),
                      }}
                    />
                  ))}
                </span>
              ))}
              <span
                className={cn(
                  "text-right font-mono text-[13px] font-semibold",
                  hours === 0 && "text-destructive",
                )}
              >
                {hours > 0 ? formatWeeklyHours(hours) : "—"}
              </span>
            </button>
          )
        })
      )}

      <div className="flex gap-4 px-5 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-[18px] rounded-[3px] bg-accent" />
          In person
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-[18px] rounded-[3px]" style={{ backgroundImage: REMOTE_PATTERN }} />
          Remote
        </span>
      </div>
    </section>
  )
}
