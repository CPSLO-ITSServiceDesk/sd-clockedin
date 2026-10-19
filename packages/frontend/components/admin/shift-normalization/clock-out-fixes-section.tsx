"use client"

import { useState } from "react"
import { Check, Minus } from "lucide-react"
import { toast } from "sonner"

import { applyClockOutFixes, type ClockOutFix, type ClockOutIssue } from "@/lib/api/shift-normalization"
import { formatTime } from "@/lib/format-time"
import { formatOrgClock } from "@/lib/org-time"
import { formatEntryDate } from "@/lib/shifts/normalization-view"
import { cn } from "@/lib/utils"

const GRID =
  "grid grid-cols-[28px_minmax(0,1fr)_auto] md:grid-cols-[28px_minmax(0,1.2fr)_110px_150px_170px_150px_120px] gap-x-3 gap-y-1"

const ISSUE: Record<ClockOutIssue, { label: string; tone: "warn" | "bad" }> = {
  missing: { label: "Never clocked out", tone: "bad" },
  still_open: { label: "Still clocked in", tone: "warn" },
  auto_clock_out: { label: "Auto clocked out", tone: "warn" },
  next_day: { label: "Clocked out next day", tone: "bad" },
  long_after_end: { label: "Long after shift", tone: "warn" },
  before_clock_in: { label: "Out before in", tone: "bad" },
}

function clockOutLabel(fix: ClockOutFix): string {
  if (!fix.clockOut) return "—"
  if (fix.issue === "next_day") {
    const day = new Date(fix.clockOut).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    return `${day}, ${formatOrgClock(fix.clockOut)}`
  }
  return formatOrgClock(fix.clockOut)
}

/** Linked clock-ins with an odd clock-out; applying sets them to the shift's scheduled end. */
export function ClockOutFixesSection({
  termId,
  fixes,
  scanKey,
  disabled,
  onApplied,
}: Readonly<{
  termId: number | null
  fixes: ClockOutFix[]
  /** Changes on every scan so selections reset with the data. */
  scanKey: number
  disabled: boolean
  onApplied: (_message: string) => Promise<void>
}>) {
  // Everything is selected by default; track what the admin unchecked for this scan.
  const [unchecked, setUnchecked] = useState<{ scan: number; ids: Set<number> }>({ scan: 0, ids: new Set() })
  const off = unchecked.scan === scanKey ? unchecked.ids : new Set<number>()
  const selected = fixes.filter((fix) => !off.has(fix.timeEntryId))
  const [applying, setApplying] = useState(false)
  const [open, setOpen] = useState(true)

  const setOff = (ids: Set<number>) => setUnchecked({ scan: scanKey, ids })
  const toggle = (id: number) => {
    const next = new Set(off)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOff(next)
  }
  const allSelected = fixes.length > 0 && selected.length === fixes.length
  const toggleAll = () => setOff(allSelected ? new Set(fixes.map((fix) => fix.timeEntryId)) : new Set())

  const apply = async () => {
    if (!termId || selected.length === 0) return
    setApplying(true)
    try {
      const result = await applyClockOutFixes(termId, selected.map((fix) => fix.timeEntryId))
      await onApplied(
        `Set ${result.applied} ${result.applied === 1 ? "clock-out" : "clock-outs"} to the scheduled shift end.${
          result.skipped.length > 0 ? ` ${result.skipped.length} skipped because they changed since the scan.` : ""
        } Timesheets and analytics are updated.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't fix the selected clock-outs")
    } finally {
      setApplying(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex flex-col gap-0.5 text-left"
        >
          <span className="text-[15px] font-bold">Odd clock-outs · {fixes.length}</span>
          <span className="text-[13px] text-muted-foreground">
            Still clocked in 30+ min after their shift ended (today included), never clocked out, auto clocked out after the shift, or out more than 30 min late. Fixing sets the
            clock-out to the scheduled shift end.
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-[13px] font-semibold text-accent"
          >
            {open ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={selected.length === 0 || applying || disabled}
            className="h-[34px] rounded-full bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent/90 disabled:bg-muted-foreground disabled:text-background"
          >
            {applying ? "Fixing…" : selected.length > 0 ? `Set ${selected.length} to shift end` : "Set to shift end"}
          </button>
        </div>
      </div>

      {open ? (
        <>
          <div
            className={cn(
              GRID,
              "items-center border-y border-border/60 bg-muted/40 px-5 py-2 text-xs font-semibold text-muted-foreground",
            )}
          >
            <button
              type="button"
              onClick={toggleAll}
              disabled={fixes.length === 0}
              aria-label={allSelected ? "Clear selection" : "Select all clock-outs"}
            >
              <Checkmark state={allSelected ? "on" : selected.length > 0 ? "some" : "off"} />
            </button>
            <span>Student</span>
            <span className="hidden md:inline">Date</span>
            <span className="hidden md:inline">Shift</span>
            <span className="hidden md:inline">Clocked in → out</span>
            <span className="hidden md:inline">Problem</span>
            <span className="md:block">New clock-out</span>
          </div>
          {fixes.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Every linked clock-out looks right.</p>
          ) : (
            fixes.map((fix) => {
              const on = !off.has(fix.timeEntryId)
              const issue = ISSUE[fix.issue]
              return (
                <button
                  key={fix.timeEntryId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(fix.timeEntryId)}
                  className={cn(
                    GRID,
                    "w-full items-center border-b border-border/60 px-5 py-[11px] text-left last:border-0",
                    on ? "bg-accent/5" : "hover:bg-muted/40",
                  )}
                >
                  <Checkmark state={on ? "on" : "off"} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{fix.studentName}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground md:hidden">
                      {formatEntryDate(fix.date)} · {issue.label} · out {clockOutLabel(fix)}
                    </span>
                  </span>
                  <span className="hidden font-mono text-[13px] text-foreground/80 md:inline">
                    {formatEntryDate(fix.date)}
                  </span>
                  <span className="hidden font-mono text-[13px] text-foreground/80 md:inline">
                    {formatTime(fix.blockStartTime)} – {formatTime(fix.blockEndTime)}
                  </span>
                  <span className="hidden font-mono text-[13px] md:inline">
                    {formatOrgClock(fix.clockIn)} → {clockOutLabel(fix)}
                  </span>
                  <span
                    className={cn(
                      "hidden justify-self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold md:inline",
                      issue.tone === "bad"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-amber-500/15 text-amber-800 dark:text-amber-200",
                    )}
                  >
                    {issue.label}
                  </span>
                  <span className="font-mono text-[13px] font-semibold text-accent">{formatOrgClock(fix.proposedClockOut)}</span>
                </button>
              )
            })
          )}
        </>
      ) : null}
    </section>
  )
}

export function Checkmark({ state }: Readonly<{ state: "on" | "off" | "some" }>) {
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-md border-[1.5px]",
        state === "off" ? "border-border bg-card" : "border-accent bg-accent text-accent-foreground",
      )}
    >
      {state === "on" ? <Check className="size-3.5" strokeWidth={3} /> : null}
      {state === "some" ? <Minus className="size-3.5" strokeWidth={3} /> : null}
    </span>
  )
}
