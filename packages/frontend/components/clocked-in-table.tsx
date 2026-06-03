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

interface ClockedInEmployee {
  id: string
  name: string
  role: string
  clockedInAt: string
  shiftEnd: string
}

const clockedInEmployees: ClockedInEmployee[] = [
  {
    id: "1",
    name: "Alex Chen",
    role: "Software Engineer",
    clockedInAt: "08:00",
    shiftEnd: "17:00",
  },
  {
    id: "2",
    name: "Sarah Martinez",
    role: "UI Designer",
    clockedInAt: "08:15",
    shiftEnd: "17:15",
  },
  {
    id: "3",
    name: "James Wilson",
    role: "Operations Lead",
    clockedInAt: "08:30",
    shiftEnd: "17:30",
  },
  {
    id: "4",
    name: "Emily Zhang",
    role: "Backend Developer",
    clockedInAt: "09:00",
    shiftEnd: "18:00",
  },
  {
    id: "5",
    name: "Michael Ross",
    role: "Support Specialist",
    clockedInAt: "09:15",
    shiftEnd: "18:15",
  },
]

export function ClockedInTable() {
  const [modalOpen, setModalOpen] = useState(false)
  const [prefillName, setPrefillName] = useState("")

  const handleClockOutClick = (name: string) => {
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
                Currently Clocked In
              </h2>
              <p className="text-sm text-muted-foreground">
                Active employees on shift
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-online opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-online"></span>
              </span>
              <span className="font-mono text-sm text-status-online">
                {clockedInEmployees.length} ONLINE
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
            {clockedInEmployees.map((employee) => (
              <TableRow
                key={employee.id}
                className="border-border hover:bg-secondary/50 transition-colors"
              >
                <TableCell className="font-medium text-card-foreground">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-sm bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                      {employee.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    {employee.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {employee.role}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {employee.clockedInAt}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {employee.shiftEnd}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleClockOutClick(employee.name)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Clock out ${employee.name}`}
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
        mode="out"
        prefillName={prefillName}
        onClose={() => { setModalOpen(false); setPrefillName("") }}
      />
    </>
  )
}
