"use client"

import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { formatStudentName } from "@/components/admin/mock-students"
import { StudentRecordsKpiCards } from "@/components/admin/student-records/student-records-kpi-cards"
import {
  TimeEntriesEmptyState,
  TimeEntriesPanel,
} from "@/components/admin/student-records/time-entries-panel"
import { StudentAnalyticsPanel } from "@/components/admin/student-records/student-analytics-panel"
import {
  STUDENT_TERM_PAGE_GRID,
  StudentSelectionPanel,
} from "@/components/admin/student-term/student-selection-panel"
import { TermPageHeader } from "@/components/admin/student-term/term-page-header"
import { useStudentAnalytics } from "@/hooks/use-analytics"
import { useStudentTermSelection } from "@/hooks/use-student-term-selection"
import {
  entryMatchesTerm,
  getEntryDurationMinutes,
  getStudentTermBlockIds,
} from "@/components/admin/student-records/student-records-utils"
import type { ScheduleStudent } from "@/lib/api/schedule-mappers"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { queryKeys } from "@/lib/query-keys"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function StudentRecordsManager() {
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
  } = useStudentTermSelection({ basePath: "/admin/studentrecords" })

  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: queryKeys.timeEntries.all,
    queryFn: timeEntriesApi.list,
  })

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

      return entryMatchesTerm(entry, selectedTerm, termBlockIds)
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

      return timeEntries.some(
        (entry) =>
          entry.student_assistant_id === student.id &&
          entryMatchesTerm(entry, selectedTerm, termBlockIds),
      )
    },
    [activeTermId, timeEntries, schedules, scheduleBlocks, selectedTerm],
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
          <p className="text-muted-foreground text-sm">Loading records...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TermPageHeader
        title="Student Records"
        description={`Select a term, then a student to manage clock in/out entries · ${studentsWithEntries} of ${activeStudents.length} with entries`}
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

      <div className={STUDENT_TERM_PAGE_GRID}>
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
          showIndicator={hasEntriesInTerm}
          indicatorTitle="Has time entries"
        />

        <Card className="bg-card border-border min-w-0">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold uppercase tracking-wider">
                {selectedStudent
                  ? formatStudentName(selectedStudent)
                  : "Time entries"}
              </CardTitle>
              {selectedStudent ? (
                <Badge
                  variant="secondary"
                  className={
                    selectedStudentOpenCount > 0
                      ? "bg-accent/20 text-accent"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {selectedStudentOpenCount > 0
                    ? `${selectedStudentOpenCount} open`
                    : "All closed"}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {!activeTermId ? (
              <TimeEntriesEmptyState message="Select a term above to begin managing time entries." />
            ) : !selectedStudent ? (
              <TimeEntriesEmptyState />
            ) : (
              <div className="space-y-8">
                <div>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">
                    Punctuality
                  </h3>
                  <StudentAnalyticsPanel
                    analytics={studentAnalytics}
                    isLoading={studentAnalyticsLoading}
                    error={studentAnalyticsError}
                  />
                </div>
                <div>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">
                    Time Entries
                  </h3>
                  <TimeEntriesPanel
                    key={`${selectedStudent.id}-${activeTermId}`}
                    student={selectedStudent}
                    term={selectedTerm}
                    termId={activeTermId}
                    schedules={schedules}
                    scheduleBlocks={scheduleBlocks}
                    timeEntries={timeEntries}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
