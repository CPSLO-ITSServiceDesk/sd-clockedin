"use client"

import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, UserX, CalendarClock } from "lucide-react"

interface KpiCardsProps {
  late: number
  absent: number
  expected: number
}

export function KpiCards({ late, absent, expected }: KpiCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="size-4 text-yellow-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Late</p>
            <p className="text-xs text-muted-foreground">employees running late</p>
          </div>
          <p className="text-2xl font-bold tracking-tight shrink-0">{late}</p>
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
            <p className="text-xs text-muted-foreground">no-shows today</p>
          </div>
          <p className="text-2xl font-bold tracking-tight shrink-0">{absent}</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted border border-border">
            <CalendarClock className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Expected</p>
            <p className="text-xs text-muted-foreground">shifts remaining</p>
          </div>
          <p className="text-2xl font-bold tracking-tight shrink-0">{expected}</p>
        </CardContent>
      </Card>
    </div>
  )
}