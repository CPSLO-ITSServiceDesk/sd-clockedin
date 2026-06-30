"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { PanelLeftOpen } from "lucide-react"
import { formatStudentName } from "@/components/admin/mock-students"
import { StudentAnalyticsPanel } from "@/components/admin/student-records/student-analytics-panel"
import { StudentRecordsKpiCards } from "@/components/admin/student-records/student-records-kpi-cards"
import {
  TimeEntriesEmptyState,
  TimeEntriesPanel,
} from "@/components/admin/student-records/time-entries-panel"
import {
  StudentSelectionPanel,
  STUDENT_RECORDS_SPLIT_HEIGHT,
} from "@/components/admin/student-term/student-selection-panel"
import { TermPageHeader } from "@/components/admin/student-term/term-page-header"
import { useStudentAnalytics } from "@/hooks/use-analytics"
import { useStudentTermSelection } from "@/hooks/use-student-term-selection"
import {
  entryMatchesTerm,
  getEntryDurationMinutes,
  getStudentTermBlockIds,
  getStudentTermSchedule,
} from "@/components/admin/student-records/student-records-utils"
import type { ScheduleStudent } from "@/lib/api/schedule-mappers"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { queryKeys } from "@/lib/query-keys"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const BASE_PATH = "/admin/studentrecords"

type StudentRecordsTab = "analytics" | "entries"

function parseTab(value: string | null): StudentRecordsTab {
  return value === "analytics" ? "analytics" : "entries"
}

export function StudentRecordsManager() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = parseTab(searchParams.get("tab"))
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(true)

  const {
    isLoading: selectionLoading,
    sortedTerms,
    activeTermId,
    selectedTerm,
    activeStudents,
    selectedStudentId,
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
  } = useStudentTermSelection({ basePath: BASE_PATH })

  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: queryKeys.timeEntries.all,
    queryFn: timeEntriesApi.list,
  })

  const setActiveTab = useCallback(
    (tab: StudentRecordsTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === "entries") {
        params.delete("tab")
      } else {
        params.set("tab", tab)
      }
      const query = params.toString()
      router.replace(query ? `${BASE_PATH}?${query}` : BASE_PATH, { scroll: false })
    },
    [router, searchParams],
  )

  const termScopedEntries = useMemo(() => {
    if (!activeTermId) return []

    return timeEntries.filter((entry) => {
      if (!entry.student_assistant_id) return false

      const termBlockIds = getStudentTermBlockIds(
        entry.student_assistant_id,
        activeTermId,
        schedules,
        scheduleBlocks,
      )

      const schedule = getStudentTermSchedule(
        entry.student_assistant_id,
        activeTermId,
        schedules,
      )

      return entryMatchesTerm(entry, selectedTerm, termBlockIds, schedule)
    })
  }, [activeTermId, timeEntries, schedules, scheduleBlocks, selectedTerm])

  const hasEntriesInTerm = useCallback(
    (student: ScheduleStudent) => {
      if (!activeTermId) return false

      const termBlockIds = getStudentTermBlockIds(
        student.id,
        activeTermId,
        schedules,
        scheduleBlocks,
      )

      const schedule = getStudentTermSchedule(student.id, activeTermId, schedules)

      return timeEntries.some(
        (entry) =>
          entry.student_assistant_id === student.id &&
          entryMatchesTerm(entry, selectedTerm, termBlockIds, schedule),
      )
    },
    [activeTermId, timeEntries, schedules, scheduleBlocks, selectedTerm],
  )

  const showStudentIndicator = useCallback(
    (student: ScheduleStudent) => hasSchedule(student) || hasEntriesInTerm(student),
    [hasSchedule, hasEntriesInTerm],
  )

  const studentsWithEntries = activeTermId
    ? activeStudents.filter((student) => hasEntriesInTerm(student)).length
    : 0

  const openEntries = termScopedEntries.filter((entry) => !entry.clock_out).length

  const totalMinutes = termScopedEntries.reduce((sum, entry) => {
    const minutes = getEntryDurationMinutes(entry)
    return sum + (minutes ?? 0)
  }, 0)

  const selectedStudentOpenCount =
    selectedStudent && activeTermId
      ? termScopedEntries.filter(
          (entry) =>
            entry.student_assistant_id === selectedStudent.id && !entry.clock_out,
        ).length
      : 0

  const {
    data: studentAnalytics,
    isLoading: studentAnalyticsLoading,
    error: studentAnalyticsError,
  } = useStudentAnalytics(selectedStudentId, activeTermId)

  const isLoading = selectionLoading || entriesLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Records</h1>
          <p className="text-muted-foreground text-sm">Loading student records...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TermPageHeader
        title="Student Records"
        description={`Punctuality and clock in/out entries · ${scheduledCount} scheduled · ${studentsWithEntries} with entries`}
        sortedTerms={sortedTerms}
        activeTermId={activeTermId}
        onTermChange={changeTerm}
      />

      <StudentRecordsKpiCards
        termName={selectedTerm?.name ?? "—"}
        studentsWithEntries={studentsWithEntries}
        totalStudents={activeStudents.length}
        totalEntries={termScopedEntries.length}
        totalMinutes={totalMinutes}
        openEntries={openEntries}
      />

      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          isStudentPickerOpen &&
            cn(
              "items-stretch lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]",
              STUDENT_RECORDS_SPLIT_HEIGHT,
            ),
        )}
      >
        {isStudentPickerOpen ? (
          <StudentSelectionPanel
            disabled={!activeTermId}
            emptyMessage="Add a term before viewing student records."
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            filteredStudents={filteredStudents}
            selectedStudentId={selectedStudentId}
            onSelectStudent={selectStudent}
            showIndicator={showStudentIndicator}
            indicatorTitle="Scheduled or has entries"
            onCollapsedChange={() => setIsStudentPickerOpen(false)}
            fillHeight
          />
        ) : null}

        <div
          className={cn(
            "min-w-0 space-y-3",
            isStudentPickerOpen && "flex h-full min-h-0 flex-col",
          )}
        >
          {!isStudentPickerOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIsStudentPickerOpen(true)}
            >
              <PanelLeftOpen className="size-4" />
              Browse students
              {selectedStudent ? (
                <span className="text-muted-foreground truncate">
                  · {formatStudentName(selectedStudent)}
                </span>
              ) : null}
            </Button>
          ) : null}

        <Card
          className={cn(
            "bg-card border-border min-w-0",
            isStudentPickerOpen && "flex min-h-0 flex-1 flex-col",
          )}
        >
          {!selectedStudent || !activeTermId ? (
            <>
              <CardHeader className="border-b border-border shrink-0">
                <CardTitle className="text-lg font-semibold uppercase tracking-wider">
                  Student details
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto p-6">
                {!activeTermId ? (
                  <TimeEntriesEmptyState message="Select a term above to begin." />
                ) : (
                  <TimeEntriesEmptyState message="Select a student to view punctuality or manage time entries." />
                )}
              </CardContent>
            </>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(parseTab(value))}
              className={cn(isStudentPickerOpen && "flex min-h-0 flex-1 flex-col")}
            >
              <CardHeader className="border-b border-border shrink-0 gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <CardTitle className="truncate text-lg font-semibold uppercase tracking-wider">
                    {formatStudentName(selectedStudent)}
                  </CardTitle>
                  {selectedStudentOpenCount > 0 ? (
                    <Badge variant="secondary" className="shrink-0 bg-accent/20 text-accent">
                      {selectedStudentOpenCount} open
                    </Badge>
                  ) : null}
                </div>
                <TabsList variant="line" className="w-full justify-start sm:w-auto">
                  <TabsTrigger value="analytics">Punctuality</TabsTrigger>
                  <TabsTrigger value="entries">Time Entries</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent
                className={cn(
                  "p-6",
                  isStudentPickerOpen && "min-h-0 flex-1 overflow-y-auto",
                )}
              >
                <TabsContent value="analytics" className="mt-0">
                  <StudentAnalyticsPanel
                    analytics={studentAnalytics}
                    isLoading={studentAnalyticsLoading}
                    error={studentAnalyticsError}
                  />
                </TabsContent>
                <TabsContent value="entries" className="mt-0">
                  <TimeEntriesPanel
                    key={`${selectedStudent.id}-${activeTermId}`}
                    student={selectedStudent}
                    term={selectedTerm}
                    termId={activeTermId}
                    schedules={schedules}
                    scheduleBlocks={scheduleBlocks}
                    timeEntries={timeEntries}
                  />
                </TabsContent>
              </CardContent>
            </Tabs>
          )}
        </Card>
        </div>
      </div>
    </div>
  )
}
