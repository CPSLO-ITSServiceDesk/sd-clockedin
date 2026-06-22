"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Calendar,
  Search,
  Star,
  Upload,
} from "lucide-react"
import { formatStudentName } from "@/components/admin/mock-students"
import {
  ScheduleEditorEmptyState,
  ScheduleEditorPanel,
} from "@/components/admin/schedules/schedule-editor-panel"
import { ScheduleKpiCards } from "@/components/admin/schedules/schedule-kpi-cards"
import { ScheduleImportDialog } from "@/components/admin/schedules/schedule-import-dialog"
import type { DraftScheduleBlock } from "@/components/admin/schedules/schedule-types"
import { totalWeeklyHours } from "@/components/admin/schedules/schedule-utils"
import {
  apiBlockToDraft,
  apiStudentToScheduleStudent,
  type ScheduleStudent,
} from "@/lib/api/schedule-mappers"
import { scheduleBlocksApi } from "@/lib/api/scheduleBlocks"
import { schedulesApi } from "@/lib/api/schedules"
import { studentAssistantsApi } from "@/lib/api/student-assistants"
import { termsApi } from "@/lib/api/terms"
import { queryKeys } from "@/lib/query-keys"
import { saveStudentTermSchedule } from "@/lib/schedules/persistence"
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
import { sortTermsByActiveStatus } from "@/components/admin/terms/term-types"

type RoleFilter = "all" | "lead" | "assistant"

export function SchedulesManager() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

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

  const { data: allBlocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: queryKeys.scheduleBlocks.all,
    queryFn: scheduleBlocksApi.list,
  })

  const defaultTermId = useMemo(
    () => terms.find((term) => term.is_active)?.id ?? terms[0]?.id ?? null,
    [terms],
  )

  const sortedTerms = useMemo(() => sortTermsByActiveStatus(terms), [terms])

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
  const [importOpen, setImportOpen] = useState(false)

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

  const getScheduleForStudentTerm = useCallback(
    (studentId: number, term: number) => {
      const schedule =
        schedules.find(
          (entry) =>
            entry.student_assistant_id === studentId &&
            entry.academic_term_id === term,
        ) ?? null

      if (!schedule) {
        return { schedule: null, blocks: [] as DraftScheduleBlock[] }
      }

      const blocks = allBlocks
        .filter((block) => block.schedule_id === schedule.id)
        .map(apiBlockToDraft)
        .filter((block): block is DraftScheduleBlock => block !== null)

      return { schedule, blocks }
    },
    [allBlocks, schedules],
  )

  const selectStudent = (student: ScheduleStudent | null) => {
    setSelectedStudentId(student?.id ?? null)

    const params = new URLSearchParams(searchParams.toString())
    if (student) {
      params.set("student", String(student.id))
    } else {
      params.delete("student")
    }

    const query = params.toString()
    router.replace(query ? `/admin/schedules?${query}` : "/admin/schedules", {
      scroll: false,
    })
  }

  const handleSaveSchedule = async (draftBlocks: DraftScheduleBlock[]) => {
    if (!selectedStudent || !activeTermId) return

    const { schedule } = getScheduleForStudentTerm(
      selectedStudent.id,
      activeTermId,
    )

    await saveStudentTermSchedule(
      selectedStudent.id,
      activeTermId,
      draftBlocks,
      schedule,
      allBlocks.filter((block) =>
        schedule ? block.schedule_id === schedule.id : false,
      ),
    )

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.all }),
    ])
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

  const hasSchedule = (student: ScheduleStudent) => {
    if (!activeTermId) return false
    const { blocks } = getScheduleForStudentTerm(student.id, activeTermId)
    return blocks.length > 0
  }

  const scheduledCount = activeTermId
    ? activeStudents.filter((student) => hasSchedule(student)).length
    : 0

  const combinedWeeklyHours = activeTermId
    ? activeStudents.reduce((sum, student) => {
        const { blocks } = getScheduleForStudentTerm(student.id, activeTermId)
        return sum + totalWeeklyHours(blocks)
      }, 0)
    : 0

  const selectedTerm = terms.find((term) => term.id === activeTermId)
  const selectedScheduleData =
    selectedStudent && activeTermId
      ? getScheduleForStudentTerm(selectedStudent.id, activeTermId)
      : null

  const isLoading =
    termsLoading || studentsLoading || schedulesLoading || blocksLoading

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground text-sm">
            Select a term, then a student to edit their weekly schedule ·{" "}
            {scheduledCount} of {activeStudents.length} scheduled
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!activeTermId}
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-4" />
            Import schedule
          </Button>
          <Calendar className="text-muted-foreground size-4" />
          <Select
            value={activeTermId ? String(activeTermId) : undefined}
            onValueChange={(value) => {
              setTermId(Number(value))
              setSelectedStudentId(null)
              router.replace("/admin/schedules", { scroll: false })
            }}
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
                Add a term before managing schedules.
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
                              {hasSchedule(student) ? (
                                <span
                                  className="size-2 rounded-full bg-accent ring-2 ring-accent/20"
                                  title="Has schedule"
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
                onSave={handleSaveSchedule}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
