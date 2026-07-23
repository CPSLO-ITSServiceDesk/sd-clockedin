"use client"

import { TrendingUp, UserCheck, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { StaffingKpis } from "@/lib/shifts/hourly-staffing"

interface HourlyStaffingKpisProps {
  kpis: StaffingKpis
  /** today = live working; past = end-of-day actual; future = hide live metric */
  dayKind: "today" | "past" | "future"
  isLoading?: boolean
}

function KpiValue({
  value,
  isLoading,
}: Readonly<{ value: string | number; isLoading: boolean }>) {
  if (isLoading) {
    return (
      <p className="shrink-0 text-2xl font-bold tracking-tight text-muted-foreground">
        —
      </p>
    )
  }

  return <p className="shrink-0 text-2xl font-bold tracking-tight">{value}</p>
}

export function HourlyStaffingKpis({
  kpis,
  dayKind,
  isLoading = false,
}: HourlyStaffingKpisProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="relative overflow-hidden border-border bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted">
            <Users className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Scheduled
            </p>
            <p className="text-xs text-muted-foreground">unique students</p>
          </div>
          <KpiValue value={kpis.scheduled} isLoading={isLoading} />
        </CardContent>
      </Card>

      {dayKind === "today" ? (
        <Card className="relative overflow-hidden border-border bg-card">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-accent/20 bg-accent/10">
              <UserCheck className="size-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Working now
              </p>
              <p className="text-xs text-muted-foreground">currently on shift</p>
            </div>
            <KpiValue value={kpis.workingNow} isLoading={isLoading} />
          </CardContent>
        </Card>
      ) : dayKind === "past" ? (
        <Card className="relative overflow-hidden border-border bg-card">
          <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted">
              <UserCheck className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Worked
              </p>
              <p className="text-xs text-muted-foreground">actual at 4 PM</p>
            </div>
            <KpiValue value={kpis.workingNow} isLoading={isLoading} />
          </CardContent>
        </Card>
      ) : (
        <Card className="relative overflow-hidden border-border bg-card">
          <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted">
              <UserCheck className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Working now
              </p>
              <p className="text-xs text-muted-foreground">not started yet</p>
            </div>
            <KpiValue value={0} isLoading={isLoading} />
          </CardContent>
        </Card>
      )}

      <Card className="relative overflow-hidden border-border bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted">
            <TrendingUp className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Peak hour
            </p>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "highest headcount" : `${kpis.peakCount} scheduled`}
            </p>
          </div>
          <KpiValue
            value={kpis.peakHourLabel || "—"}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
