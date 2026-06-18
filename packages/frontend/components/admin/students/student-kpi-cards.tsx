"use client"

import { Card, CardContent } from "@/components/ui/card"
import { GraduationCap, Star, Users } from "lucide-react"

interface StudentKpiCardsProps {
  total: number
  studentLeads: number
  combined: number
}

export function StudentKpiCards({
  total,
  studentLeads,
  combined,
}: StudentKpiCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-accent/10 border border-accent/20">
            <GraduationCap className="size-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Total
            </p>
            <p className="text-xs text-muted-foreground">student assistants</p>
          </div>
          <p className="text-2xl font-bold tracking-tight shrink-0">
            {total}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-yellow-500/10 border border-yellow-500/20">
            <Star className="size-4 text-yellow-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Student Lead
            </p>
            <p className="text-xs text-muted-foreground">lead roles assigned</p>
          </div>
          <p className="text-2xl font-bold tracking-tight shrink-0">
            {studentLeads}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent" />
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted border border-border">
            <Users className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Both Combined
            </p>
            <p className="text-xs text-muted-foreground">leads & assistants</p>
          </div>
          <p className="text-2xl font-bold tracking-tight shrink-0">
            {combined}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
