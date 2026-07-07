"use client"

import { AlertTriangle, Clock, Link2 } from "lucide-react"
import type { NormalizationPreview } from "@/lib/api/shift-normalization"
import { Card, CardContent } from "@/components/ui/card"

interface ShiftNormalizationKpiCardsProps {
  summary: NormalizationPreview["summary"] | undefined
  isLoading?: boolean
}

function KpiValue({
  value,
  isLoading,
}: Readonly<{ value: number; isLoading: boolean }>) {
  if (isLoading) {
    return (
      <p className="shrink-0 text-2xl font-bold tracking-tight text-muted-foreground">
        —
      </p>
    )
  }

  return <p className="shrink-0 text-2xl font-bold tracking-tight">{value}</p>
}

export function ShiftNormalizationKpiCards({
  summary,
  isLoading = false,
}: ShiftNormalizationKpiCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted">
            <Clock className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Unscheduled
            </p>
            <p className="text-xs text-muted-foreground">entries without a block</p>
          </div>
          <KpiValue value={summary?.totalUnscheduled ?? 0} isLoading={isLoading} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-accent/20 bg-accent/10">
            <Link2 className="size-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Proposed
            </p>
            <p className="text-xs text-muted-foreground">close block matches</p>
          </div>
          <KpiValue value={summary?.proposedMatches ?? 0} isLoading={isLoading} />
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
              No match
            </p>
            <p className="text-xs text-muted-foreground">could not link</p>
          </div>
          <KpiValue value={summary?.noMatch ?? 0} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}
