"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Calendar, Search, Star } from "lucide-react"
import { formatStudentName } from "@/components/admin/mock-students"
import { StudentRecordsKpiCards } from "@/components/admin/student-records/student-records-kpi-cards"
import {
  TimeEntriesEmptyState,
  TimeEntriesPanel,
} from "@/components/admin/student-records/time-entries-panel"
import {
  entryMatchesTerm,
  getEntryDurationMinutes,
  getStudentTermBlockIds,
} from "@/components/admin/student-records/student-records-utils"
import {
  apiStudentToScheduleStudent,
  type ScheduleStudent,
} from "@/lib/api/schedule-mappers"
import { scheduleBlocksApi } from "@/lib/api/scheduleBlocks"
import { schedulesApi } from "@/lib/api/schedules"
import { studentAssistantsApi } from "@/lib/api/student-assistants"
import { termsApi } from "@/lib/api/terms"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { queryKeys } from "@/lib/query-keys"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type RoleFilter = "all" | "lead" | "assistant"

export function StudentRecordsManager() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data: terms = [], isLoading: termsLoading } = useQuery({
    queryKey: queryKeys.terms.all,
    queryFn: termsApi.list,
  })

  const { data: apiStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: queryKeys.students.all,
    queryFn: studentAssistantsApi.list,
  })

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: queryKeys.schedules.all,
    queryFn: schedulesApi.list,
  })

  const { data: scheduleBlocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: queryKeys.scheduleBlocks.all,
    queryFn: scheduleBlocksApi.list,
  })

  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: queryKeys.timeEntries.all,
    queryFn: timeEntriesApi.list,
  })

  const defaultTermId = useMemo(
    () => terms.find((term) => term.is_active)?.id ?? terms[0]?.id ?? null,
    [terms],
  )

  const [termId, setTermId] = useState<number | null>(null)
  const activeTermId = termId ?? defaultTermId

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(() => {
    const studentParam = searchParams.get("student")
    if (!studentParam) return null
    const parsed = Number(studentParam)
    return Number.isNaN(parsed) ? null : parsed
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")

  const activeStudents = useMemo(
    () =>
      apiStudents
        .filter((student) => student.is_active)
        .map(apiStudentToScheduleStudent),
    [apiStudents],
  )

  const selectedStudent = useMemo(
    () =>
      activeStudents.find((student) => student.id === selectedStudentId) ?? null,
    [activeStudents, selectedStudentId],
  )

  const selectedTerm = terms.find((term) => term.id === activeTermId)

  const selectStudent = (student: ScheduleStudent | null) => {
    setSelectedStudentId(student?.id ?? null)

    const params = new URLSearchParams(searchParams.toString())
    if (student) {
      params.set("student", String(student.id))
    } else {
      params.delete("student")
    }

    const query = params.toString()
    router.replace(
      query ? `/admin/studentrecords?${query}` : "/admin/studentrecords",
      { scroll: false },
    )
  }

  const filteredStudents = useMemo(() => {
    let eligible = [...activeStudents]

    if (roleFilter === "lead") {
      eligible = eligible.filter((student) => student.role === "Student Lead")
    } else if (roleFilter === "assistant") {
      eligible = eligible.filter(
        (student) => student.role === "Student Assistant",
      )
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      eligible = eligible.filter((student) => {
        const name = formatStudentName(student).toLowerCase()
        const cardId = student.polycard_id?.toString() ?? ""
        return name.includes(query) || cardId.includes(query)
      })
    }

    return eligible.sort((a, b) =>
      formatStudentName(a).localeCompare(formatStudentName(b)),
    )
  }, [activeStudents, roleFilter, searchQuery])

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

  const hasEntriesInTerm = (student: ScheduleStudent) => {
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
  }

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

  const isLoading =
    termsLoading ||
    studentsLoading ||
    schedulesLoading ||
    blocksLoading ||
    entriesLoading

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Records</h1>
          <p className="text-muted-foreground text-sm">
            Select a term, then a student to manage clock in/out entries ·{" "}
            {studentsWithEntries} of {activeStudents.length} with entries
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="text-muted-foreground size-4" />
          <Select
            value={activeTermId ? String(activeTermId) : undefined}
            onValueChange={(value) => {
              setTermId(Number(value))
              setSelectedStudentId(null)
              router.replace("/admin/studentrecords", { scroll: false })
            }}
          >
            <SelectTrigger className="w-[200px] border-border bg-input">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((term) => (
                <SelectItem key={term.id} value={String(term.id)}>
                  {term.name}
                  {term.is_active ? " (Active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <StudentRecordsKpiCards
        termName={selectedTerm?.name ?? "—"}
        studentsWithEntries={studentsWithEntries}
        totalStudents={activeStudents.length}
        totalEntries={termScopedEntries.length}
        totalMinutes={totalMinutes}
        openEntries={openEntries}
      />

      <div className="grid min-h-[620px] grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="bg-card border-border h-fit lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">
              Students
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!activeTermId ? (
              <div className="text-muted-foreground py-10 text-center text-sm">
                Add a term before viewing student records.
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="border-border bg-input pl-10"
                  />
                </div>

                <div className="inline-flex w-full rounded-lg border border-border bg-muted/40 p-[3px]">
                  {(
                    [
                      ["all", "All"],
                      ["lead", "Lead"],
                      ["assistant", "Assistant"],
                    ] as const
                  ).map(([filter, label]) => (
                    <Button
                      key={filter}
                      type="button"
                      size="sm"
                      variant={roleFilter === filter ? "default" : "ghost"}
                      className={cn(
                        "h-7 flex-1 px-2 text-xs",
                        roleFilter !== filter && "text-muted-foreground",
                      )}
                      onClick={() => setRoleFilter(filter)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                <p className="text-muted-foreground text-xs uppercase tracking-wider">
                  {filteredStudents.length} students
                </p>

                <div className="max-h-[560px] space-y-1 overflow-y-auto pr-1">
                  {filteredStudents.length === 0 ? (
                    <div className="text-muted-foreground py-10 text-center text-sm">
                      No students found
                    </div>
                  ) : (
                    filteredStudents.map((student) => {
                      const isSelected = selectedStudentId === student.id

                      return (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => selectStudent(student)}
                          className={cn(
                            "w-full rounded-sm border px-3 py-2.5 text-left transition-colors",
                            isSelected
                              ? "border-accent/30 bg-accent/10"
                              : "border-transparent hover:border-border hover:bg-muted/40",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {formatStudentName(student)}
                              </p>
                              <p className="text-muted-foreground truncate text-xs">
                                {student.role}
                                {student.polycard_id
                                  ? ` · ${student.polycard_id}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {student.role === "Student Lead" ? (
                                <Star className="size-3 text-yellow-500" />
                              ) : null}
                              {hasEntriesInTerm(student) ? (
                                <span
                                  className="size-2 rounded-full bg-accent ring-2 ring-accent/20"
                                  title="Has time entries"
                                />
                              ) : null}
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border lg:col-span-2">
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
              <TimeEntriesPanel
                key={`${selectedStudent.id}-${activeTermId}`}
                student={selectedStudent}
                term={selectedTerm}
                termId={activeTermId}
                schedules={schedules}
                scheduleBlocks={scheduleBlocks}
                timeEntries={timeEntries}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
