"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Calendar,
  Search,
  Star,
} from "lucide-react"
import {
  MOCK_STUDENTS,
  formatStudentName,
} from "@/components/admin/mock-students"
import type { StudentAssistant } from "@/components/admin/students/student-assistant-form"
import {
  ScheduleEditorEmptyState,
  ScheduleEditorPanel,
} from "@/components/admin/schedules/schedule-editor-panel"
import { ScheduleKpiCards } from "@/components/admin/schedules/schedule-kpi-cards"
import { useScheduleStore } from "@/components/admin/schedules/mock-schedule-store"
import { totalWeeklyHours } from "@/components/admin/schedules/schedule-utils"
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

export function SchedulesManager() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { terms, getScheduleForStudentTerm } = useScheduleStore()

  const defaultTermId =
    terms.find((term) => term.is_active)?.id ?? terms[0]?.id ?? 1

  const [termId, setTermId] = useState(defaultTermId)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")

  const activeStudents = useMemo(
    () => MOCK_STUDENTS.filter((student) => student.is_active),
    [],
  )

  const selectedStudent = useMemo(
    () =>
      activeStudents.find((student) => student.id === selectedStudentId) ?? null,
    [activeStudents, selectedStudentId],
  )

  useEffect(() => {
    const studentParam = searchParams.get("student")
    if (!studentParam) return

    const parsed = Number(studentParam)
    if (Number.isNaN(parsed)) return

    const exists = activeStudents.some((student) => student.id === parsed)
    if (exists) {
      setSelectedStudentId(parsed)
    }
  }, [activeStudents, searchParams])

  const selectStudent = (student: StudentAssistant | null) => {
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

  const hasSchedule = (student: StudentAssistant) => {
    const { blocks } = getScheduleForStudentTerm(student.id, termId)
    return blocks.length > 0
  }

  const scheduledCount = activeStudents.filter((student) =>
    hasSchedule(student),
  ).length

  const combinedWeeklyHours = activeStudents.reduce((sum, student) => {
    const { blocks } = getScheduleForStudentTerm(student.id, termId)
    return sum + totalWeeklyHours(blocks)
  }, 0)

  const selectedTerm = terms.find((term) => term.id === termId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground text-sm">
            Manage weekly shifts by academic term · {scheduledCount} of{" "}
            {activeStudents.length} scheduled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="text-muted-foreground size-4" />
          <Select
            value={String(termId)}
            onValueChange={(value) => setTermId(Number(value))}
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
            {!selectedStudent ? (
              <ScheduleEditorEmptyState />
            ) : (
              <ScheduleEditorPanel
                key={`${selectedStudent.id}-${termId}`}
                student={selectedStudent}
                termId={termId}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
