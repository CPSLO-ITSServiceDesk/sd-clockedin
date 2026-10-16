"use client"

import { useMemo } from "react"

import {
  buildAttentionItems,
  NeedsAttentionCard,
  TimeOffCard,
} from "@/components/admin/dashboard/attention-rail"
import { ShiftTimeline } from "@/components/admin/dashboard/shift-timeline"
import { useNow } from "@/hooks/use-now"
import { useActiveTermTeamsSyncStatus } from "@/hooks/use-teams-sync"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import type { TeamsSyncStatus } from "@/lib/api/teams-sync"
import { formatTimeAgo } from "@/lib/format-time"
import { getOrgLocalMinutes, ORG_TIMEZONE } from "@/lib/org-time"
import { computeDashboardKpis } from "@/lib/shifts/dashboard-stats"
import {
  buildTimelineRows,
  getTimelineRange,
} from "@/lib/shifts/dashboard-timeline"
import { cn } from "@/lib/utils"

const NOW_TICK_MS = 30_000

function SyncPill({ status, now }: Readonly<{ status: TeamsSyncStatus | undefined; now: Date }>) {
  if (!status?.graph_configured) return null

  let label = "Teams Shifts waiting for first sync"
  let dot = "bg-muted-foreground"
  if (status.status === "error") {
    label = "Teams Shifts sync failed"
    dot = "bg-destructive"
  } else if (status.status === "success" && status.finished_at) {
    label = `Teams Shifts synced ${formatTimeAgo(status.finished_at, now)}`
    dot = "bg-accent"
  }

  return (
    <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-[13px] text-muted-foreground">
      <span className={cn("size-2 rounded-full", dot)} />
      {label}
    </div>
  )
}

export function AdminDashboard() {
  const mountedNow = useNow(NOW_TICK_MS)
  const now = useMemo(() => mountedNow ?? new Date(), [mountedNow])
  const nowMinutes = getOrgLocalMinutes(now)
  const { shifts, timeOffShifts, upcomingTimeOff, isLoading, error } = useTodayShiftList({
    includeRemote: true,
  })
  const { data: syncStatus } = useActiveTermTeamsSyncStatus()

  const rows = useMemo(
    () => buildTimelineRows(shifts, timeOffShifts, nowMinutes),
    [shifts, timeOffShifts, nowMinutes],
  )
  const range = useMemo(() => getTimelineRange(rows), [rows])
  const kpis = computeDashboardKpis(shifts, now)
  const timeOffCount = new Set(timeOffShifts.map((shift) => shift.studentAssistantId)).size
  const attention = buildAttentionItems(shifts, syncStatus, nowMinutes)

  const stats = [
    { value: kpis.onShift, label: "on shift", className: "" },
    { value: kpis.incomingNextTwoHours, label: "incoming", className: "" },
    { value: kpis.late, label: "late", className: kpis.late > 0 ? "text-[var(--status-pending)]" : "" },
    { value: kpis.absent, label: "absent", className: kpis.absent > 0 ? "text-destructive" : "" },
    { value: timeOffCount, label: "time off", className: timeOffCount > 0 ? "text-sky-700 dark:text-sky-300" : "" },
  ]

  const dateLabel = now.toLocaleDateString("en-US", {
    timeZone: ORG_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[28px] font-bold tracking-tight">Today</h1>
            {mountedNow ? (
              <span className="text-[15px] text-muted-foreground">{dateLabel}</span>
            ) : null}
          </div>
          {mountedNow ? <SyncPill status={syncStatus} now={now} /> : null}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-2">
              <span className={cn("font-mono text-[28px] font-semibold tabular-nums", stat.className)}>
                {isLoading ? "—" : stat.value}
              </span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
        <ShiftTimeline
          rows={rows}
          range={range}
          nowMinutes={nowMinutes}
          isLoading={isLoading}
          error={error}
        />
      </div>
      <div className="flex flex-col gap-4">
        <NeedsAttentionCard items={attention} isLoading={isLoading} />
        <TimeOffCard entries={upcomingTimeOff} now={now} />
      </div>
    </div>
  )
}
