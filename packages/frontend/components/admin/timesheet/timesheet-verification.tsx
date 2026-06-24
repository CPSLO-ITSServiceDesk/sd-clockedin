"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatStudentName } from "@/components/admin/mock-students"
import { aggregateHoursByDay } from "@/components/admin/student-records/student-records-utils"
import {
  STUDENT_TERM_PAGE_GRID,
  StudentSelectionPanel,
} from "@/components/admin/student-term/student-selection-panel"
import { useStudentSelection } from "@/hooks/use-student-selection"
import { scheduleBlocksApi } from "@/lib/api/scheduleBlocks"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TimesheetGrid } from "./timesheet-grid"

function monthRange(year: number, month: number) {
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`
  const nextMonth = new Date(year, month + 1, 1)
  const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`
  return { startDate, endDate }
}

export function TimesheetVerification() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const {
    isLoading,
    activeStudents,
    selectedStudentId,
    selectedStudent,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    filteredStudents,
    selectStudent,
  } = useStudentSelection({ basePath: "/admin/timesheet-verification" })

  const viewDate = useMemo(() => {
    const monthParam = searchParams.get("month")
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [year, month] = monthParam.split("-").map(Number)
      return new Date(year, month - 1, 1)
    }
    return new Date()
  }, [searchParams])

  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()
  const { startDate, endDate } = monthRange(viewYear, viewMonth)

  const { data: timeEntries = [], isLoading: timeEntriesLoading } = useQuery({
    queryKey: queryKeys.timeEntries.all,
    queryFn: timeEntriesApi.list,
    enabled: !!selectedStudentId,
  })

  const { data: scheduleBlocks = [], isLoading: scheduleBlocksLoading } = useQuery({
    queryKey: queryKeys.scheduleBlocks.all,
    queryFn: scheduleBlocksApi.list,
    enabled: !!selectedStudentId,
  })

  const hoursData = useMemo(
    () =>
      selectedStudentId
        ? aggregateHoursByDay(timeEntries, selectedStudentId, startDate, endDate)
        : {},
    [timeEntries, selectedStudentId, startDate, endDate],
  )

  const shiftsLoading = timeEntriesLoading || scheduleBlocksLoading

  const changeMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    const params = new URLSearchParams(searchParams.toString())
    params.set(
      "month",
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
    )
    router.replace(`/admin/timesheet-verification?${params.toString()}`, {
      scroll: false,
    })
  }

  const monthLabel = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timesheet Verification</h1>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Timesheet Verification</h1>
        <p className="text-muted-foreground text-sm">
          Select a student to verify hours for {monthLabel} · {activeStudents.length}{" "}
          active students
        </p>
      </div>

      <div className={STUDENT_TERM_PAGE_GRID}>
        <StudentSelectionPanel
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          filteredStudents={filteredStudents}
          selectedStudentId={selectedStudentId}
          onSelectStudent={selectStudent}
        />

        <Card className="bg-card border-border min-w-0">
          <CardHeader className="border-b border-border py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle
                  className={cn(
                    "truncate",
                    selectedStudent
                      ? "text-lg font-semibold uppercase tracking-wider"
                      : "text-base font-semibold",
                  )}
                >
                  {selectedStudent
                    ? formatStudentName(selectedStudent)
                    : "Monthly timesheet"}
                </CardTitle>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => changeMonth(-1)}
                >
                  <ChevronLeft className="size-4" />
                  <span className="sr-only">Previous month</span>
                </Button>
                <span className="min-w-[7.5rem] text-center text-sm font-medium tabular-nums">
                  {monthLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => changeMonth(1)}
                >
                  <ChevronRight className="size-4" />
                  <span className="sr-only">Next month</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {!selectedStudent ? (
              <div className="text-muted-foreground py-10 text-center text-sm">
                Select a student to view their timesheet.
              </div>
            ) : shiftsLoading ? (
              <div className="text-muted-foreground py-10 text-center text-sm">
                Loading timesheet data...
              </div>
            ) : (
              <TimesheetGrid
                year={viewYear}
                month={viewMonth}
                hoursData={hoursData}
                studentId={selectedStudent.id}
                timeEntries={timeEntries}
                scheduleBlocks={scheduleBlocks}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
