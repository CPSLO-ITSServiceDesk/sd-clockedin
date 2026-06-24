"use client"

import {
  formatBlockLabel,
  formatDuration,
  getEntryDurationMinutes,
  getStudentEntriesForDay,
} from "@/components/admin/student-records/student-records-utils"
import type { ScheduleBlock } from "@/lib/api/scheduleBlocks"
import type { TimeEntry } from "@/lib/api/time-entries"
import { formatTime } from "@/lib/format-time"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface TimesheetDayShiftsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dateKey: string | null
  studentId: number
  timeEntries: TimeEntry[]
  scheduleBlocks: ScheduleBlock[]
}

export function TimesheetDayShiftsDialog({
  open,
  onOpenChange,
  dateKey,
  studentId,
  timeEntries,
  scheduleBlocks,
}: Readonly<TimesheetDayShiftsDialogProps>) {
  const dayEntries =
    dateKey && studentId
      ? getStudentEntriesForDay(timeEntries, studentId, dateKey)
      : []

  const blockById = new Map(scheduleBlocks.map((block) => [block.id, block]))

  const dayLabel = dateKey
    ? new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider">Shifts</DialogTitle>
          <DialogDescription>{dayLabel}</DialogDescription>
        </DialogHeader>

        {dayEntries.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No shifts recorded for this day.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayEntries.map((entry) => {
                const block = entry.schedule_block_id
                  ? blockById.get(entry.schedule_block_id)
                  : undefined
                const isOpen = !entry.clock_out

                return (
                  <TableRow key={entry.id} className="border-border">
                    <TableCell className="text-muted-foreground text-sm">
                      {block ? formatBlockLabel(block) : "Custom shift"}
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
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}
