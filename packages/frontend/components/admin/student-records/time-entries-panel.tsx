"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Clock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { formatStudentName } from "@/components/admin/mock-students"
import {
  TimeEntryFormDialog,
  timeEntryFormToPayload,
  type TimeEntryFormValues,
} from "@/components/admin/student-records/time-entry-form-dialog"
import {
  entryMatchesTerm,
  formatBlockLabel,
  formatDuration,
  getEntryDateLabel,
  getEntryDurationMinutes,
  getStudentTermBlockIds,
  sortTimeEntries,
} from "@/components/admin/student-records/student-records-utils"
import type { ScheduleStudent } from "@/lib/api/schedule-mappers"
import type { ScheduleBlock } from "@/lib/api/scheduleBlocks"
import type { Schedule } from "@/lib/api/schedules"
import type { Term } from "@/lib/api/terms"
import { timeEntriesApi, type TimeEntry } from "@/lib/api/time-entries"
import { formatTime } from "@/lib/format-time"
import { queryKeys } from "@/lib/query-keys"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

  const studentEntries = sortTimeEntries(
    timeEntries.filter(
      (entry) =>
        entry.student_assistant_id === student.id &&
        entryMatchesTerm(entry, term, termBlockIds),
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
    await timeEntriesApi.update(
      editingEntry.id,
      timeEntryFormToPayload(values, student.id),
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">
            {studentEntries.length} entries for {term?.name ?? "selected term"}
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreateDialog}>
          <Plus className="size-4" />
          Add entry
        </Button>
      </div>

      {studentEntries.length === 0 ? (
        <div className="text-muted-foreground flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center text-sm">
          <p>No clock in/out entries for this student in the selected term.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={openCreateDialog}
          >
            <Plus className="size-4" />
            Add first entry
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">
                  Date
                </TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">
                  Shift
                </TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">
                  Clock in
                </TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">
                  Clock out
                </TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">
                  Duration
                </TableHead>
                <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentEntries.map((entry) => {
                const block = entry.schedule_block_id
                  ? blockById.get(entry.schedule_block_id)
                  : undefined
                const isOpen = !entry.clock_out

                return (
                  <TableRow key={entry.id} className="border-border">
                    <TableCell className="text-sm">
                      {getEntryDateLabel(entry.clock_in)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {block ? formatBlockLabel(block) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.clock_in ? formatTime(entry.clock_in) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.clock_out ? formatTime(entry.clock_out) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDuration(getEntryDurationMinutes(entry))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          isOpen
                            ? "bg-accent/20 text-accent"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {isOpen ? "Open" : "Closed"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(entry)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          {isOpen ? (
                            <DropdownMenuItem onClick={() => handleClockOut(entry)}>
                              <LogOut className="size-4" />
                              Clock out now
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(entry)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
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
