"use client"

import { Fragment } from "react"
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
import { GRID_START_HOUR } from "@/components/admin/schedules/schedule-types"
import { timeToMinutes } from "@/components/admin/schedules/schedule-utils"
import {
  formatActualShift,
  formatStartTimeHeader,
  formatTimeRange,
  normalizeTimeKey,
} from "@/lib/format-time"
import { useTodayShifts } from "@/hooks/use-today-shifts"
import { formatShiftName, getTodayDay, type TodayShift } from "@/lib/shifts/today-shifts"

export function ShiftsTable() {
  const { data: shifts = [], isLoading, error, refetch } = useTodayShifts()
  const shiftGroups = groupShiftsByStartTime(shifts)

  if (isLoading) {
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
            <p className="text-sm text-destructive">Error loading shifts: {error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

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
              <p className="text-sm text-muted-foreground">No shifts scheduled for weekends.</p>
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
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Expected Shift
              </TableHead>
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
                  <TableRow
                    key={`${shift.scheduleBlockId}-${shift.studentAssistantId}`}
                    className="border-border"
                  >
                    <TableCell className="font-medium">
                      {formatShiftName(shift)}
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

function groupShiftsByStartTime(
  shifts: TodayShift[],
): { startTime: string; shifts: TodayShift[] }[] {
  const gridStartMinutes = GRID_START_HOUR * 60

  const sorted = [...shifts]
    .filter((shift) => timeToMinutes(shift.startTime) >= gridStartMinutes)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

  const groups = new Map<string, TodayShift[]>()
  for (const shift of sorted) {
    const startTimeKey = normalizeTimeKey(shift.startTime)
    const group = groups.get(startTimeKey) ?? []
    group.push(shift)
    groups.set(startTimeKey, group)
  }

  return Array.from(groups.entries()).map(([startTime, groupShifts]) => ({
    startTime,
    shifts: [...groupShifts].sort((a, b) =>
      a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" }),
    ),
  }))
}
