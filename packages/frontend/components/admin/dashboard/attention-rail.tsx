"use client"

import Link from "next/link"
import type React from "react"

import type { TeamsSyncStatus } from "@/lib/api/teams-sync"
import type { UpcomingTimeOff } from "@/lib/api/today-shifts"
import { toOrgWallClockMinutes } from "@/lib/org-time"
import {
  formatTimeOffWhen,
  isTimeOffActive,
} from "@/lib/shifts/dashboard-timeline"
import { formatTime } from "@/lib/format-time"
import {
  formatShiftName,
  getShiftInitials,
  type TodayShift,
} from "@/lib/shifts/today-shifts"
import { cn } from "@/lib/utils"

type AttentionTone = "absent" | "late" | "info"

interface AttentionItem {
  key: string
  tone: AttentionTone
  title: string
  sub: string
  cta: string
  href: string
}

const TONE_CLASSES: Record<AttentionTone, { bg: string; dot: string }> = {
  absent: { bg: "bg-destructive/10", dot: "bg-destructive" },
  late: { bg: "bg-[var(--status-pending)]/15", dot: "bg-[var(--status-pending)]" },
  info: { bg: "bg-sky-500/10", dot: "bg-sky-500" },
}

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ")
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`
}

function formatAgo(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h ago` : `${hours}h ${rest}m ago`
}

function minutesLate(shift: TodayShift): number | null {
  if (!shift.clockInActual) return null
  const diff = toOrgWallClockMinutes(shift.clockInActual) - toOrgWallClockMinutes(shift.startTime)
  return Number.isNaN(diff) ? null : Math.max(0, diff)
}

function byStartThenFirstName(a: TodayShift, b: TodayShift): number {
  return a.startTime.localeCompare(b.startTime) || a.firstName.localeCompare(b.firstName)
}

export function buildAttentionItems(
  shifts: TodayShift[],
  syncStatus: TeamsSyncStatus | undefined,
  nowMinutes: number,
): AttentionItem[] {
  const items: AttentionItem[] = []
  // Remote staff don't clock in, so they never count as absent or late.
  const inPerson = shifts.filter((shift) => !shift.isRemote)

  const absent = inPerson
    .filter((shift) => shift.status === "absent")
    .sort(byStartThenFirstName)
  if (absent.length === 1) {
    const [shift] = absent
    const since = nowMinutes - toOrgWallClockMinutes(shift.startTime)
    items.push({
      key: "absent",
      tone: "absent",
      title: `${formatShiftName(shift)} hasn't clocked in`,
      sub: `Scheduled ${formatTime(shift.startTime)}${Number.isNaN(since) ? "" : ` · ${formatAgo(since)}`}`,
      cta: "Details",
      href: "/admin/shifts",
    })
  } else if (absent.length > 1) {
    items.push({
      key: "absent",
      tone: "absent",
      title: `${absent.length} people haven't clocked in`,
      sub: joinNames(absent.map((shift) => shift.firstName)),
      cta: "Details",
      href: "/admin/shifts",
    })
  }

  const late = inPerson
    .filter((shift) => shift.status === "late")
    .sort(byStartThenFirstName)
  if (late.length > 0) {
    const lateBy = late.map(minutesLate).filter((value): value is number => value !== null)
    items.push({
      key: "late",
      tone: "late",
      title:
        late.length > 3
          ? `${late.length} people arrived late`
          : `${joinNames(late.map((shift) => shift.firstName))} arrived late`,
      sub:
        lateBy.length > 0 && late.length <= 3
          ? `${joinNames(lateBy.map(String))} min after start`
          : "After the grace window",
      cta: "Details",
      href: "/admin/shifts",
    })
  }

  if (syncStatus?.status === "error") {
    items.push({
      key: "sync",
      tone: "info",
      title: "Teams Shifts sync failed",
      sub: syncStatus.error_message ?? "Schedules and time off may be out of date",
      cta: "Open terms",
      href: "/admin/terms",
    })
  }

  return items
}

function Panel({
  title,
  aside,
  children,
}: Readonly<{ title: string; aside?: React.ReactNode; children: React.ReactNode }>) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-[18px]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function NeedsAttentionCard({
  items,
  isLoading,
}: Readonly<{ items: AttentionItem[]; isLoading: boolean }>) {
  return (
    <Panel title="Needs attention">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-accent/10 p-2.5 text-sm text-muted-foreground">
          All clear. Everyone scheduled so far has clocked in on time.
        </p>
      ) : (
        items.map((item) => (
          <div
            key={item.key}
            className={cn("flex items-start gap-2.5 rounded-xl p-2.5", TONE_CLASSES[item.tone].bg)}
          >
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_CLASSES[item.tone].dot)} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.sub}</span>
            </div>
            <Link
              href={item.href}
              className="flex h-7 shrink-0 items-center rounded-full border border-border bg-card px-2.5 text-xs font-semibold hover:bg-muted"
            >
              {item.cta}
            </Link>
          </div>
        ))
      )}
    </Panel>
  )
}

export function TimeOffCard({
  entries,
  now,
}: Readonly<{ entries: UpcomingTimeOff[]; now: Date }>) {
  return (
    <Panel
      title="Time off"
      aside={<span className="text-xs text-muted-foreground">from Teams Shifts</span>}
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No time off today or in the next two weeks.</p>
      ) : (
        entries.map((entry) => {
          const active = isTimeOffActive(entry, now)
          const ended = Date.parse(entry.endsAt) <= now.getTime()
          return (
            <div
              key={`${entry.studentAssistantId}-${entry.startsAt}`}
              className="flex items-center gap-2.5"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-sky-500/60 text-[11px] font-bold text-accent">
                {getShiftInitials(entry)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-semibold">{formatShiftName(entry)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatTimeOffWhen(entry, now)}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </span>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  active
                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {active ? "Now" : ended ? "Ended" : "Upcoming"}
              </span>
            </div>
          )
        })
      )}
      <p className="text-xs leading-snug text-muted-foreground">
        Time off is approved in Teams. It removes the shift from expected arrivals and excuses it
        from absence stats.
      </p>
    </Panel>
  )
}
