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
import {
  formatActualShift,
  formatStartTimeHeader,
  formatTimeRange,
  normalizeTimeKey,
} from "@/lib/format-time"

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

// Mock data with actual clock-in/clock-out times, sorted by start time, then first name
const mockShifts: Shift[] = [
  {
    id: "1",
    firstName: "Alex",
    lastName: "Chen",
    role: "Engineer",
    startTime: "06:00",
    endTime: "14:00",
    clockInActual: "05:58",
    clockOutActual: null,
    status: "clocked-in",
  },
  {
    id: "2",
    firstName: "Maya",
    lastName: "Rodriguez",
    role: "Designer",
    startTime: "06:00",
    endTime: "14:00",
    clockInActual: "05:55",
    clockOutActual: null,
    status: "clocked-in",
  },
  {
    id: "3",
    firstName: "James",
    lastName: "Wilson",
    role: "Manager",
    startTime: "07:00",
    endTime: "15:00",
    clockInActual: "06:58",
    clockOutActual: null,
    status: "clocked-in",
  },
  {
    id: "4",
    firstName: "Emily",
    lastName: "Park",
    role: "Support",
    startTime: "8:00",
    endTime: "16:00",
    clockInActual: "08:05",
    clockOutActual: null,
    status: "late",
  },
  {
    id: "5",
    firstName: "Sarah",
    lastName: "Kim",
    role: "Analyst",
    startTime: "08:00",
    endTime: "16:00",
    clockInActual: null,
    clockOutActual: null,
    status: "scheduled",
  },
  {
    id: "6",
    firstName: "David",
    lastName: "Thompson",
    role: "Developer",
    startTime: "09:00",
    endTime: "17:00",
    clockInActual: null,
    clockOutActual: null,
    status: "scheduled",
  },
  {
    id: "7",
    firstName: "Lisa",
    lastName: "Martinez",
    role: "QA",
    startTime: "09:00",
    endTime: "17:00",
    clockInActual: null,
    clockOutActual: null,
    status: "absent",
  },
  {
    id: "8",
    firstName: "Michael",
    lastName: "Johnson",
    role: "Engineer",
    startTime: "10:00",
    endTime: "18:00",
    clockInActual: null,
    clockOutActual: null,
    status: "scheduled",
  },
  {
    id: "9",
    firstName: "Rachel",
    lastName: "Lee",
    role: "Designer",
    startTime: "10:00",
    endTime: "18:00",
    clockInActual: null,
    clockOutActual: null,
    status: "scheduled",
  },
  {
    id: "10",
    firstName: "Chris",
    lastName: "Brown",
    role: "Support",
    startTime: "12:00",
    endTime: "20:00",
    clockInActual: null,
    clockOutActual: null,
    status: "scheduled",
  }
].sort((a, b) => {
  const timeCompare = normalizeTimeKey(a.startTime).localeCompare(
    normalizeTimeKey(b.startTime),
  )
  if (timeCompare !== 0) return timeCompare
  return a.firstName.localeCompare(b.firstName)
})

const statusStyles: Record<Shift["status"], string> = {
  scheduled: "bg-muted text-muted-foreground",
  "clocked-in": "bg-accent/20 text-accent",
  late: "bg-yellow-500/20 text-yellow-500",
  absent: "bg-destructive/20 text-destructive",
}

const statusLabels: Record<Shift["status"], string> = {
  scheduled: "Scheduled",
  "clocked-in": "Clocked In",
  late: "Late",
  absent: "Absent",
}

function groupShiftsByStartTime(
  shifts: Shift[],
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

const COLUMN_COUNT = 5

export function ShiftsTable() {
  const shiftGroups = groupShiftsByStartTime(mockShifts)

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">
          All Shifts Today
        </CardTitle>
      </CardHeader>
      <CardContent>
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
            {shiftGroups.map((group) => (
              <Fragment key={group.startTime}>
                <TableRow className="border-border hover:bg-transparent bg-muted/30">
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
                        className={statusStyles[shift.status]}
                      >
                        {statusLabels[shift.status]}
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