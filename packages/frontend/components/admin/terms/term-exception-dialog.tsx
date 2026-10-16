"use client"

import { useState } from "react"

import { DatePickerField } from "@/components/admin/terms/date-picker-field"
import {
  WEEKDAY_OPTIONS,
  type TermOffDays,
  type Weekday,
} from "@/components/admin/terms/term-types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  isWeekdayDate,
  weekdaysBetween,
  type TermException,
} from "@/lib/terms/term-overview"
import { cn } from "@/lib/utils"

export type ExceptionDraft =
  | { kind: "off"; existing: TermException | null }
  | { kind: "swap"; existing: TermException | null }

interface TermExceptionDialogProps {
  draft: ExceptionDraft | null
  onOpenChange: (_open: boolean) => void
  termStart: string
  termEnd: string
  offDays: TermOffDays
  onSave: (_offDays: TermOffDays) => Promise<void>
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function ExceptionForm({
  draft,
  termStart,
  termEnd,
  offDays,
  onSave,
  onClose,
}: Readonly<Omit<TermExceptionDialogProps, "draft" | "onOpenChange"> & { draft: ExceptionDraft; onClose: () => void }>) {
  const existing = draft.existing
  const [start, setStart] = useState(existing?.start ?? "")
  const [end, setEnd] = useState(existing?.end ?? "")
  const [label, setLabel] = useState(existing?.label ?? "")
  const [swapTo, setSwapTo] = useState<Weekday>(existing?.kind === "swap" ? existing.swapTo : "friday")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isOff = draft.kind === "off"
  const removing = new Set(existing?.dates ?? [])
  const withoutExisting: TermOffDays = {
    vacations: offDays.vacations.filter((vacation) => !(existing?.kind === "off" && removing.has(vacation.date))),
    special_schedules: offDays.special_schedules.filter(
      (swap) => !(existing?.kind === "swap" && removing.has(swap.date)),
    ),
  }

  const save = async (next: TermOffDays) => {
    setSaving(true)
    try {
      await onSave(next)
      onClose()
    } catch (err) {
      console.error("Save term exception failed:", err)
      setError("Couldn't save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    if (!start) return setError("Pick a date.")
    const last = isOff && end ? end : start
    if (last < start) return setError("The end date must be on or after the start date.")
    if (start < termStart || last > termEnd) return setError("Dates must fall within the term.")

    const dates = isOff ? weekdaysBetween(start, last) : [start]
    if (dates.length === 0 || !dates.every(isWeekdayDate)) {
      return setError(isOff ? "Pick at least one weekday." : "Schedule swaps must be on a weekday.")
    }

    const taken = new Set([
      ...withoutExisting.vacations.map((vacation) => vacation.date),
      ...withoutExisting.special_schedules.map((swap) => swap.date),
    ])
    const clash = dates.find((date) => taken.has(date))
    if (clash) return setError(`${clash} already has a day off or swap.`)

    const trimmed = label.trim()
    const extra = trimmed ? { label: trimmed } : {}
    void save(
      isOff
        ? {
            ...withoutExisting,
            vacations: [...withoutExisting.vacations, ...dates.map((date) => ({ date, ...extra }))],
          }
        : {
            ...withoutExisting,
            special_schedules: [...withoutExisting.special_schedules, { date: start, swap_to_day: swapTo, ...extra }],
          },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {existing ? "Edit" : "Add"} {isOff ? "day off" : "schedule swap"}
        </DialogTitle>
        <DialogDescription>
          {isOff
            ? "No shifts run on these days, so nobody is marked absent. Weekends in a range are skipped."
            : "Each student works another weekday's shifts on this date."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className={cn("grid gap-3", isOff && "sm:grid-cols-2")}>
          <div className="grid gap-1.5">
            <Label>{isOff ? "First day" : "Date"}</Label>
            <DatePickerField value={start} onChange={setStart} fromDate={toDate(termStart)} toDate={toDate(termEnd)} />
          </div>
          {isOff ? (
            <div className="grid gap-1.5">
              <Label>Last day (optional)</Label>
              <DatePickerField
                value={end}
                onChange={setEnd}
                placeholder="Same day"
                fromDate={toDate(start || termStart)}
                toDate={toDate(termEnd)}
              />
            </div>
          ) : null}
        </div>

        {!isOff ? (
          <div className="grid gap-1.5">
            <Label>Run the schedule of</Label>
            <div className="grid grid-cols-5 gap-1">
              {WEEKDAY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSwapTo(option.value)}
                  aria-pressed={swapTo === option.value}
                  className={cn(
                    "h-8 rounded-[10px] border text-xs font-bold",
                    swapTo === option.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {option.label.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="exception-label">Label</Label>
          <Input
            id="exception-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={isOff ? "e.g. Veterans Day" : "e.g. Finals week"}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {existing ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={saving}
            onClick={() => void save(withoutExisting)}
          >
            Remove
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

export function TermExceptionDialog({ draft, onOpenChange, ...rest }: Readonly<TermExceptionDialogProps>) {
  return (
    <Dialog open={draft !== null} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        {draft ? (
          <ExceptionForm
            key={`${draft.kind}-${draft.existing?.start ?? "new"}`}
            draft={draft}
            onClose={() => onOpenChange(false)}
            {...rest}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
