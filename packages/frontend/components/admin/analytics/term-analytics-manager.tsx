"use client"

import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download } from "lucide-react"

import { TermDailyOutcomes } from "@/components/admin/analytics/term-daily-outcomes"
import {
  TermLateArrivals,
  type LateArrivalRow,
} from "@/components/admin/analytics/term-late-arrivals"
import { TermLatenessHeatmap } from "@/components/admin/analytics/term-lateness-heatmap"
import { formatStudentName } from "@/components/admin/mock-students"
import { sortTermsByActiveStatus } from "@/components/admin/terms/term-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTermAnalytics } from "@/hooks/use-analytics"
import {
  buildStudentBreakdownCsv,
  buildSummarySentence,
  findPreviousTerm,
  formatTermProgress,
} from "@/lib/analytics/term-summary"
import { studentAssistantsApi } from "@/lib/api/student-assistants"
import { termsApi, type Term } from "@/lib/api/terms"
import { getOrgLocalDateString } from "@/lib/org-time"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"

/** Terms shown as pills; older ones move to a dropdown. */
const PILL_TERM_COUNT = 3

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function TermSwitcher({
  terms,
  selectedId,
  onSelect,
}: Readonly<{
  terms: Term[]
  selectedId: number | null
  onSelect: Dispatch<SetStateAction<number | null>>
}>) {
  const pills = terms.slice(0, PILL_TERM_COUNT)
  const older = terms.slice(PILL_TERM_COUNT)
  const olderSelected = older.some((term) => term.id === selectedId)

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 rounded-full border border-border bg-card p-1">
        {pills.map((term) => (
          <button
            key={term.id}
            type="button"
            onClick={() => onSelect(term.id)}
            className={cn(
              "h-[30px] whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors",
              term.id === selectedId
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {term.name ?? `Term ${term.id}`}
          </button>
        ))}
      </div>
      {older.length > 0 ? (
        <Select
          value={olderSelected && selectedId ? String(selectedId) : ""}
          onValueChange={(value) => onSelect(Number(value))}
        >
          <SelectTrigger className={cn("h-[38px] w-[150px] rounded-full bg-card", olderSelected && "border-foreground")}>
            <SelectValue placeholder="Older terms" />
          </SelectTrigger>
          <SelectContent>
            {older.map((term) => (
              <SelectItem key={term.id} value={String(term.id)}>
                {term.name ?? `Term ${term.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}

export function TermAnalyticsManager() {
  const { data: terms = [], isLoading: termsLoading } = useQuery({
    queryKey: queryKeys.terms.all,
    queryFn: termsApi.list,
  })
  const { data: students = [] } = useQuery({
    queryKey: queryKeys.students.all,
    queryFn: studentAssistantsApi.list,
  })

  const sortedTerms = useMemo(() => sortTermsByActiveStatus(terms), [terms])
  const [termId, setTermId] = useState<number | null>(null)
  const selectedId = termId ?? sortedTerms[0]?.id ?? null
  const selectedTerm = terms.find((term) => term.id === selectedId)
  const previousTerm = findPreviousTerm(terms, selectedTerm)

  const { data: analytics, isLoading: analyticsLoading, error } = useTermAnalytics(selectedId)
  const { data: previousAnalytics } = useTermAnalytics(previousTerm?.id ?? null)
  const isLoading = termsLoading || analyticsLoading

  const names = useMemo(
    () =>
      new Map(
        students.map((student) => [
          student.id,
          formatStudentName({ first_name: student.first_name ?? "", last_name: student.last_name ?? "" }),
        ]),
      ),
    [students],
  )
  const nameFor = (id: number) => names.get(id) ?? `Student #${id}`

  const rows: LateArrivalRow[] = (analytics?.studentBreakdown ?? []).map((entry) => {
    const name = nameFor(entry.studentAssistantId)
    return {
      ...entry,
      name,
      initials: name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join(""),
    }
  })

  const sentence = analytics
    ? buildSummarySentence(
        analytics,
        previousTerm && previousAnalytics ? { term: previousTerm, analytics: previousAnalytics } : null,
      )
    : null
  const summary = analytics?.summary

  const kpis = [
    { value: summary?.totalEvaluated, label: "shifts evaluated", className: "bg-muted" },
    {
      value: summary?.late,
      label: summary && summary.late > 0 ? `late · avg ${Math.round(summary.avgMinutesLate)}m` : "late",
      className: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    },
    { value: summary?.absent, label: "absent", className: "bg-destructive/10 text-destructive" },
    { value: summary?.excused, label: "excused (Teams)", className: "bg-sky-500/10 text-sky-800 dark:text-sky-200" },
  ]

  const handleExport = () => {
    if (!analytics || !selectedTerm) return
    const slug = (selectedTerm.name ?? `term-${selectedTerm.id}`).toLowerCase().replace(/[^a-z0-9]+/g, "-")
    downloadCsv(`attendance-${slug}.csv`, buildStudentBreakdownCsv(analytics.studentBreakdown, names))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Term analytics</h1>
          <p className="text-sm text-muted-foreground">Punctuality for in-person scheduled shifts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sortedTerms.length > 0 ? (
            <TermSwitcher terms={sortedTerms} selectedId={selectedId} onSelect={setTermId} />
          ) : null}
          <button
            type="button"
            onClick={handleExport}
            disabled={!analytics}
            className="flex h-[38px] items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {!selectedId && !termsLoading ? (
        <p className="text-sm text-muted-foreground">Add a term to view analytics.</p>
      ) : (
        <>
          <section className="grid items-center gap-8 rounded-3xl border border-border bg-card px-8 py-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {selectedTerm ? formatTermProgress(selectedTerm, getOrgLocalDateString()) : " "}
              </span>
              <p className="text-2xl font-semibold leading-[1.3] tracking-[-0.015em] text-pretty lg:text-[28px]">
                {isLoading || !sentence ? (
                  <span className="text-muted-foreground">Loading term summary...</span>
                ) : error ? (
                  <span className="text-destructive">Couldn&apos;t load analytics for this term.</span>
                ) : sentence.punctuality === null ? (
                  "No shifts have been evaluated yet this term."
                ) : (
                  <>
                    Punctuality is <span className="text-accent">{sentence.punctuality}%</span>
                    {sentence.comparison ? `, ${sentence.comparison}` : ""}.
                    {sentence.hotspot ? (
                      <>
                        {" "}Lateness clusters at{" "}
                        <span className="text-amber-700 dark:text-amber-300">{sentence.hotspot}</span>.
                      </>
                    ) : null}
                    {sentence.excused > 0
                      ? ` ${sentence.excused} shift${sentence.excused === 1 ? " was" : "s were"} excused by Teams time off.`
                      : ""}
                  </>
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {kpis.map((kpi) => (
                <div key={kpi.label} className={cn("flex flex-col gap-1 rounded-2xl px-4 py-3.5", kpi.className)}>
                  <span className="font-mono text-[26px] font-semibold tabular-nums">
                    {isLoading || kpi.value === undefined ? "—" : kpi.value}
                  </span>
                  <span className="text-[13px]">{kpi.label}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <TermDailyOutcomes data={analytics?.dailyTrend ?? []} isLoading={isLoading} error={error} />
            <TermLatenessHeatmap cells={analytics?.lateHeatmap ?? []} isLoading={isLoading} error={error} />
          </div>

          <TermLateArrivals rows={rows} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}
