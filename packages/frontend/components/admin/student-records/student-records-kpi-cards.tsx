"use client"

import { Calendar, Clock, Timer, UserCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatDuration } from "@/components/admin/student-records/student-records-utils"

interface StudentRecordsKpiCardsProps {
  termName: string
  studentsWithEntries: number
  totalStudents: number
  totalEntries: number
  totalMinutes: number
  openEntries: number
}

export function StudentRecordsKpiCards({
  termName,
  studentsWithEntries,
  totalStudents,
  totalEntries,
  totalMinutes,
  openEntries,
}: StudentRecordsKpiCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
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
            <p className="text-xs text-muted-foreground">attendance context</p>
          </div>
          <p className="shrink-0 text-lg font-bold tracking-tight">{termName}</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted">
            <UserCheck className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              With entries
            </p>
            <p className="text-xs text-muted-foreground">students clocked in</p>
          </div>
          <p className="shrink-0 text-2xl font-bold tracking-tight">
            {studentsWithEntries}/{totalStudents}
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
              Entries
            </p>
            <p className="text-xs text-muted-foreground">
              {openEntries > 0 ? `${openEntries} open` : "all closed"}
            </p>
          </div>
          <p className="shrink-0 text-2xl font-bold tracking-tight">{totalEntries}</p>
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
              Total hours
            </p>
            <p className="text-xs text-muted-foreground">completed shifts</p>
          </div>
          <p className="shrink-0 text-2xl font-bold tracking-tight">
            {formatDuration(totalMinutes)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
