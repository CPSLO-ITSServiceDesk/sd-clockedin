"use client"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import { studentAssistantsApi } from "@/lib/api/student-assistants"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { queryKeys } from "@/lib/query-keys"
import {
  formatShiftName,
  getClockInStudentOptions,
  getClockedInStudents,
  getShiftInitials,
  type ClockInStudentOption,
  type TodayShift,
} from "@/lib/shifts/today-shifts"

interface ClockModalProps {
  open: boolean
  mode: "in" | "out"
  onClose: () => void
  prefillName?: string
}

export function ClockModal({
  open,
  mode,
  onClose,
  prefillName = "",
}: ClockModalProps) {
  const queryClient = useQueryClient()
  const { shifts, isLoading: shiftsLoading } = useTodayShiftList()
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: queryKeys.students.all,
    queryFn: studentAssistantsApi.list,
    enabled: open && mode === "in",
  })
  const [query, setQuery] = useState(prefillName)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQuery(prefillName)
      setSubmitError(null)
    }
  }, [open, prefillName])

  const isClockIn = mode === "in"
  const isLoading = isClockIn ? shiftsLoading || studentsLoading : shiftsLoading

  const eligibleStudents = isClockIn
    ? getClockInStudentOptions(students, shifts)
    : getClockedInStudents(shifts)

  const filtered = query.trim().length === 0
    ? eligibleStudents
    : eligibleStudents.filter((entry) => {
        const search = query.toLowerCase()
        const name = formatShiftName(entry).toLowerCase()
        const role = entry.role.toLowerCase()
        const firstName = entry.firstName.toLowerCase()
        const lastName = entry.lastName.toLowerCase()
        return (
          name.includes(search) ||
          role.includes(search) ||
          firstName.includes(search) ||
          lastName.includes(search)
        )
      })

  const invalidateShiftData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.todayShifts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all }),
    ])
  }

  const handleClockIn = async (student: ClockInStudentOption) => {
    await timeEntriesApi.clockIn({
      student_assistant_id: student.studentAssistantId,
      clock_in: new Date().toISOString(),
    })
  }

  const handleClockOut = async (shift: TodayShift) => {
    await timeEntriesApi.closeOpenByAssistant(shift.studentAssistantId)
  }

  const handleSelect = async (entry: ClockInStudentOption | TodayShift) => {
    if (submitting) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      if (isClockIn) {
        await handleClockIn(entry as ClockInStudentOption)
      } else {
        await handleClockOut(entry as TodayShift)
      }

      await invalidateShiftData()
      setQuery("")
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setQuery("")
      setSubmitError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border p-0 gap-0 max-w-md overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="uppercase tracking-[0.2em] text-sm text-muted-foreground">
            {isClockIn ? "Clock In" : "Clock Out"} — Select Employee
          </DialogTitle>
        </DialogHeader>

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

        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm uppercase tracking-wider">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm uppercase tracking-wider">
              No employees found
            </div>
          ) : (
            filtered.map((entry) => {
              const name = formatShiftName(entry)
              return (
                <button
                  key={entry.studentAssistantId}
                  onClick={() => handleSelect(entry)}
                  disabled={submitting}
                  className="w-full flex items-center gap-3 px-6 py-3 hover:bg-secondary/60 transition-colors border-b border-border/50 last:border-0 text-left group disabled:opacity-50"
                >
                  <div className="h-9 w-9 rounded-sm bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground shrink-0 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                    {getShiftInitials(entry)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-card-foreground text-sm truncate">
                      {name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {entry.role}
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
              )
            })
          )}
        </div>

        {submitError && (
          <div className="px-6 py-3 border-t border-border text-sm text-destructive">
            {submitError}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
