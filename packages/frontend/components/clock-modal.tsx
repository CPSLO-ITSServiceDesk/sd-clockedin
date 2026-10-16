"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import { studentAssistantsApi } from "@/lib/api/student-assistants"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { ORG_TIMEZONE } from "@/lib/org-time"
import { queryKeys } from "@/lib/query-keys"
import { buildClockInRoster, buildWorkingTiles } from "@/lib/shifts/today-board"
import { cn } from "@/lib/utils"

interface ClockModalProps {
  open: boolean
  mode: "in" | "out"
  onClose: () => void
}

interface PickerEntry {
  studentAssistantId: number
  name: string
  initials: string
  detail: string
  search: string
}

function formatNowClock(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: ORG_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  })
}

export function ClockModal({
  open,
  mode,
  onClose,
}: ClockModalProps) {
  const queryClient = useQueryClient()
  const { shifts, timeOffShifts, isLoading: shiftsLoading } = useTodayShiftList()
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: queryKeys.students.all,
    queryFn: studentAssistantsApi.list,
    enabled: open && mode === "in",
  })
  const [query, setQuery] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isClockIn = mode === "in"
  const isLoading = isClockIn ? shiftsLoading || studentsLoading : shiftsLoading

  const entries: PickerEntry[] = isClockIn
    ? buildClockInRoster(students, shifts, timeOffShifts).map((option) => ({
        studentAssistantId: option.studentAssistantId,
        name: `${option.firstName} ${option.lastName}`.trim(),
        initials: [option.firstName, option.lastName]
          .filter(Boolean)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join(""),
        detail: option.detail,
        search: `${option.firstName} ${option.lastName} ${option.role}`.toLowerCase(),
      }))
    : buildWorkingTiles(shifts).map((tile) => ({
        studentAssistantId: tile.studentAssistantId,
        name: tile.name,
        initials: tile.initials,
        detail: tile.clockInLabel ? `${tile.role} · in since ${tile.clockInLabel}` : tile.role,
        search: `${tile.name} ${tile.role}`.toLowerCase(),
      }))

  const search = query.trim().toLowerCase()
  const filtered = search ? entries.filter((entry) => entry.search.includes(search)) : entries

  const handleSelect = async (entry: PickerEntry) => {
    if (submitting) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      if (isClockIn) {
        await timeEntriesApi.clockIn({
          student_assistant_id: entry.studentAssistantId,
          clock_in: new Date().toISOString(),
        })
      } else {
        await timeEntriesApi.closeOpenByAssistant(entry.studentAssistantId)
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.todayShifts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all }),
      ])
      toast.success(
        isClockIn
          ? `${entry.name} clocked in at ${formatNowClock()}`
          : `${entry.name} clocked out`,
      )
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
      <DialogContent
        showCloseButton={false}
        className="top-[110px] translate-y-0 gap-0 overflow-hidden rounded-[20px] border-border bg-card p-0 sm:max-w-[520px]"
      >
        <div className="flex items-start justify-between px-6 pb-4 pt-6">
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                "text-[13px] font-semibold uppercase tracking-[0.12em]",
                isClockIn ? "text-accent" : "text-destructive",
              )}
            >
              {isClockIn ? "Clock in" : "Clock out"}
            </span>
            <DialogTitle className="text-2xl font-bold tracking-[-0.01em]">
              {isClockIn ? "Who's starting?" : "Who's heading out?"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Search for your name, then select it to {isClockIn ? "clock in" : "clock out"}.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-6 pb-3">
          <div className="flex h-[52px] items-center gap-2.5 rounded-[14px] border-[1.5px] border-accent px-4 ring-4 ring-accent/15">
            <Search className="size-[18px] shrink-0 text-muted-foreground" />
            <input
              autoFocus
              placeholder="Search by name or role"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex max-h-[380px] flex-col gap-0.5 overflow-y-auto px-3 pb-3 pt-1">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {entries.length === 0
                ? isClockIn
                  ? "Everyone is already clocked in"
                  : "No one is clocked in"
                : "No one matches that search"}
            </p>
          ) : (
            filtered.map((entry) => (
              <button
                type="button"
                key={entry.studentAssistantId}
                onClick={() => handleSelect(entry)}
                disabled={submitting}
                className="flex min-h-[60px] w-full items-center gap-3.5 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-muted/70 disabled:opacity-50"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                  {entry.initials}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="truncate text-base font-semibold">{entry.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">{entry.detail}</span>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[13px] font-bold",
                    isClockIn ? "text-accent" : "text-destructive",
                  )}
                >
                  {isClockIn ? "In" : "Out"}
                </span>
              </button>
            ))
          )}
        </div>

        {submitError ? (
          <div className="border-t border-border px-6 py-3 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 bg-muted/60 px-6 py-3 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-accent" />
          {isClockIn
            ? "Roster from Teams Shifts · scheduled people first, time off last"
            : "Everyone currently clocked in"}
        </div>
      </DialogContent>
    </Dialog>
  )
}
