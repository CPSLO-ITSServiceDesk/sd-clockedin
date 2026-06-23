"use client"

import { AlertTriangle, CalendarClock, UserCheck, UserX } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import { computeDashboardKpis } from "@/lib/shifts/dashboard-stats"

function KpiValue({ value, isLoading }: Readonly<{ value: number; isLoading: boolean }>) {
  if (isLoading) {
    return <p className="text-2xl font-bold tracking-tight shrink-0 text-muted-foreground">—</p>
  }

  return <p className="text-2xl font-bold tracking-tight shrink-0">{value}</p>
}

export function KpiCards() {
  const { shifts, isLoading } = useTodayShiftList()
  const { late, absent, onShift, incomingNextTwoHours } = computeDashboardKpis(shifts)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-accent/10 border border-accent/20">
            <UserCheck className="size-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">On Shift</p>
            <p className="text-xs text-muted-foreground">in-person, clocked in</p>
          </div>
          <KpiValue value={onShift} isLoading={isLoading} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted border border-border">
            <CalendarClock className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Incoming</p>
            <p className="text-xs text-muted-foreground">in-person, next 2 hours</p>
          </div>
          <KpiValue value={incomingNextTwoHours} isLoading={isLoading} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="size-4 text-yellow-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Late</p>
            <p className="text-xs text-muted-foreground">in-person, after start</p>
          </div>
          <KpiValue value={late} isLoading={isLoading} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-destructive/10 border border-destructive/20">
            <UserX className="size-4 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Absent</p>
            <p className="text-xs text-muted-foreground">in-person, no clock-in</p>
          </div>
          <KpiValue value={absent} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}
