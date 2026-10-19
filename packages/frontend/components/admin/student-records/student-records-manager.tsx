"use client"

import { useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { formatStudentName } from "@/components/admin/mock-students"
import { SCHEDULE_WEEKDAYS } from "@/components/admin/schedules/schedule-types"
import {
  formatDayShort,
  formatWeeklyHours,
  totalWeeklyHours,
} from "@/components/admin/schedules/schedule-utils"
import { StudentAnalyticsPanel } from "@/components/admin/student-records/student-analytics-panel"
import { TimeEntriesPanel } from "@/components/admin/student-records/time-entries-panel"
import {
  entryMatchesTerm,
  formatDuration,
  getEntryDurationMinutes,
  getStudentTermBlockIds,
  getStudentTermSchedule,
} from "@/components/admin/student-records/student-records-utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStudentAnalytics } from "@/hooks/use-analytics"
import { useStudentTermSelection, type RoleFilter } from "@/hooks/use-student-term-selection"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"

const BASE_PATH = "/admin/studentrecords"

type StudentRecordsTab = "analytics" | "entries"

const TABS: { value: StudentRecordsTab; label: string }[] = [
  { value: "analytics", label: "Punctuality" },
  { value: "entries", label: "Time entries" },
]

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lead", label: "Leads" },
  { value: "assistant", label: "Assistants" },
]

function parseTab(value: string | null): StudentRecordsTab {
  return value === "entries" ? "entries" : "analytics"
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: Readonly<{
  options: { value: T; label: string }[]
  value: T
  onChange: (_value: T) => void
  size?: "sm" | "md"
  className?: string
}>) {
  return (
    <div className={cn("grid auto-cols-fr grid-flow-col gap-[3px] rounded-full bg-muted p-[3px]", className)}>
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full font-bold transition-colors",
              size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-4 text-[13px]",
              on
                ? "bg-card text-accent shadow-[0_1px_3px_rgba(20,22,28,0.12)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function StudentRecordsManager() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = parseTab(searchParams.get("tab"))

  const {
    isLoading: selectionLoading,
    sortedTerms,
    activeTermId,
    selectedTerm,
    activeStudents,
    selectedStudent,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    filteredStudents,
    selectStudent,
    changeTerm,
    schedules,
    allBlocks: scheduleBlocks,
    hasSchedule,
    scheduledCount,
    getScheduleForStudentTerm,
  } = useStudentTermSelection({ basePath: BASE_PATH })

  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: queryKeys.timeEntries.all,
    queryFn: timeEntriesApi.list,
  })

  // Fall back to the first listed student so the record pane is never empty.
  const current = selectedStudent ?? filteredStudents[0] ?? null

  const setActiveTab = useCallback(
    (tab: StudentRecordsTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === "analytics") {
        params.delete("tab")
      } else {
        params.set("tab", tab)
      }
      const query = params.toString()
      router.replace(query ? `${BASE_PATH}?${query}` : BASE_PATH, { scroll: false })
    },
    [router, searchParams],
  )

  const termEntriesByStudent = useMemo(() => {
    const map = new Map<number, typeof timeEntries>()
    if (!activeTermId) return map

    for (const entry of timeEntries) {
      const studentId = entry.student_assistant_id
      if (!studentId) continue
      const termBlockIds = getStudentTermBlockIds(studentId, activeTermId, schedules, scheduleBlocks)
      const schedule = getStudentTermSchedule(studentId, activeTermId, schedules)
      if (!entryMatchesTerm(entry, selectedTerm, termBlockIds, schedule)) continue
      map.set(studentId, [...(map.get(studentId) ?? []), entry])
    }
    return map
  }, [activeTermId, timeEntries, schedules, scheduleBlocks, selectedTerm])

  const studentsWithEntries = activeStudents.filter((student) =>
    termEntriesByStudent.has(student.id),
  ).length

  const {
    data: studentAnalytics,
    isLoading: studentAnalyticsLoading,
    error: studentAnalyticsError,
  } = useStudentAnalytics(current?.id ?? null, activeTermId)

  if (selectionLoading || entriesLoading) {
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Student Records</h1>
        <p className="text-sm text-muted-foreground">Loading student records...</p>
      </div>
    )
  }

  const currentEntries = current ? (termEntriesByStudent.get(current.id) ?? []) : []
  const currentOpen = currentEntries.filter((entry) => !entry.clock_out).length
  const currentMinutes = currentEntries.reduce(
    (sum, entry) => sum + (getEntryDurationMinutes(entry) ?? 0),
    0,
  )
  const currentBlocks =
    current && activeTermId ? getScheduleForStudentTerm(current.id, activeTermId).blocks : []
  const currentDays = SCHEDULE_WEEKDAYS.filter((weekday) =>
    currentBlocks.some((block) => block.day === weekday.value),
  ).map((weekday) => formatDayShort(weekday.value))
  const currentSummary = current
    ? [
        current.role,
        currentDays.length > 0
          ? `${currentDays.join(", ")} · ${formatWeeklyHours(totalWeeklyHours(currentBlocks))} a week`
          : "No schedule this term",
        `${currentEntries.length} ${currentEntries.length === 1 ? "entry" : "entries"}`,
        `${formatDuration(currentMinutes)} this term`,
      ].join(" · ")
    : ""

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Student Records</h1>
          <p className="text-sm text-muted-foreground">
            Punctuality and clock in/out entries · {scheduledCount} scheduled · {studentsWithEntries} with
            entries
          </p>
        </div>
        <Select
          value={activeTermId ? String(activeTermId) : undefined}
          onValueChange={(value) => changeTerm(Number(value))}
        >
          <SelectTrigger className="h-[38px] w-[190px] rounded-full bg-card font-bold">
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

      {!activeTermId ? (
        <p className="text-sm text-muted-foreground">Add a term before viewing student records.</p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <section className="flex flex-col gap-2.5 rounded-[20px] border border-border bg-card p-3.5 lg:sticky lg:top-6">
            <label className="flex h-9 items-center gap-2 rounded-full border border-border bg-muted/40 px-3">
              <Search className="size-3.5 text-muted-foreground" strokeWidth={2.25} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search students"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </label>
            <SegmentedControl
              options={ROLE_FILTERS}
              value={roleFilter}
              onChange={setRoleFilter}
              size="sm"
            />
            <div className="flex max-h-[560px] flex-col gap-0.5 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-muted-foreground">No students found</p>
              ) : (
                filteredStudents.map((student) => {
                  const on = student.id === current?.id
                  const active = hasSchedule(student) || termEntriesByStudent.has(student.id)
                  return (
                    <button
                      key={student.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => selectStudent(student)}
                      className={cn(
                        "flex h-[38px] shrink-0 items-center gap-2.5 rounded-xl px-2.5 text-left",
                        on ? "bg-accent/10" : "hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "size-[7px] shrink-0 rounded-full",
                          active ? "bg-[var(--status-online)]" : "bg-border",
                        )}
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          on ? "font-bold text-accent" : "font-medium",
                        )}
                      >
                        {formatStudentName(student)}
                      </span>
                      {student.role === "Student Lead" ? (
                        <span className="text-xs text-amber-600">★</span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
            <span className="flex items-center gap-1.5 px-2.5 pt-1 text-xs text-muted-foreground">
              <span className="size-[7px] rounded-full bg-[var(--status-online)]" />
              Scheduled or has entries
            </span>
          </section>

          <section className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-border bg-card">
            {!current ? (
              <p className="px-[22px] py-16 text-center text-sm text-muted-foreground">
                Select a student to view punctuality or manage time entries.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-[22px] py-[18px]">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground">
                      {`${current.first_name[0] ?? ""}${current.last_name[0] ?? ""}`.toUpperCase()}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex items-center gap-2.5">
                        <span className="truncate text-xl font-bold tracking-[-0.01em]">
                          {formatStudentName(current)}
                        </span>
                        {currentOpen > 0 ? (
                          <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                            {currentOpen} open
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[13px] text-muted-foreground">{currentSummary}</span>
                    </div>
                  </div>
                  <SegmentedControl options={TABS} value={activeTab} onChange={setActiveTab} />
                </div>

                {activeTab === "analytics" ? (
                  <StudentAnalyticsPanel
                    analytics={studentAnalytics}
                    isLoading={studentAnalyticsLoading}
                    error={studentAnalyticsError}
                  />
                ) : (
                  <TimeEntriesPanel
                    key={`${current.id}-${activeTermId}`}
                    student={current}
                    term={selectedTerm}
                    termId={activeTermId}
                    schedules={schedules}
                    scheduleBlocks={scheduleBlocks}
                    timeEntries={timeEntries}
                  />
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
