"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { formatStudentName } from "@/components/admin/mock-students"
import {
  ScheduleEditorEmptyState,
  ScheduleEditorPanel,
} from "@/components/admin/schedules/schedule-editor-panel"
import { ScheduleKpiCards } from "@/components/admin/schedules/schedule-kpi-cards"
import { ScheduleImportDialog } from "@/components/admin/schedules/schedule-import-dialog"
import type { ScheduleSavePayload } from "@/components/admin/schedules/schedule-editor-panel"
import {
  STUDENT_TERM_PAGE_GRID,
  StudentSelectionPanel,
} from "@/components/admin/student-term/student-selection-panel"
import { TermPageHeader } from "@/components/admin/student-term/term-page-header"
import { totalWeeklyHours } from "@/components/admin/schedules/schedule-utils"
import { useStudentTermSelection } from "@/hooks/use-student-term-selection"
import { queryKeys } from "@/lib/query-keys"
import { saveStudentTermSchedule } from "@/lib/schedules/persistence"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SchedulesManager() {
  const queryClient = useQueryClient()
  const [importOpen, setImportOpen] = useState(false)

  const {
    isLoading,
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
    hasSchedule,
    scheduledCount,
    getScheduleForStudentTerm,
    allBlocks,
  } = useStudentTermSelection({ basePath: "/admin/schedules" })

  const combinedWeeklyHours = useMemo(
    () =>
      activeTermId
        ? activeStudents.reduce((sum, student) => {
            const { blocks } = getScheduleForStudentTerm(student.id, activeTermId)
            return sum + totalWeeklyHours(blocks)
          }, 0)
        : 0,
    [activeStudents, activeTermId, getScheduleForStudentTerm],
  )

  const selectedScheduleData =
    selectedStudent && activeTermId
      ? getScheduleForStudentTerm(selectedStudent.id, activeTermId)
      : null

  const handleSaveSchedule = async (payload: ScheduleSavePayload) => {
    if (!selectedStudent || !activeTermId) return

    const { schedule } = getScheduleForStudentTerm(
      selectedStudent.id,
      activeTermId,
    )

    await saveStudentTermSchedule(
      selectedStudent.id,
      activeTermId,
      payload.blocks,
      schedule,
      allBlocks.filter((block) =>
        schedule ? block.schedule_id === schedule.id : false,
      ),
      {
        startDate: payload.startDate,
        endDate: payload.endDate,
      },
    )

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.all }),
    ])
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground text-sm">Loading schedules...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TermPageHeader
        title="Schedules"
        description={`Select a term, then a student to edit their weekly schedule · ${scheduledCount} of ${activeStudents.length} scheduled`}
        sortedTerms={sortedTerms}
        activeTermId={activeTermId}
        onTermChange={changeTerm}
        showImport
        onImportClick={() => setImportOpen(true)}
      />

      {activeTermId && selectedTerm ? (
        <ScheduleImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          termId={activeTermId}
          termName={selectedTerm.name ?? "Selected term"}
        />
      ) : null}

      <ScheduleKpiCards
        termName={selectedTerm?.name ?? "—"}
        scheduledCount={scheduledCount}
        totalStudents={activeStudents.length}
        totalWeeklyHours={combinedWeeklyHours}
      />

      <div className={STUDENT_TERM_PAGE_GRID}>
        <StudentSelectionPanel
          disabled={!activeTermId}
          emptyMessage="Add a term before managing schedules."
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          filteredStudents={filteredStudents}
          selectedStudentId={selectedStudentId}
          onSelectStudent={selectStudent}
          showIndicator={hasSchedule}
          indicatorTitle="Has schedule"
        />

        <Card className="bg-card border-border min-w-0">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold uppercase tracking-wider">
                {selectedStudent
                  ? formatStudentName(selectedStudent)
                  : "Weekly schedule"}
              </CardTitle>
              {selectedStudent ? (
                <Badge
                  variant="secondary"
                  className={
                    hasSchedule(selectedStudent)
                      ? "bg-accent/20 text-accent"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {hasSchedule(selectedStudent) ? "Scheduled" : "No schedule"}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {!activeTermId ? (
              <ScheduleEditorEmptyState message="Select a term above to begin managing schedules." />
            ) : !selectedStudent ? (
              <ScheduleEditorEmptyState />
            ) : (
              <ScheduleEditorPanel
                key={`${selectedStudent.id}-${activeTermId}`}
                student={selectedStudent}
                initialBlocks={selectedScheduleData?.blocks ?? []}
                initialStartDate={selectedScheduleData?.schedule?.start_date}
                initialEndDate={selectedScheduleData?.schedule?.end_date}
                termStartDate={selectedTerm?.start_date}
                termEndDate={selectedTerm?.end_date}
                remoteShiftsAllowed={selectedTerm?.remote_shifts_allowed ?? false}
                onSave={handleSaveSchedule}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
