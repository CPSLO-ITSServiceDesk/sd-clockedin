"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { DoorOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { formatTime } from "@/lib/format-time"
import { queryKeys } from "@/lib/query-keys"
import { isDuringLastWorkingHour } from "@/lib/shifts/dashboard-stats"
import {
  formatShiftName,
  getClockedInStudents,
  getShiftInitials,
  getTodayDay,
  type TodayShift,
} from "@/lib/shifts/today-shifts"

export function ClockedInTable() {
  const queryClient = useQueryClient()
  const { shifts, isLoading, error } = useTodayShiftList()
  const clockedIn = getClockedInStudents(shifts)
  const [now, setNow] = useState(() => new Date())
  const [confirmTarget, setConfirmTarget] = useState<TodayShift | null>(null)
  const [clockOutAllOpen, setClockOutAllOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const showClockOutAll = isDuringLastWorkingHour(now)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const handleConfirmClockOut = async () => {
    if (!confirmTarget || submitting) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      await timeEntriesApi.closeOpenByAssistant(confirmTarget.studentAssistantId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.todayShifts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all }),
      ])
      setConfirmTarget(null)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClockOutAll = async () => {
    if (submitting || clockedIn.length === 0) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      await Promise.all(
        clockedIn.map((shift) =>
          timeEntriesApi.closeOpenByAssistant(shift.studentAssistantId),
        ),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.todayShifts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all }),
      ])
      setClockOutAllOpen(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const todayDay = getTodayDay()

  return (
    <>
      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-card-foreground">
                Currently Clocked In
              </h2>
              <p className="text-sm text-muted-foreground">
                Active employees on shift
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-online opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-online"></span>
                </span>
                <span className="text-sm text-status-online tabular-nums">
                  {clockedIn.length} clocked in
                </span>
              </div>
              {showClockOutAll && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={clockedIn.length === 0 || submitting}
                  onClick={() => {
                    setSubmitError(null)
                    setClockOutAllOpen(true)
                  }}
                  className="uppercase tracking-wider text-xs"
                >
                  <DoorOpen className="h-3.5 w-3.5" />
                  Clock Out All
                </Button>
              )}
            </div>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs font-medium">
                Name
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs font-medium">
                Role
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs font-medium">
                Clock In
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs font-medium">
                Shift End
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs font-medium text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="py-8 text-center text-sm text-destructive">
                  Failed to load clocked-in employees
                </TableCell>
              </TableRow>
            ) : !todayDay ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No shifts scheduled for weekends
                </TableCell>
              </TableRow>
            ) : clockedIn.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No one is currently clocked in
                </TableCell>
              </TableRow>
            ) : (
              clockedIn.map((shift) => {
                const name = formatShiftName(shift)
                return (
                  <TableRow
                    key={shift.studentAssistantId}
                    className="border-border hover:bg-secondary/50 transition-colors"
                  >
                    <TableCell className="font-medium text-card-foreground">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-sm bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                          {getShiftInitials(shift)}
                        </div>
                        {name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {shift.role}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {shift.clockInActual ? formatTime(shift.clockInActual) : "--"}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {shift.scheduleBlockId == null ? "Unscheduled" : formatTime(shift.endTime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSubmitError(null)
                          setConfirmTarget(shift)
                        }}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Clock out ${name}`}
                      >
                        <DoorOpen className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setConfirmTarget(null)
            setSubmitError(null)
          }
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Clock out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clock out
              {confirmTarget ? ` ${formatShiftName(confirmTarget)}` : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {submitError && confirmTarget !== null && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={handleConfirmClockOut}
            >
              {submitting ? "Clocking out..." : "Clock Out"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={clockOutAllOpen}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setClockOutAllOpen(false)
            setSubmitError(null)
          }
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Clock out everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clock out all {clockedIn.length} employee
              {clockedIn.length === 1 ? "" : "s"} still on shift for today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {submitError && clockOutAllOpen && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={handleClockOutAll}
            >
              {submitting ? "Clocking out..." : "Clock Out All"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
