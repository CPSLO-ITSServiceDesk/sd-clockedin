"use client"

import { useEffect, useState } from "react"
import type { ScheduleBlock } from "@/lib/api/scheduleBlocks"
import type { TimeEntry } from "@/lib/api/time-entries"
import {
  formatBlockLabel,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/components/admin/student-records/student-records-utils"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface TimeEntryFormValues {
  schedule_block_id: string
  clock_in: string
  clock_out: string
}

interface TimeEntryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  studentName: string
  scheduleBlocks: ScheduleBlock[]
  initialEntry?: TimeEntry | null
  onSubmit: (values: TimeEntryFormValues) => Promise<void>
}

const EMPTY_FORM: TimeEntryFormValues = {
  schedule_block_id: "",
  clock_in: "",
  clock_out: "",
}

export function TimeEntryFormDialog({
  open,
  onOpenChange,
  mode,
  studentName,
  scheduleBlocks,
  initialEntry,
  onSubmit,
}: TimeEntryFormDialogProps) {
  const [values, setValues] = useState<TimeEntryFormValues>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    if (mode === "edit" && initialEntry) {
      setValues({
        schedule_block_id: initialEntry.schedule_block_id
          ? String(initialEntry.schedule_block_id)
          : "",
        clock_in: toDatetimeLocalValue(initialEntry.clock_in),
        clock_out: toDatetimeLocalValue(initialEntry.clock_out),
      })
    } else {
      setValues({
        ...EMPTY_FORM,
        clock_in: toDatetimeLocalValue(new Date().toISOString()),
      })
    }

    setError(null)
  }, [open, mode, initialEntry])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!values.clock_in.trim()) {
      setError("Clock in time is required.")
      return
    }

    if (values.clock_out && values.clock_out <= values.clock_in) {
      setError("Clock out must be after clock in.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit(values)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save time entry")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add time entry" : "Edit time entry"}
          </DialogTitle>
          <DialogDescription>
            {studentName} · adjust clock in/out times and linked shift
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule_block_id">Scheduled shift</Label>
            <Select
              value={values.schedule_block_id || "none"}
              onValueChange={(value) =>
                setValues((current) => ({
                  ...current,
                  schedule_block_id: value === "none" ? "" : value,
                }))
              }
            >
              <SelectTrigger id="schedule_block_id" className="border-border bg-input">
                <SelectValue placeholder="No linked shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked shift</SelectItem>
                {scheduleBlocks.map((block) => (
                  <SelectItem key={block.id} value={String(block.id)}>
                    {formatBlockLabel(block)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clock_in">Clock in</Label>
            <Input
              id="clock_in"
              type="datetime-local"
              value={values.clock_in}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  clock_in: event.target.value,
                }))
              }
              className="border-border bg-input"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clock_out">Clock out</Label>
            <Input
              id="clock_out"
              type="datetime-local"
              value={values.clock_out}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  clock_out: event.target.value,
                }))
              }
              className="border-border bg-input"
            />
          </div>

          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : mode === "create" ? "Add entry" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function timeEntryFormToPayload(
  values: TimeEntryFormValues,
  studentId: number,
) {
  return {
    student_assistant_id: studentId,
    schedule_block_id: values.schedule_block_id
      ? Number(values.schedule_block_id)
      : null,
    clock_in: fromDatetimeLocalValue(values.clock_in),
    clock_out: values.clock_out
      ? fromDatetimeLocalValue(values.clock_out)
      : null,
  }
}
