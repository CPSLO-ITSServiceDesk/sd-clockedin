"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface ClockModalProps {
  open: boolean
  mode: "in" | "out"
  onClose: () => void
  prefillName?: string
}

const allEmployees = [
  { id: "1", name: "Alex Chen", role: "Software Engineer" },
  { id: "2", name: "Sarah Martinez", role: "UI Designer" },
  { id: "3", name: "James Wilson", role: "Operations Lead" },
  { id: "4", name: "Emily Zhang", role: "Backend Developer" },
  { id: "5", name: "Michael Ross", role: "Support Specialist" },
  { id: "6", name: "David Kim", role: "Senior Engineer" },
  { id: "7", name: "Lisa Thompson", role: "Marketing Manager" },
  { id: "8", name: "Robert Garcia", role: "Sales Representative" },
  { id: "9", name: "Amanda Lee", role: "HR Coordinator" },
]

export function ClockModal({ open, mode, onClose, prefillName = "" }: ClockModalProps) {
  const [query, setQuery] = useState(prefillName)

  const filtered = query.trim().length === 0
    ? allEmployees
    : allEmployees.filter((e) =>
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.role.toLowerCase().includes(query.toLowerCase())
      )

  const handleSelect = (employee: typeof allEmployees[0]) => {
    console.log(`Clock ${mode}:`, employee.name)
    setQuery("")
    onClose()
  }

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setQuery("")
      onClose()
    }
  }

  const isClockIn = mode === "in"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border p-0 gap-0 max-w-md overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="uppercase tracking-[0.2em] text-sm text-muted-foreground">
            {isClockIn ? "Clock In" : "Clock Out"} — Select Employee
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search by name or role..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-background border-border text-sm placeholder:text-muted-foreground focus-visible:ring-accent"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm uppercase tracking-wider">
              No employees found
            </div>
          ) : (
            filtered.map((employee) => (
              <button
                key={employee.id}
                onClick={() => handleSelect(employee)}
                className="w-full flex items-center gap-3 px-6 py-3 hover:bg-secondary/60 transition-colors border-b border-border/50 last:border-0 text-left group"
              >
                <div className="h-9 w-9 rounded-sm bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground shrink-0 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                  {employee.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-card-foreground text-sm truncate">
                    {employee.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {employee.role}
                  </div>
                </div>
                <span
                  className={`ml-auto text-xs uppercase tracking-wider shrink-0 ${
                    isClockIn ? "text-accent" : "text-destructive"
                  }`}
                >
                  {isClockIn ? "In" : "Out"}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
