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

interface ExpectedArrival {
  id: string
  name: string
  role: string
  scheduleStart: string
  scheduleEnd: string
}

const expectedArrivals: ExpectedArrival[] = [
  {
    id: "1",
    name: "David Kim",
    role: "Senior Engineer",
    scheduleStart: "13:00",
    scheduleEnd: "22:00",
  },
  {
    id: "2",
    name: "Lisa Thompson",
    role: "Marketing Manager",
    scheduleStart: "13:30",
    scheduleEnd: "22:30",
  },
  {
    id: "3",
    name: "Robert Garcia",
    role: "Sales Representative",
    scheduleStart: "14:00",
    scheduleEnd: "23:00",
  },
  {
    id: "4",
    name: "Amanda Lee",
    role: "HR Coordinator",
    scheduleStart: "14:30",
    scheduleEnd: "23:30",
  },
]

export function ExpectedArrivalsTable() {
  const [modalOpen, setModalOpen] = useState(false)
  const [prefillName, setPrefillName] = useState("")

  const handleClockInClick = (name: string) => {
    setPrefillName(name)
    setModalOpen(true)
  }

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
              <span className="font-mono text-sm text-muted-foreground">
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
            {expectedArrivals.map((arrival) => (
              <TableRow
                key={arrival.id}
                className="border-border hover:bg-secondary/50 transition-colors"
              >
                <TableCell className="font-medium text-card-foreground">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-sm bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                      {arrival.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    {arrival.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {arrival.role}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {arrival.scheduleStart} — {arrival.scheduleEnd}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleClockInClick(arrival.name)}
                    className="text-accent hover:bg-accent/10 hover:text-accent"
                    aria-label={`Clock in ${arrival.name}`}
                  >
                    <DoorOpen className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ClockModal
        open={modalOpen}
        mode="in"
        prefillName={prefillName}
        onClose={() => { setModalOpen(false); setPrefillName("") }}
      />
    </>
  )
}
