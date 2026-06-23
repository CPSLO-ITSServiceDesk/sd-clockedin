"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Calendar } from "lucide-react"
import { OverviewChart } from "@/components/admin/analytics/overview-chart"
import { TermAnalyticsKpiCards } from "@/components/admin/analytics/term-analytics-kpi-cards"
import { TermLateBySlotChart } from "@/components/admin/analytics/term-late-by-slot-chart"
import { TermLateLeaderboard } from "@/components/admin/analytics/term-late-leaderboard"
import { TermWeekdayChart } from "@/components/admin/analytics/term-weekday-chart"
import { sortTermsByActiveStatus } from "@/components/admin/terms/term-types"
import { useTermAnalytics } from "@/hooks/use-analytics"
import { studentAssistantsApi } from "@/lib/api/student-assistants"
import { termsApi } from "@/lib/api/terms"
import { queryKeys } from "@/lib/query-keys"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function TermAnalyticsManager() {
  const { data: terms = [], isLoading: termsLoading } = useQuery({
    queryKey: queryKeys.terms.all,
    queryFn: termsApi.list,
  })

  const { data: students = [] } = useQuery({
    queryKey: queryKeys.students.all,
    queryFn: studentAssistantsApi.list,
  })

  const defaultTermId = useMemo(
    () => terms.find((term) => term.is_active)?.id ?? terms[0]?.id ?? null,
    [terms],
  )

  const sortedTerms = useMemo(() => sortTermsByActiveStatus(terms), [terms])
  const [termId, setTermId] = useState<number | null>(null)
  const activeTermId = termId ?? defaultTermId

  const {
    data: analytics,
    isLoading: analyticsLoading,
    error,
  } = useTermAnalytics(activeTermId)

  const isLoading = termsLoading || analyticsLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Term Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Team-wide punctuality for in-person scheduled shifts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="text-muted-foreground size-4" />
          <Select
            value={activeTermId ? String(activeTermId) : undefined}
            onValueChange={(value) => setTermId(Number(value))}
          >
            <SelectTrigger className="w-[200px] border-border bg-input">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              {sortedTerms.map((term) => (
                <SelectItem key={term.id} value={String(term.id)}>
                  {term.name}
                  {term.is_active ? " (Active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!activeTermId ? (
        <p className="text-muted-foreground text-sm">Add a term to view analytics.</p>
      ) : (
        <>
          <TermAnalyticsKpiCards summary={analytics?.summary} isLoading={isLoading} />

          <OverviewChart
            data={analytics?.dailyTrend ?? []}
            isLoading={isLoading}
            error={error}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <TermLateBySlotChart
              data={analytics?.lateByTimeSlot ?? []}
              isLoading={isLoading}
              error={error}
            />
            <TermWeekdayChart
              data={analytics?.weekdayPatterns ?? []}
              isLoading={isLoading}
              error={error}
            />
          </div>

          <TermLateLeaderboard
            entries={analytics?.lateLeaderboard ?? []}
            students={students}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  )
}
