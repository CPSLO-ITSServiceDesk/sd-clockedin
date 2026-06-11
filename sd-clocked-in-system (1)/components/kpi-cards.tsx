"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, UserX, CalendarClock } from "lucide-react"

interface KpiCardsProps {
  late: number
  absent: number
  expected: number
}

export function KpiCards({ late, absent, expected }: KpiCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent" />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Late
          </CardTitle>
          <div className="flex size-10 items-center justify-center rounded-sm bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="size-5 text-yellow-500" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold font-mono tracking-tight">{late}</p>
          <p className="text-xs text-muted-foreground mt-1">employees running late</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent" />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Absent
          </CardTitle>
          <div className="flex size-10 items-center justify-center rounded-sm bg-destructive/10 border border-destructive/20">
            <UserX className="size-5 text-destructive" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold font-mono tracking-tight">{absent}</p>
          <p className="text-xs text-muted-foreground mt-1">no-shows today</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Expected
          </CardTitle>
          <div className="flex size-10 items-center justify-center rounded-sm bg-accent/10 border border-accent/20">
            <CalendarClock className="size-5 text-accent" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold font-mono tracking-tight">{expected}</p>
          <p className="text-xs text-muted-foreground mt-1">shifts remaining</p>
        </CardContent>
      </Card>
    </div>
  )
}
