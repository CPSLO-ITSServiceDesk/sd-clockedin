"use client"

import { Calendar, Clock, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatWeeklyHours } from "@/components/admin/schedules/schedule-utils"

interface ScheduleKpiCardsProps {
  termName: string
  scheduledCount: number
  totalStudents: number
  totalWeeklyHours: number
}

export function ScheduleKpiCards({
  termName,
  scheduledCount,
  totalStudents,
  totalWeeklyHours,
}: ScheduleKpiCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-accent/20 bg-accent/10">
            <Calendar className="size-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Term
            </p>
            <p className="text-xs text-muted-foreground">active schedule context</p>
          </div>
          <p className="shrink-0 text-lg font-bold tracking-tight">{termName}</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted">
            <Users className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Scheduled
            </p>
            <p className="text-xs text-muted-foreground">students with shifts</p>
          </div>
          <p className="shrink-0 text-2xl font-bold tracking-tight">
            {scheduledCount}/{totalStudents}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-accent/20 bg-accent/10">
            <Clock className="size-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Weekly hours
            </p>
            <p className="text-xs text-muted-foreground">combined team load</p>
          </div>
          <p className="shrink-0 text-2xl font-bold tracking-tight">
            {formatWeeklyHours(totalWeeklyHours)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
