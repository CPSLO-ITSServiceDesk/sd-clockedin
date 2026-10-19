"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"

import { formatStudentName } from "@/components/admin/mock-students"
import {
  SCHEDULE_WEEKDAYS,
  type DraftScheduleBlock,
} from "@/components/admin/schedules/schedule-types"
import {
  formatDayShort,
  formatWeeklyHours,
  totalWeeklyHours,
} from "@/components/admin/schedules/schedule-utils"
import type { StudentAssistantFormValues } from "@/components/admin/students/student-assistant-form"
import {
  StudentEditPanel,
  StudentEditPanelEmpty,
} from "@/components/admin/students/student-edit-panel"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useTeamsSyncStatus } from "@/hooks/use-teams-sync"
import { apiBlockToDraft } from "@/lib/api/schedule-mappers"
import { scheduleBlocksApi } from "@/lib/api/scheduleBlocks"
import { schedulesApi } from "@/lib/api/schedules"
import {
  displayRoleToStudentRole,
  studentAssistantsApi,
  type StudentAssistant as ApiStudent,
} from "@/lib/api/student-assistants"
import { termsApi } from "@/lib/api/terms"
import { formatTime } from "@/lib/format-time"
import { queryKeys } from "@/lib/query-keys"
import {
  compareStudentsByRoleThenName,
  getStudentInitials,
  getStudentRole,
} from "@/lib/students/student-utils"
import { cn } from "@/lib/utils"

type RosterFilter = "active" | "lead" | "nocard" | "inactive" | "all"

const ROSTER_FILTERS: { value: RosterFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "lead", label: "Leads" },
  { value: "nocard", label: "Missing Polycard" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
]

const isLead = (student: ApiStudent) => getStudentRole(student) === "Student Lead"

const FILTER_PREDICATES: Record<RosterFilter, (_student: ApiStudent) => boolean> = {
  active: (student) => Boolean(student.is_active),
  lead: (student) => Boolean(student.is_active) && isLead(student),
  nocard: (student) => Boolean(student.is_active) && student.polycard_id == null,
  inactive: (student) => !student.is_active,
  all: () => true,
}

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-3 md:grid-cols-[minmax(0,1.8fr)_130px_110px_minmax(0,1.1fr)_84px]"

function toStudentFields(values: StudentAssistantFormValues) {
  const polycardId = values.polycard_id.trim()
  const workEmail = values.work_email.trim()
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    position: displayRoleToStudentRole(values.role),
    work_email: workEmail === "" ? null : workEmail,
    polycard_id: polycardId === "" ? null : Number(polycardId),
  }
}

function apiStudentToForm(student: ApiStudent): StudentAssistantFormValues {
  return {
    first_name: student.first_name ?? "",
    last_name: student.last_name ?? "",
    role: getStudentRole(student),
    polycard_id: student.polycard_id != null ? String(student.polycard_id) : "",
    work_email: student.work_email ?? "",
  }
}

function summarizeWeek(blocks: DraftScheduleBlock[]): string {
  if (blocks.length === 0) return "No schedule this term"
  const days = SCHEDULE_WEEKDAYS.filter((weekday) =>
    blocks.some((block) => block.day === weekday.value),
  ).map((weekday) => formatDayShort(weekday.value))
  return `${days.join(" · ")} — ${formatWeeklyHours(totalWeeklyHours(blocks))}`
}

function formatSyncedAt(value: string): string {
  const date = new Date(value)
  const today = new Date()
  const time = formatTime(value)
  if (date.toDateString() === today.toDateString()) return `today, ${time}`
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`
}

export function StudentsTable() {
  const queryClient = useQueryClient()
  const { data: students = [], isLoading } = useQuery({
    queryKey: queryKeys.students.all,
    queryFn: studentAssistantsApi.list,
  })
  const { data: terms = [] } = useQuery({ queryKey: queryKeys.terms.all, queryFn: termsApi.list })
  const { data: schedules = [] } = useQuery({
    queryKey: queryKeys.schedules.all,
    queryFn: schedulesApi.list,
  })
  const { data: allBlocks = [] } = useQuery({
    queryKey: queryKeys.scheduleBlocks.all,
    queryFn: scheduleBlocksApi.list,
  })

  const activeTerm = terms.find((term) => term.is_active) ?? null
  const { data: syncStatus } = useTeamsSyncStatus(activeTerm?.id ?? null)
  const fromTeams = Boolean(syncStatus?.graph_configured)

  // `null` selection with `adding` false falls back to the first visible row.
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<RosterFilter>("active")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ApiStudent | null>(null)

  const blocksByStudent = useMemo(() => {
    const map = new Map<number, DraftScheduleBlock[]>()
    if (!activeTerm) return map
    const scheduleOwner = new Map<number, number>()
    for (const schedule of schedules) {
      if (schedule.academic_term_id === activeTerm.id && schedule.student_assistant_id != null) {
        scheduleOwner.set(schedule.id, schedule.student_assistant_id)
      }
    }
    for (const block of allBlocks) {
      const owner = block.schedule_id != null ? scheduleOwner.get(block.schedule_id) : undefined
      const draft = owner != null ? apiBlockToDraft(block) : null
      if (owner == null || !draft) continue
      map.set(owner, [...(map.get(owner) ?? []), draft])
    }
    return map
  }, [activeTerm, schedules, allBlocks])

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return students
      .filter(FILTER_PREDICATES[filter])
      .filter((student) => {
        if (!query) return true
        return (
          formatStudentName(student).toLowerCase().includes(query) ||
          (student.work_email?.toLowerCase() ?? "").includes(query) ||
          (student.polycard_id?.toString() ?? "").includes(query)
        )
      })
      .sort(compareStudentsByRoleThenName)
  }, [students, filter, searchQuery])

  const selected = adding
    ? null
    : (students.find((student) => student.id === selectedId) ?? filteredStudents[0] ?? null)

  const invalidateStudents = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.students.all })

  const handleSubmit = async (values: StudentAssistantFormValues): Promise<boolean> => {
    setSaving(true)
    try {
      if (adding) {
        const created = await studentAssistantsApi.create(toStudentFields(values))
        await invalidateStudents()
        setAdding(false)
        setSelectedId(created.id)
        toast.success(`Added ${formatStudentName(created)}`)
      } else if (selected) {
        await studentAssistantsApi.update(selected.id, toStudentFields(values))
        await invalidateStudents()
        toast.success(`Saved ${values.first_name.trim()}'s details`)
      }
      return true
    } catch (err) {
      console.error("Save student failed:", err)
      toast.error("Failed to save student. Please try again.")
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (student: ApiStudent) => {
    try {
      await studentAssistantsApi.update(student.id, { is_active: !student.is_active })
      await invalidateStudents()
      toast.success(
        `${formatStudentName(student)} ${student.is_active ? "deactivated" : "reactivated"}`,
      )
    } catch (err) {
      console.error("Toggle student active failed:", err)
      toast.error("Failed to update student status.")
    }
  }

  const handleDelete = async (student: ApiStudent) => {
    try {
      await studentAssistantsApi.remove(student.id)
      setSelectedId(null)
      await Promise.all([
        invalidateStudents(),
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.all }),
      ])
    } catch (err) {
      console.error("Delete student failed:", err)
      toast.error("Failed to delete student.")
    }
  }

  const selectStudent = (student: ApiStudent) => {
    setAdding(false)
    setSelectedId(student.id)
  }

  const activeCount = students.filter((student) => student.is_active).length
  const syncedAt = syncStatus?.finished_at ?? null
  const subLine = fromTeams
    ? syncedAt
      ? `${activeCount} active · roster synced from Teams ${formatSyncedAt(syncedAt)}`
      : `${activeCount} active · waiting for first Teams sync`
    : `${activeCount} active`

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Students</h1>
        <p className="text-sm text-muted-foreground">Loading students...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Students</h1>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={cn(
                "size-2 rounded-full",
                fromTeams && syncStatus?.status !== "error" ? "bg-[var(--status-online)]" : "bg-[var(--status-offline)]",
              )}
            />
            {subLine}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-[38px] items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-[15px]" strokeWidth={2.25} />
          Add student
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex h-[38px] w-full items-center gap-2 rounded-full border border-border bg-card px-3.5 sm:w-[320px]">
          <Search className="size-[15px] text-muted-foreground" strokeWidth={2.25} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search name, email or Polycard ID"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        {ROSTER_FILTERS.map((option) => {
          const on = filter === option.value
          const count = students.filter(FILTER_PREDICATES[option.value]).length
          const warn = option.value === "nocard" && count > 0
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(option.value)}
              className={cn(
                "flex h-[34px] items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                on
                  ? warn
                    ? "border-transparent bg-amber-700 text-white"
                    : "border-transparent bg-primary text-primary-foreground"
                  : warn
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200"
                    : "border-border bg-card hover:bg-muted",
              )}
            >
              {option.label}
              <span className="font-mono text-xs opacity-75">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-[20px] border border-border bg-card">
          <div
            className={cn(
              ROW_GRID,
              "border-b border-border/60 bg-muted/40 px-[18px] py-2.5 text-xs font-semibold text-muted-foreground",
            )}
          >
            <span>Student</span>
            <span className="hidden md:block">Polycard ID</span>
            <span className="hidden md:block">Role</span>
            <span className="hidden md:block">Weekly schedule</span>
            <span>Status</span>
          </div>

          {filteredStudents.length === 0 ? (
            <p className="px-[18px] py-10 text-center text-sm text-muted-foreground">
              {students.length === 0
                ? "No students yet. Run a Teams sync or add one."
                : "No students match these filters."}
            </p>
          ) : (
            filteredStudents.map((student) => {
              const lead = isLead(student)
              const active = Boolean(student.is_active)
              const isSelected = student.id === selected?.id
              return (
                <button
                  key={student.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectStudent(student)}
                  className={cn(
                    ROW_GRID,
                    "w-full items-center border-b border-border/60 px-[18px] py-2.5 text-left last:border-0",
                    isSelected ? "bg-accent/10" : "hover:bg-muted/50",
                    !active && "opacity-65",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : lead
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                            : "bg-muted text-foreground",
                      )}
                    >
                      {getStudentInitials(student)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold">{formatStudentName(student)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {student.work_email ?? "No work email"}
                      </span>
                    </span>
                  </div>
                  <span className="hidden justify-self-start md:block">
                    {student.polycard_id != null ? (
                      <span className="font-mono text-[13px]">{student.polycard_id}</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[13px] font-bold text-amber-800 dark:text-amber-200">
                        Missing
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "hidden items-center gap-1.5 text-[13px] md:flex",
                      lead ? "font-bold" : "font-medium",
                    )}
                  >
                    {lead ? <span className="text-amber-600">★</span> : null}
                    {lead ? "Lead" : "Assistant"}
                  </span>
                  <span className="hidden truncate text-[13px] text-muted-foreground md:block">
                    {summarizeWeek(blocksByStudent.get(student.id) ?? [])}
                  </span>
                  <span
                    className={cn(
                      "justify-self-start rounded-full px-2 py-0.5 text-[11px] font-bold",
                      active ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {active ? "Active" : "Inactive"}
                  </span>
                </button>
              )
            })
          )}
        </section>

        {adding ? (
          <StudentEditPanel
            key="new"
            studentId={null}
            initialValues={null}
            isActive
            schedule={null}
            existingStudents={students}
            isSaving={saving}
            onSubmit={handleSubmit}
            onToggleActive={() => {}}
            onDelete={() => {}}
            onCancel={() => setAdding(false)}
          />
        ) : selected ? (
          <StudentEditPanel
            key={selected.id}
            studentId={selected.id}
            initialValues={apiStudentToForm(selected)}
            isActive={Boolean(selected.is_active)}
            schedule={{
              blocks: blocksByStudent.get(selected.id) ?? [],
              termName: activeTerm?.name ?? null,
              fromTeams,
            }}
            existingStudents={students}
            isSaving={saving}
            onSubmit={handleSubmit}
            onToggleActive={() => handleToggleActive(selected)}
            onDelete={() => setDeleteTarget(selected)}
            onCancel={() => {}}
          />
        ) : (
          <StudentEditPanelEmpty />
        )}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${formatStudentName(deleteTarget)} will be permanently removed along with their schedules. Deactivating keeps their history instead.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) handleDelete(deleteTarget)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
