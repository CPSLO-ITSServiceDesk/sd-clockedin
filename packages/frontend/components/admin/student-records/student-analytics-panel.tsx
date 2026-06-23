"use client"

import type React from "react"
import { AlertTriangle, CheckCircle2, Clock, UserX } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { StudentAnalytics } from "@/lib/api/analytics"
import { formatStartTimeHeader, formatTime } from "@/lib/format-time"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"

const chartConfig = {
  lateCount: {
    label: "Late",
    color: "var(--destructive)",
  },
} satisfies ChartConfig

interface StudentAnalyticsPanelProps {
  analytics: StudentAnalytics | undefined
  isLoading: boolean
  error: Error | null
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

function formatIssueDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function StudentAnalyticsPanel({
  analytics,
  isLoading,
  error,
}: StudentAnalyticsPanelProps) {
  if (isLoading) {
    return (
      <div className="text-muted-foreground py-6 text-center text-sm">
        Loading analytics...
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6 text-center text-sm text-destructive">
        Failed to load analytics
      </div>
    )
  }

  if (!analytics || analytics.summary.totalEvaluated === 0) {
    return (
      <div className="text-muted-foreground py-6 text-center text-sm">
        No evaluated in-person shifts for this student in the selected term.
      </div>
    )
  }

  const { summary, lateByTimeSlot, recentIssues } = analytics
  const chartData = lateByTimeSlot.map((slot) => ({
    ...slot,
    label: formatStartTimeHeader(slot.startTime),
  }))

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="flex items-center gap-3 p-3">
            <CheckCircle2 className="size-4 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                On-time rate
              </p>
            </div>
            <p className="text-xl font-bold">{formatPercent(summary.onTimeRate)}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="flex items-center gap-3 p-3">
            <AlertTriangle className="size-4 text-yellow-500" />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Late</p>
            </div>
            <p className="text-xl font-bold">{summary.late}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="flex items-center gap-3 p-3">
            <UserX className="size-4 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Absent</p>
            </div>
            <p className="text-xl font-bold">{summary.absent}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="flex items-center gap-3 p-3">
            <Clock className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Evaluated
              </p>
            </div>
            <p className="text-xl font-bold">{summary.totalEvaluated}</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">
              Late by Time Slot
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
              <BarChart data={chartData} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={24}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => {
                        const payload = item.payload as (typeof chartData)[number]
                        const rate = Math.round(payload.lateRate * 100)
                        return (
                          <span>
                            {value} late · {payload.totalShifts} total ({rate}%)
                          </span>
                        )
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="lateCount"
                  fill="var(--color-lateCount)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}

      {recentIssues.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">
              Recent Late & Absent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentIssues.map((issue) => (
              <div
                key={`${issue.date}-${issue.startTime}-${issue.status}`}
                className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{formatIssueDate(issue.date)}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatStartTimeHeader(issue.startTime)} –{" "}
                    {formatStartTimeHeader(issue.endTime)}
                    {issue.clockIn ? ` · in ${formatTime(issue.clockIn)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {issue.status === "late" && issue.minutesLate > 0 ? (
                    <span className="text-muted-foreground text-xs">
                      +{issue.minutesLate}m
                    </span>
                  ) : null}
                  <Badge
                    variant="secondary"
                    className={
                      issue.status === "late"
                        ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
                        : "bg-destructive/15 text-destructive"
                    }
                  >
                    {issue.status === "late" ? "Late" : "Absent"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
