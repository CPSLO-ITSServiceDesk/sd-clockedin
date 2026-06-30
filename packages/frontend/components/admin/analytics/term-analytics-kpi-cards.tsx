"use client"

import { AlertTriangle, CheckCircle2, Clock, Timer, UserX } from "lucide-react"
import type { TimelinessSummary } from "@/lib/api/analytics"
import { Card, CardContent } from "@/components/ui/card"

interface TermAnalyticsKpiCardsProps {
  summary: TimelinessSummary | undefined
  isLoading: boolean
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
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

export function TermAnalyticsKpiCards({
  summary,
  isLoading,
}: TermAnalyticsKpiCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-accent/20 bg-accent/10">
            <CheckCircle2 className="size-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Punctuality rate
            </p>
            <p className="text-xs text-muted-foreground">on time or early</p>
          </div>
          <KpiValue
            value={summary ? formatPercent(summary.punctualityRate) : "—"}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-yellow-500/20 bg-yellow-500/10">
            <AlertTriangle className="size-4 text-yellow-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Late
            </p>
            <p className="text-xs text-muted-foreground">after 10 min window</p>
          </div>
          <KpiValue value={summary?.late ?? 0} isLoading={isLoading} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-destructive/20 bg-destructive/10">
            <UserX className="size-4 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Absent
            </p>
            <p className="text-xs text-muted-foreground">no clock-in</p>
          </div>
          <KpiValue value={summary?.absent ?? 0} isLoading={isLoading} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted">
            <Clock className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Evaluated
            </p>
            <p className="text-xs text-muted-foreground">scheduled shifts</p>
          </div>
          <KpiValue value={summary?.totalEvaluated ?? 0} isLoading={isLoading} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted">
            <Timer className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Avg late
            </p>
            <p className="text-xs text-muted-foreground">minutes when late</p>
          </div>
          <KpiValue
            value={summary?.avgMinutesLate ? `${summary.avgMinutesLate}m` : "0m"}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
