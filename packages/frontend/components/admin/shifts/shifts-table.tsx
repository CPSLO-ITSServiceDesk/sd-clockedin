"use client"

import { Fragment, useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  formatActualShift,
  formatStartTimeHeader,
  formatTimeRange,
  normalizeTimeKey,
} from "@/lib/format-time"
import { schedulesApi } from "@/lib/api/schedules"
import { scheduleBlocksApi, type ScheduleBlockDay } from "@/lib/api/scheduleBlocks"
import { studentAssistantsApi } from "@/lib/api/student-assistants"
import { timeEntriesApi } from "@/lib/api/time-entries"

// Helper to get today's day of week as string matching database enum
function getTodayDay(): ScheduleBlockDay | null {
  const day = new Date().getDay()
  // Convert: 0=Sunday, 1=Monday, etc.
  // Database enum only has Monday-Friday
  if (day === 0 || day === 6) return null // Weekend: no shifts
  const days: ScheduleBlockDay[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday"
  ]
  return days[day - 1]
}

// Helper to get today's date string in YYYY-MM-DD format
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

interface Shift {
  id: string
  firstName: string
  lastName: string
  role: string
  startTime: string          // Scheduled start time (HH:mm)
  endTime: string            // Scheduled end time (HH:mm)
  clockInActual: string | null   // Actual clock-in time (HH:mm) or null
  clockOutActual: string | null  // Actual clock-out time (HH:mm) or null
  status: "scheduled" | "clocked-in" | "late" | "absent"
}

export function ShiftsTable() {
  const [shiftGroups, setShiftGroups] = useState<{ startTime: string; shifts: Shift[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all required data in parallel
        const [
          schedulesResult,
          scheduleBlocksResult,
          studentAssistantsResult,
          timeEntriesResult
        ] = await Promise.all([
          schedulesApi.list(),
          scheduleBlocksApi.list(),
          studentAssistantsApi.list(),
          timeEntriesApi.list()
        ])

        if (!isMounted) return

        const schedules: any[] = schedulesResult
        const scheduleBlocks: any[] = scheduleBlocksResult
        const studentAssistants: any[] = studentAssistantsResult
        const timeEntries: any[] = timeEntriesResult

        // Get today's day of week and date
        const todayDay = getTodayDay()
        const todayDate = getTodayDateString()

        // If it's weekend, show empty state
        if (!todayDay) {
          setShiftGroups([])
          setLoading(false)
          return
        }

        // Filter schedule blocks to today's day of week
        const todaysBlocks = scheduleBlocks.filter(
          block => block.days === todayDay
        )

        // Filter time entries to today's date
        const todaysTimeEntries = timeEntries.filter(
          entry => entry.created_at && entry.created_at.startsWith(todayDate)
        )

        // Create maps for quick lookup
        const scheduleMap = new Map<number, any>(
          schedules.map(s => [s.id, s])
        )

        const studentAssistantMap = new Map<number, any>(
          studentAssistants.map(sa => [sa.id, sa])
        )

        // Group time entries by schedule_block_id and student_assistant_id for easy lookup
        const timeEntryMap = new Map<string, any>()
        todaysTimeEntries.forEach(entry => {
          const key = `${entry.schedule_block_id}-${entry.student_assistant_id}`
          timeEntryMap.set(key, entry)
        })

        // Build shifts for today
        const shifts: Shift[] = todaysBlocks.map(block => {
          const schedule = scheduleMap.get(block.schedule_id)
          if (!schedule) {
            console.warn(`Schedule not found for schedule_block ${block.id}`)
            return null
          }

          const studentAssistant = studentAssistantMap.get(schedule.student_assistant_id)
          if (!studentAssistant) {
            console.warn(`Student assistant not found for schedule ${schedule.id}`)
            return null
          }

          // Format the student assistant position for display
          const position = studentAssistant.position
          const formattedRole = position === "student lead, student assistant"
            ? "Student Assistant"
            : position

          // Get time entry for today for this schedule block and student assistant
          const timeEntryKey = `${block.id}-${schedule.student_assistant_id}`
          const timeEntry = timeEntryMap.get(timeEntryKey) || null

          // Determine status
          let status: Shift["status"] = "scheduled"
          if (timeEntry) {
            if (timeEntry.clock_in && !timeEntry.clock_out) {
              status = "clocked-in"
            } else if (timeEntry.clock_in && timeEntry.clock_out) {
              // Both clocked in and out - check if late
              // For simplicity, we'll mark as scheduled if both present
              // In a real app, you'd compare against scheduled start time
              status = "scheduled"
            }
          }

          // Check for late status based on actual clock in time vs scheduled start time
          // This is a simplified check - in reality you'd want to compare times properly
          if (timeEntry && timeEntry.clock_in && block.start_time) {
            // Parse times and compare - simplified for now
            // A real implementation would convert to minutes and compare
            status = "late" // Placeholder - implement proper time comparison
          }

          return {
            id: schedule.id.toString(),
            firstName: studentAssistant.first_name || "",
            lastName: studentAssistant.last_name || "",
            role: formattedRole,
            startTime: block.start_time || "00:00",
            endTime: block.end_time || "00:00",
            clockInActual: timeEntry?.clock_in || null,
            clockOutActual: timeEntry?.clock_out || null,
            status: status as Shift["status"]
          }
        }).filter((s): s is Shift => s !== null)

        // Group shifts by start time for the table display
        const groupedShifts = groupShiftsByStartTime(shifts)

        if (isMounted) {
          setShiftGroups(groupedShifts)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "An error occurred")
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [])

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
            All Shifts Today
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-sm text-muted-foreground">Loading shifts...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
            All Shifts Today
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-destructive-center">Error loading shifts: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If no shifts (weekend or no data)
  if (shiftGroups.length === 0) {
    const todayDay = getTodayDay()
    const isWeekend = !todayDay

    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
            All Shifts Today
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <div className="flex flex-col items-center justify-center py-8">
            {isWeekend ? (
              <>
                <p className="text-sm text-muted-foreground">No shifts scheduled for weekends.</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No shifts scheduled for today.</p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const COLUMN_COUNT = 5

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">
          All Shifts Today
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Name
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Role
              </TableHead>
              {/* UPDATED: Changed from "Schedule" to "Expected Shift" */}
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Expected Shift
              </TableHead>
              {/* ADDED: Actual Shift column */}
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Actual Shift
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shiftGroups.map((group, groupIndex) => (
              <Fragment key={group.startTime}>
                <TableRow className={`border-border hover:bg-transparent ${groupIndex > 0 ? "bg-muted/30" : ""}`}>
                  <TableCell colSpan={COLUMN_COUNT} className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold uppercase tracking-wider text-foreground whitespace-nowrap">
                        {formatStartTimeHeader(group.startTime)}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  </TableCell>
                </TableRow>
                {group.shifts.map((shift) => (
                  <TableRow key={shift.id} className="border-border">
                    <TableCell className="font-medium">
                      {shift.firstName} {shift.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {shift.role}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTimeRange(shift.startTime, shift.endTime)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatActualShift(shift.clockInActual, shift.clockOutActual)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          shift.status === "scheduled" ? "bg-muted text-muted-foreground" :
                          shift.status === "clocked-in" ? "bg-accent/20 text-accent" :
                          shift.status === "late" ? "bg-yellow-500/20 text-yellow-500" :
                          "bg-destructive/20 text-destructive"
                        }
                      >
                        {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// Reuse the grouping function from the original componed
function groupShiftsByStartTime(
  shifts: Shift[]
): { startTime: string; shifts: Shift[] }[] {
  const groups: { startTime: string; shifts: Shift[] }[] = []

  for (const shift of shifts) {
    const startTimeKey = normalizeTimeKey(shift.startTime)
    const lastGroup = groups.at(-1)

    if (lastGroup?.startTime === startTimeKey) {
      lastGroup.shifts.push(shift)
    } else {
      groups.push({ startTime: startTimeKey, shifts: [shift] })
    }
  }

  return groups
}