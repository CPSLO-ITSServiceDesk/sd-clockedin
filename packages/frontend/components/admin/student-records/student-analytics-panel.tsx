"use client"

import type { StudentAnalytics, StudentLateShift } from "@/lib/api/analytics"
import { formatStartTimeHeader, formatTime } from "@/lib/format-time"
import { cn } from "@/lib/utils"

interface StudentAnalyticsPanelProps {
  analytics: StudentAnalytics | undefined
  isLoading: boolean
  error: Error | null
}

const ISSUE_STYLES: Record<StudentLateShift["status"], { label: string; className: string }> = {
  late: {
    label: "Late",
    className: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  },
  absent: { label: "Absent", className: "bg-destructive/15 text-destructive" },
  unscheduled: { label: "Unscheduled", className: "bg-muted text-foreground" },
}

function formatIssueDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function formatWeekday(day: string): string {
  return day.slice(0, 3).replace(/^./, (char) => char.toUpperCase())
}

function issueDetail(issue: StudentLateShift): string {
  if (issue.status === "unscheduled") {
    return issue.clockIn
      ? `Clocked in ${formatTime(issue.clockIn)}, no shift scheduled`
      : "Unmatched clock-in"
  }
  const range = `${formatStartTimeHeader(issue.startTime)} – ${formatStartTimeHeader(issue.endTime)}`
  if (issue.status === "absent") return `${range} · no clock-in`
  return issue.clockIn ? `${range} · in ${formatTime(issue.clockIn)}` : range
}

function Message({ children, tone }: { children: string; tone?: "error" }) {
  return (
    <p
      className={cn(
        "px-[22px] py-10 text-center text-sm",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  )
}

export function StudentAnalyticsPanel({
  analytics,
  isLoading,
  error,
}: Readonly<StudentAnalyticsPanelProps>) {
  if (isLoading) return <Message>Loading punctuality...</Message>
  if (error) return <Message tone="error">Failed to load punctuality</Message>
  if (
    !analytics ||
    (analytics.summary.totalEvaluated === 0 && analytics.summary.unscheduled === 0)
  ) {
    return <Message>No evaluated in-person shifts for this student in the selected term.</Message>
  }

  const { summary, lateByTimeSlot, weekdayPatterns, recentIssues } = analytics
  const kpis = [
    {
      label: "Punctuality",
      value: `${Math.round(summary.punctualityRate * 100)}%`,
      sub: "on time or early",
      className: "text-accent",
    },
    {
      label: "Late",
      value: String(summary.late),
      sub: summary.late > 0 ? `avg ${summary.avgMinutesLate} min` : "after 10 min window",
      className: "text-amber-700 dark:text-amber-300",
    },
    { label: "Absent", value: String(summary.absent), sub: "missed shifts", className: "text-destructive" },
    { label: "Unscheduled", value: String(summary.unscheduled), sub: "unmatched clock-ins", className: "" },
  ]
  const weekdays = weekdayPatterns.filter((pattern) => pattern.total > 0)
  const slots = [...lateByTimeSlot].sort((a, b) => b.lateRate - a.lateRate)

  return (
    <div className="flex flex-col gap-4 px-[22px] pt-5 pb-[22px]">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-0.5 rounded-2xl border border-border px-4 py-3.5">
            <span className="text-xs font-semibold text-muted-foreground">{kpi.label}</span>
            <span className={cn("text-[30px] font-bold tracking-[-0.02em]", kpi.className)}>
              {kpi.value}
            </span>
            <span className="text-xs text-muted-foreground">{kpi.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3.5 rounded-2xl border border-border px-[18px] py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold">By weekday</span>
            <span className="flex gap-3 text-xs text-muted-foreground">
              <Legend className="bg-accent" label="On time" />
              <Legend className="bg-amber-500" label="Late" />
              <Legend className="bg-destructive" label="Absent" />
            </span>
          </div>
          {weekdays.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">No evaluated shifts yet.</span>
          ) : (
            weekdays.map((pattern) => {
              const onTime = Math.max(0, pattern.total - pattern.late - pattern.absent)
              const pct = (value: number) => `${(value / pattern.total) * 100}%`
              return (
                <div key={pattern.day} className="grid grid-cols-[44px_minmax(0,1fr)_64px] items-center gap-3">
                  <span className="text-[13px] font-bold">{formatWeekday(pattern.day)}</span>
                  <div className="flex h-[22px] gap-[3px]">
                    {onTime > 0 ? <div className="rounded-md bg-accent" style={{ width: pct(onTime) }} /> : null}
                    {pattern.late > 0 ? (
                      <div className="rounded-md bg-amber-500" style={{ width: pct(pattern.late) }} />
                    ) : null}
                    {pattern.absent > 0 ? (
                      <div className="rounded-md bg-destructive" style={{ width: pct(pattern.absent) }} />
                    ) : null}
                  </div>
                  <span className="text-right font-mono text-xs text-muted-foreground">
                    {pattern.late + pattern.absent} of {pattern.total}
                  </span>
                </div>
              )
            })
          )}
        </section>

        <section className="flex flex-col gap-3.5 rounded-2xl border border-border px-[18px] py-4">
          <span className="text-sm font-bold">Late by start time</span>
          {slots.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">No evaluated shifts yet.</span>
          ) : (
            slots.map((slot) => {
              const rate = Math.round(slot.lateRate * 100)
              return (
                <div key={slot.startTime} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[13px]">
                    <span className="font-bold">{formatStartTimeHeader(slot.startTime)} starts</span>
                    <span className="text-muted-foreground">
                      {slot.lateCount} late of {slot.totalShifts} · {rate}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              )
            })
          )}
          <span className="text-xs leading-[1.4] text-muted-foreground">
            Late means clocking in more than 10 minutes after the shift starts.
          </span>
        </section>
      </div>

      {recentIssues.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-border">
          <div className="border-b border-border/60 px-[18px] py-3.5 text-sm font-bold">
            Recent late, absent and unscheduled
          </div>
          {recentIssues.map((issue) => {
            const style = ISSUE_STYLES[issue.status]
            return (
              <div
                key={`${issue.date}-${issue.startTime}-${issue.status}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-border/60 px-[18px] py-2.5 last:border-0 sm:grid-cols-[130px_minmax(0,1fr)_60px_110px]"
              >
                <span className="text-sm font-semibold">{formatIssueDate(issue.date)}</span>
                <span className="order-last col-span-2 text-[13px] text-muted-foreground sm:order-none sm:col-span-1">
                  {issueDetail(issue)}
                </span>
                <span className="hidden text-right font-mono text-xs text-amber-700 sm:block dark:text-amber-300">
                  {issue.status === "late" && issue.minutesLate > 0 ? `+${issue.minutesLate}m` : ""}
                </span>
                <span
                  className={cn(
                    "justify-self-end rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                    style.className,
                  )}
                >
                  {style.label}
                </span>
              </div>
            )
          })}
        </section>
      ) : null}
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-[5px]">
      <span className={cn("size-2.5 rounded-[3px]", className)} />
      {label}
    </span>
  )
}
