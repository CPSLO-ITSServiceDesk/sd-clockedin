"use client"

import { useState } from "react"
import { DoorOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClockModal } from "@/components/clock-modal"
import { useTodayShifts } from "@/hooks/use-today-shifts"
import { formatTimeRange } from "@/lib/format-time"
import {
  formatShiftName,
  getExpectedArrivalShifts,
  getShiftInitials,
  getTodayDay,
} from "@/lib/shifts/today-shifts"

export function ExpectedArrivalsTable() {
  const { data: shifts = [], isLoading, error } = useTodayShifts()
  const expectedArrivals = getExpectedArrivalShifts(shifts)
  const [modalOpen, setModalOpen] = useState(false)
  const [prefillName, setPrefillName] = useState("")

  const handleClockInClick = (name: string) => {
    setPrefillName(name)
    setModalOpen(true)
  }

  const todayDay = getTodayDay()

  return (
    <>
      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-card-foreground">
                Expected Arrivals
              </h2>
              <p className="text-sm text-muted-foreground">
                Upcoming scheduled shifts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground tabular-nums">
                {expectedArrivals.length} PENDING
              </span>
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
                Schedule
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs font-medium text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-border">
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow className="border-border">
                <TableCell colSpan={4} className="py-8 text-center text-sm text-destructive">
                  Failed to load expected arrivals
                </TableCell>
              </TableRow>
            ) : !todayDay ? (
              <TableRow className="border-border">
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No shifts scheduled for weekends
                </TableCell>
              </TableRow>
            ) : expectedArrivals.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No pending arrivals for today
                </TableCell>
              </TableRow>
            ) : (
              expectedArrivals.map((shift) => {
                const name = formatShiftName(shift)
                return (
                  <TableRow
                    key={`${shift.scheduleBlockId}-${shift.studentAssistantId}`}
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
                      {formatTimeRange(shift.startTime, shift.endTime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleClockInClick(name)}
                        className="text-accent hover:bg-accent/10 hover:text-accent"
                        aria-label={`Clock in ${name}`}
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

      <ClockModal
        open={modalOpen}
        mode="in"
        prefillName={prefillName}
        onClose={() => {
          setModalOpen(false)
          setPrefillName("")
        }}
      />
    </>
  )
}
