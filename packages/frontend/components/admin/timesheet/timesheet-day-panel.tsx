"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import type { TimesheetDay } from "@/lib/api/timesheet"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { formatOrgClock } from "@/lib/org-time"
import {
  formatBlockRange,
  formatDayTitle,
  formatDuration,
  formatHours,
  fromOrgTimeInput,
  toOrgTimeInput,
} from "@/lib/timesheet/month-calendar"
import { cn } from "@/lib/utils"

const ENTRY_GRID =
  "grid grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))_auto] sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_80px_auto] gap-3"

type Draft = { id: number | "new"; clockIn: string; clockOut: string }

function emptyDay(date: string): TimesheetDay {
  return {
    date,
    status: "upcoming",
    blocks: [],
    entries: [],
    workedHours: 0,
    scheduledHours: 0,
    excusedHours: 0,
    remoteHours: 0,
  }
}

function dayNote(day: TimesheetDay): { text: string; className: string } | null {
  const amber = "bg-amber-500/10 text-amber-800 dark:text-amber-200"
  const diffMinutes = Math.round((day.workedHours - day.scheduledHours) * 60)
  switch (day.status) {
    case "off":
      return {
        text: `Worked ${Math.abs(diffMinutes)} min ${diffMinutes < 0 ? "less" : "more"} than scheduled.`,
        className: amber,
      }
    case "open":
      return { text: "An entry was never closed. Set a clock-out time to count these hours.", className: amber }
    case "unscheduled":
      return { text: "Hours were recorded on a day with nothing scheduled.", className: amber }
    case "absent":
      return { text: "No clock-in recorded and no time off in Teams.", className: "bg-destructive/10 text-destructive" }
    case "excused":
      return {
        text: "Approved time off synced from Teams. Not counted as missing hours.",
        className: "border-[1.5px] border-dashed border-sky-400 bg-sky-500/5 text-sky-800 dark:text-sky-200",
      }
    case "remote":
      return { text: "Remote shift. No clock-in needed.", className: "bg-muted text-muted-foreground" }
    default:
      return null
  }
}

export function TimesheetDayPanel({
  studentId,
  date,
  day: maybeDay,
  onChanged,
}: Readonly<{
  studentId: number
  date: string
  day: TimesheetDay | undefined
  onChanged: () => Promise<unknown>
}>) {
  const day = maybeDay ?? emptyDay(date)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blockById = new Map(day.blocks.map((block) => [block.scheduleBlockId, block]))
  const inPersonBlocks = day.blocks.filter((block) => !block.isRemote)
  const note = dayNote(day)

  const scheduleLine =
    day.blocks.length > 0
      ? `Scheduled ${day.blocks
          .map(
            (block) =>
              `${formatBlockRange(block.startTime, block.endTime)} · ${block.isRemote ? "Remote" : "In person"}`,
          )
          .join(", ")} · ${formatHours(day.blocks.reduce((sum, block) => sum + block.hours, 0))}h`
      : "Nothing scheduled"

  const startNew = () => {
    const usedBlocks = new Set(day.entries.map((entry) => entry.scheduleBlockId))
    const block = inPersonBlocks.find((candidate) => !usedBlocks.has(candidate.scheduleBlockId))
    setDraft({ id: "new", clockIn: block?.startTime ?? "09:00", clockOut: block?.endTime ?? "12:00" })
    setError(null)
  }

  const save = async () => {
    if (!draft) return
    if (!draft.clockIn || (draft.id === "new" && !draft.clockOut)) {
      setError("Enter both clock-in and clock-out times.")
      return
    }
    if (draft.clockOut && draft.clockOut <= draft.clockIn) {
      setError("Clock-out must be after clock-in.")
      return
    }

    const clockIn = fromOrgTimeInput(date, draft.clockIn)
    const clockOut = draft.clockOut ? fromOrgTimeInput(date, draft.clockOut) : null
    setSaving(true)
    try {
      if (draft.id === "new") {
        const usedBlocks = new Set(day.entries.map((entry) => entry.scheduleBlockId))
        const block = inPersonBlocks.find((candidate) => !usedBlocks.has(candidate.scheduleBlockId))
        await timeEntriesApi.create({
          student_assistant_id: studentId,
          schedule_block_id: block?.scheduleBlockId ?? null,
          clock_in: clockIn,
          clock_out: clockOut,
        })
        toast.success("Entry added")
      } else {
        await timeEntriesApi.patch(draft.id, { clock_in: clockIn, clock_out: clockOut })
        toast.success("Entry updated")
      }
      await onChanged()
      setDraft(null)
      setError(null)
    } catch (err) {
      console.error("Save time entry failed:", err)
      setError("Couldn't save the entry. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const timeInput = (field: "clockIn" | "clockOut", label: string) => (
    <Input
      type="time"
      aria-label={label}
      value={draft?.[field] ?? ""}
      onChange={(event) => setDraft((current) => (current ? { ...current, [field]: event.target.value } : current))}
      className="h-8 min-w-0 rounded-full bg-muted px-2.5 font-mono text-[13px]"
    />
  )

  const editActions = (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => {
          setDraft(null)
          setError(null)
        }}
        className="h-7 rounded-full px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="h-7 rounded-full bg-accent px-3 text-xs font-bold text-accent-foreground disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  )

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-muted/60 px-[18px] py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold">{formatDayTitle(date)}</span>
          <span className="text-[13px] text-muted-foreground">{scheduleLine}</span>
        </div>
        <button
          type="button"
          onClick={startNew}
          disabled={draft !== null}
          className="h-8 rounded-full border border-border bg-card px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          Add entry
        </button>
      </div>

      {note ? (
        <div className={cn("rounded-xl px-3 py-2.5 text-[13px] font-semibold", note.className)}>{note.text}</div>
      ) : null}

      {day.entries.length > 0 || draft?.id === "new" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className={cn(ENTRY_GRID, "border-b border-border/60 px-3.5 py-2 text-xs font-semibold text-muted-foreground")}>
            <span>Shift</span>
            <span>Clock in</span>
            <span>Clock out</span>
            <span className="hidden sm:inline">Duration</span>
            <span className="hidden sm:inline">Status</span>
            <span />
          </div>
          {day.entries.map((entry) => {
            const block = entry.scheduleBlockId != null ? blockById.get(entry.scheduleBlockId) : undefined
            const editing = draft?.id === entry.id
            const isOpen = entry.clockOut == null
            return (
              <div key={entry.id} className={cn(ENTRY_GRID, "items-center px-3.5 py-2.5")}>
                <span className="truncate text-[13px] text-muted-foreground">
                  {block ? formatBlockRange(block.startTime, block.endTime) : "Custom shift"}
                </span>
                {editing ? (
                  <>
                    {timeInput("clockIn", "Clock in")}
                    {timeInput("clockOut", "Clock out")}
                    <span className="hidden sm:inline" />
                    <span className="hidden sm:inline" />
                    {editActions}
                  </>
                ) : (
                  <>
                    <span className="font-mono text-[13px]">{formatOrgClock(entry.clockIn)}</span>
                    <span className={cn("font-mono text-[13px]", isOpen && "text-destructive")}>
                      {entry.clockOut ? formatOrgClock(entry.clockOut) : "Missing"}
                    </span>
                    <span className="hidden font-mono text-[13px] sm:inline">{formatDuration(entry.hours)}</span>
                    <span
                      className={cn(
                        "hidden justify-self-start rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline",
                        isOpen
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {isOpen ? "Open" : "Closed"}
                    </span>
                    <button
                      type="button"
                      disabled={draft !== null}
                      onClick={() => {
                        setDraft({
                          id: entry.id,
                          clockIn: toOrgTimeInput(entry.clockIn),
                          clockOut: entry.clockOut ? toOrgTimeInput(entry.clockOut) : "",
                        })
                        setError(null)
                      }}
                      className="h-7 justify-self-end rounded-full px-2.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            )
          })}
          {draft?.id === "new" ? (
            <div className={cn(ENTRY_GRID, "items-center border-t border-border/60 px-3.5 py-2.5")}>
              <span className="text-[13px] font-semibold">New entry</span>
              {timeInput("clockIn", "Clock in")}
              {timeInput("clockOut", "Clock out")}
              <span className="hidden sm:inline" />
              <span className="hidden sm:inline" />
              {editActions}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
