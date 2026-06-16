"use client"

import { useState } from "react"
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
import { Button } from "@/components/ui/button"
import { DoorOpen } from "lucide-react"
import { ClockModal } from "@/components/clock-modal"

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
    startTime: "08:00",
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
  // Sort by start time first
  const timeCompare = a.startTime.localeCompare(b.startTime)
  if (timeCompare !== 0) return timeCompare
  // Then by first name
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

export function ShiftsTable() {
  const [clockModalOpen, setClockModalOpen] = useState(false)
  const [clockModalMode, setClockModalMode] = useState<"in" | "out">("in")
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")

  const handleClockAction = (shift: Shift) => {
    setSelectedEmployee(`${shift.firstName} ${shift.lastName}`)
    if (shift.status === "clocked-in") {
      setClockModalMode("out")
    } else {
      setClockModalMode("in")
    }
    setClockModalOpen(true)
  }

  return (
    <>
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
                <TableHead className="text-muted-foreground uppercase tracking-wider text-xs w-[80px]">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockShifts.map((shift) => (
                <TableRow key={shift.id} className="border-border">
                  <TableCell className="font-medium">
                    {shift.firstName} {shift.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {shift.role}
                  </TableCell>
                  {/* UPDATED: Expected shift (scheduled times) */}
                  <TableCell className="font-mono text-sm">
                    {shift.startTime} - {shift.endTime}
                  </TableCell>
                  {/* ADDED: Actual shift rendering */}
                  <TableCell className="font-mono text-sm">
                    {shift.clockInActual && shift.clockOutActual ? (
                      `${shift.clockInActual} - ${shift.clockOutActual}`
                    ) : shift.clockInActual ? (
                      `${shift.clockInActual} - --`
                    ) : (
                      `-- --`
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={statusStyles[shift.status]}
                    >
                      {statusLabels[shift.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {shift.status !== "absent" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={
                          shift.status === "clocked-in"
                            ? "text-destructive hover:text-destructive hover:bg-destructive/10"
                            : "text-accent hover:text-accent hover:bg-accent/10"
                        }
                        onClick={() => handleClockAction(shift)}
                      >
                        <DoorOpen className="size-4" />
                        <span className="sr-only">
                          {shift.status === "clocked-in" ? "Clock Out" : "Clock In"}
                        </span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ClockModal
        open={clockModalOpen}
        onOpenChange={setClockModalOpen}
        mode={clockModalMode}
        prefilledName={selectedEmployee}
      />
    </>
  )
}