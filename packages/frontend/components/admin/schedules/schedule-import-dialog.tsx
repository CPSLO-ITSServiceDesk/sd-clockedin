"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, FileSpreadsheet, Upload } from "lucide-react"
import {
  importSchedules,
  type ScheduleImportResult,
} from "@/lib/api/schedule-import"
import { queryKeys } from "@/lib/query-keys"
import { Badge } from "@/components/ui/badge"
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
import { cn } from "@/lib/utils"

interface ScheduleImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  termId: number
  termName: string
}

export function ScheduleImportDialog({
  open,
  onOpenChange,
  termId,
  termName,
}: ScheduleImportDialogProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ScheduleImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const resetState = () => {
    setFile(null)
    setPreview(null)
    setError(null)
    setLoading(false)
    setSuccessMessage(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState()
    onOpenChange(nextOpen)
  }

  const handlePreview = async () => {
    if (!file) return

    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const result = await importSchedules(file, termId, true)
      setPreview(result)
    } catch (err) {
      setPreview(null)
      setError(err instanceof Error ? err.message : "Preview failed")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const result = await importSchedules(file, termId, false)
      setSuccessMessage(
        `Imported ${result.summary.schedulesUpdated} schedules (${result.summary.studentsCreated} new students, ${result.summary.studentsMatched} matched).`,
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.students.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.all }),
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setLoading(false)
    }
  }

  const newStudents =
    preview?.students.filter((student) => student.action === "create") ?? []
  const matchedStudents =
    preview?.students.filter((student) => student.action === "match") ?? []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import schedule</DialogTitle>
          <DialogDescription>
            Upload a When I Work export (.xlsx or .csv). Only{" "}
            <span className="text-foreground font-medium">Service Desk</span>{" "}
            shifts are imported; date-specific rows become recurring Mon–Fri
            blocks for{" "}
            <span className="text-foreground font-medium">{termName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="text-muted-foreground mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-sm">
                  Choose a spreadsheet exported from When I Work with columns
                  like Member, Work Email, Start Date, and Start Time.
                </p>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null)
                    setPreview(null)
                    setError(null)
                    setSuccessMessage(null)
                  }}
                />
                {file ? (
                  <p className="text-muted-foreground text-xs">
                    Selected: {file.name}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
              {successMessage}
            </div>
          ) : null}

          {preview ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["New students", preview.summary.studentsCreated],
                  ["Matched", preview.summary.studentsMatched],
                  ["Schedules", preview.summary.schedulesUpdated],
                  ["Blocks", preview.summary.totalBlocks],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-md border border-border bg-muted/20 px-3 py-2"
                  >
                    <p className="text-muted-foreground text-xs uppercase tracking-wider">
                      {label}
                    </p>
                    <p className="text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              {preview.summary.skippedRows > 0 ? (
                <p className="text-muted-foreground text-sm">
                  {preview.summary.skippedRows} row
                  {preview.summary.skippedRows === 1 ? "" : "s"} skipped.
                </p>
              ) : null}

              {newStudents.length > 0 ? (
                <ImportStudentSection
                  title="Students to create"
                  students={newStudents}
                  badgeClassName="bg-accent/20 text-accent"
                  badgeLabel="New"
                />
              ) : null}

              {matchedStudents.length > 0 ? (
                <ImportStudentSection
                  title="Schedules to replace"
                  students={matchedStudents}
                  badgeClassName="bg-muted text-muted-foreground"
                  badgeLabel="Existing"
                />
              ) : null}

              {preview.warnings.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Warnings</p>
                  <ul className="text-muted-foreground max-h-32 space-y-1 overflow-y-auto text-xs">
                    {preview.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {successMessage ? "Close" : "Cancel"}
          </Button>

          <div className="flex gap-2">
            {!preview || successMessage ? (
              <Button
                type="button"
                onClick={handlePreview}
                disabled={!file || loading || Boolean(successMessage)}
              >
                <Upload className="size-4" />
                {loading ? "Previewing..." : "Preview import"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPreview(null)
                    setError(null)
                  }}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="button" onClick={handleConfirm} disabled={loading}>
                  {loading ? "Importing..." : "Confirm import"}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportStudentSection({
  title,
  students,
  badgeClassName,
  badgeLabel,
}: {
  title: string
  students: ScheduleImportResult["students"]
  badgeClassName: string
  badgeLabel: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3">
        {students.map((student) => (
          <div
            key={student.workEmail}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{student.member}</p>
              <p className="text-muted-foreground truncate text-xs">
                {student.workEmail}
              </p>
            </div>
            <Badge variant="secondary" className={cn("shrink-0", badgeClassName)}>
              {badgeLabel} · {student.blockCount} blocks
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
