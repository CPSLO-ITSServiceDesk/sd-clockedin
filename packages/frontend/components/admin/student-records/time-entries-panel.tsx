"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Clock, Pencil, Plus, Trash2 } from "lucide-react"
import { formatStudentName } from "@/components/admin/mock-students"
import {
  TimeEntryFormDialog,
  timeEntryFormToPayload,
  timeEntryFormToPatchPayload,
  type TimeEntryFormValues,
} from "@/components/admin/student-records/time-entry-form-dialog"
import {
  entryMatchesTerm,
  formatDuration,
  getEntryDateLabel,
  getEntryDurationMinutes,
  getStudentTermBlockIds,
  getStudentTermSchedule,
  sortTimeEntries,
} from "@/components/admin/student-records/student-records-utils"
import type { ScheduleStudent } from "@/lib/api/schedule-mappers"
import type { ScheduleBlock } from "@/lib/api/scheduleBlocks"
import type { Schedule } from "@/lib/api/schedules"
import type { Term } from "@/lib/api/terms"
import { timeEntriesApi, type TimeEntry } from "@/lib/api/time-entries"
import { formatTime, timeToMinutes } from "@/lib/format-time"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
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
const ENTRY_GRID =
  "grid grid-cols-[100px_minmax(0,1fr)_84px_84px_76px_70px_170px] gap-3"

/** Clock-ins more than this many minutes after the shift start count as late. */
const LATE_GRACE_MINUTES = 10

function compactTime(value: string): string {
  const minutes = timeToMinutes(value)
  const hour = Math.floor(minutes / 60)
  const rest = String(minutes % 60).padStart(2, "0")
  return `${hour % 12 || 12}:${rest}${hour < 12 ? "a" : "p"}`
}

function formatBlockRange(block: ScheduleBlock): string {
  if (!block.start_time || !block.end_time) return "—"
  return `${compactTime(block.start_time)}–${compactTime(block.end_time)}`
}

function formatEntryDate(clockIn: string | null): string {
  if (!clockIn) return "—"
  const date = new Date(clockIn)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function isLateClockIn(entry: TimeEntry, block: ScheduleBlock | undefined): boolean {
  if (!block?.start_time || !entry.clock_in) return false
  const clockIn = new Date(entry.clock_in)
  if (Number.isNaN(clockIn.getTime())) return false
  const clockInMinutes = clockIn.getHours() * 60 + clockIn.getMinutes()
  return clockInMinutes > timeToMinutes(block.start_time) + LATE_GRACE_MINUTES
}

interface TimeEntriesPanelProps {
  student: ScheduleStudent | null
  term: Term | undefined
  termId: number | null
  schedules: Schedule[]
  scheduleBlocks: ScheduleBlock[]
  timeEntries: TimeEntry[]
}

export function TimeEntriesEmptyState({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-border bg-muted/40">
        <Clock className="text-muted-foreground size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">No student selected</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {message ??
            "Choose a student from the list to view and manage their clock in/out entries."}
        </p>
      </div>
    </div>
  )
}

export function TimeEntriesPanel({
  student,
  term,
  termId,
  schedules,
  scheduleBlocks,
  timeEntries,
}: TimeEntriesPanelProps) {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null)

  if (!student || !termId) {
    return (
      <TimeEntriesEmptyState
        message={
          !termId
            ? "Select a term above to begin managing time entries."
            : undefined
        }
      />
    )
  }

  const studentBlocks = getStudentBlocksForTerm(
    student.id,
    termId,
    schedules,
    scheduleBlocks,
  )
  const termBlockIds = new Set(studentBlocks.map((block) => block.id))
  const schedule = getStudentTermSchedule(student.id, termId, schedules)

  const studentEntries = sortTimeEntries(
    timeEntries.filter(
      (entry) =>
        entry.student_assistant_id === student.id &&
        entryMatchesTerm(entry, term, termBlockIds, schedule),
    ),
  )

  const blockById = new Map(scheduleBlocks.map((block) => [block.id, block]))

  const invalidateTimeData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.todayShifts.all }),
    ])
  }

  const handleCreate = async (values: TimeEntryFormValues) => {
    await timeEntriesApi.create(timeEntryFormToPayload(values, student.id))
    await invalidateTimeData()
  }

  const handleUpdate = async (values: TimeEntryFormValues) => {
    if (!editingEntry) return
    await timeEntriesApi.patch(
      editingEntry.id,
      timeEntryFormToPatchPayload(values, student.id, editingEntry),
    )
    await invalidateTimeData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await timeEntriesApi.remove(deleteTarget.id)
    setDeleteTarget(null)
    await invalidateTimeData()
  }

  const handleClockOut = async (entry: TimeEntry) => {
    if (!entry.schedule_block_id) {
      await timeEntriesApi.update(entry.id, {
        clock_out: new Date().toISOString(),
      })
    } else {
      await timeEntriesApi.closeOpen(
        entry.schedule_block_id,
        student.id,
      )
    }
    await invalidateTimeData()
  }

  const openCreateDialog = () => {
    setEditingEntry(null)
    setFormOpen(true)
  }

  const openEditDialog = (entry: TimeEntry) => {
    setEditingEntry(entry)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-3 px-[22px] pt-4 pb-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">
          {studentEntries.length} entries for {term?.name ?? "selected term"}
        </span>
        <button
          type="button"
          onClick={openCreateDialog}
          className="flex h-[34px] items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-3.5" strokeWidth={2.25} />
          Add entry
        </button>
      </div>

      {studentEntries.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground">
          No clock in/out entries for this student in the selected term.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <div className="min-w-[760px]">
            <div
              className={cn(
                ENTRY_GRID,
                "border-b border-border/60 bg-muted/40 px-[18px] py-2.5 text-xs font-semibold text-muted-foreground",
              )}
            >
              <span>Date</span>
              <span>Shift</span>
              <span>Clock in</span>
              <span>Clock out</span>
              <span>Duration</span>
              <span>Status</span>
              <span />
            </div>
            {studentEntries.map((entry) => {
              const block = entry.schedule_block_id
                ? blockById.get(entry.schedule_block_id)
                : undefined
              const isOpen = !entry.clock_out
              const late = isLateClockIn(entry, block)

              return (
                <div
                  key={entry.id}
                  className={cn(
                    ENTRY_GRID,
                    "items-center border-b border-border/60 px-[18px] py-[9px] last:border-0 hover:bg-muted/40",
                  )}
                >
                  <span className="text-sm font-semibold">{formatEntryDate(entry.clock_in)}</span>
                  <span
                    className={cn(
                      "truncate text-[13px]",
                      block ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {block ? formatBlockRange(block) : "Unscheduled"}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[13px]",
                      late && "text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {entry.clock_in ? formatTime(entry.clock_in) : "—"}
                  </span>
                  <span className="font-mono text-[13px]">
                    {entry.clock_out ? formatTime(entry.clock_out) : "—"}
                  </span>
                  <span className="font-mono text-[13px] text-muted-foreground">
                    {isOpen ? "running" : formatDuration(getEntryDurationMinutes(entry))}
                  </span>
                  <span
                    className={cn(
                      "justify-self-start rounded-full px-2 py-0.5 text-[11px] font-bold",
                      isOpen ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isOpen ? "Open" : "Closed"}
                  </span>
                  <div className="flex items-center justify-end gap-1.5">
                    {isOpen ? (
                      <button
                        type="button"
                        onClick={() => handleClockOut(entry)}
                        className="h-7 shrink-0 whitespace-nowrap rounded-full border border-accent/30 bg-accent/10 px-3.5 text-xs font-bold text-accent hover:bg-accent/20"
                      >
                        Clock out
                      </button>
                    ) : null}
                    <button
                      type="button"
                      title="Edit"
                      aria-label="Edit entry"
                      onClick={() => openEditDialog(entry)}
                      className="flex size-7 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
                    >
                      <Pencil className="size-[13px]" strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      aria-label="Delete entry"
                      onClick={() => setDeleteTarget(entry)}
                      className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-[13px]" strokeWidth={2.25} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <TimeEntryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={editingEntry ? "edit" : "create"}
        studentName={formatStudentName(student)}
        scheduleBlocks={studentBlocks}
        initialEntry={editingEntry}
        onSubmit={editingEntry ? handleUpdate : handleCreate}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete time entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the clock in/out record for{" "}
              {getEntryDateLabel(deleteTarget?.clock_in ?? null)}. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function getStudentBlocksForTerm(
  studentId: number,
  termId: number,
  schedules: Schedule[],
  scheduleBlocks: ScheduleBlock[],
): ScheduleBlock[] {
  const blockIds = getStudentTermBlockIds(
    studentId,
    termId,
    schedules,
    scheduleBlocks,
  )

  return scheduleBlocks.filter((block) => blockIds.has(block.id))
}
