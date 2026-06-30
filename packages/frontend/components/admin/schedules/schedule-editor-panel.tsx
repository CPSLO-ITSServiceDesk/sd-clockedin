"use client"

import { useMemo, useState } from "react"
import {
  CalendarClock,
  Grid3X3,
  Save,
  Star,
  Type,
} from "lucide-react"
import { ScheduleDayForm } from "@/components/admin/schedules/schedule-day-form"
import { ScheduleGrid } from "@/components/admin/schedules/schedule-grid"
import type { DraftScheduleBlock } from "@/components/admin/schedules/schedule-types"
import { DatePickerField } from "@/components/admin/terms/date-picker-field"
import { formatTermDate } from "@/components/admin/terms/term-types"
import {
  blocksToSelectedSlots,
  formatWeeklyHours,
  mergeBlockWorkModes,
  normalizeDraftBlocks,
  selectedSlotsToDraftBlocks,
  summarizeScheduleBlocks,
  totalWeeklyHours,
  validateDraftBlocks,
} from "@/components/admin/schedules/schedule-utils"
import { WorkModeBadge, type WorkMode } from "@/components/admin/work-mode-badge"
import type { ScheduleStudent } from "@/lib/api/schedule-mappers"
import { validateScheduleDateOverrides } from "@/lib/schedules/date-range"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export type ScheduleSavePayload = {
  blocks: DraftScheduleBlock[]
  startDate: string | null
  endDate: string | null
}

interface ScheduleEditorPanelProps {
  student: ScheduleStudent
  initialBlocks: DraftScheduleBlock[]
  initialStartDate?: string | null
  initialEndDate?: string | null
  termStartDate?: string | null
  termEndDate?: string | null
  remoteShiftsAllowed?: boolean
  onSave: (payload: ScheduleSavePayload) => Promise<void>
}

export function ScheduleEditorPanel({
  student,
  initialBlocks,
  initialStartDate = null,
  initialEndDate = null,
  termStartDate = null,
  termEndDate = null,
  remoteShiftsAllowed = false,
  onSave,
}: ScheduleEditorPanelProps) {
  const normalizedInitialBlocks = useMemo(
    () => normalizeDraftBlocks(initialBlocks),
    [initialBlocks],
  )
  const [draftBlocks, setDraftBlocks] = useState(normalizedInitialBlocks)
  const [loadedBlocks, setLoadedBlocks] = useState(normalizedInitialBlocks)
  const hasInitialDateOverride = Boolean(initialStartDate || initialEndDate)
  const [startDate, setStartDate] = useState(initialStartDate ?? "")
  const [endDate, setEndDate] = useState(initialEndDate ?? "")
  const [customDatesEnabled, setCustomDatesEnabled] = useState(hasInitialDateOverride)
  const [loadedDates, setLoadedDates] = useState({
    startDate: initialStartDate ?? "",
    endDate: initialEndDate ?? "",
    customDatesEnabled: hasInitialDateOverride,
  })

  if (normalizedInitialBlocks !== loadedBlocks) {
    setLoadedBlocks(normalizedInitialBlocks)
    setDraftBlocks(normalizedInitialBlocks)
  }

  const nextStartDate = initialStartDate ?? ""
  const nextEndDate = initialEndDate ?? ""
  const nextCustomDatesEnabled = Boolean(initialStartDate || initialEndDate)
  if (
    nextStartDate !== loadedDates.startDate ||
    nextEndDate !== loadedDates.endDate ||
    nextCustomDatesEnabled !== loadedDates.customDatesEnabled
  ) {
    setLoadedDates({
      startDate: nextStartDate,
      endDate: nextEndDate,
      customDatesEnabled: nextCustomDatesEnabled,
    })
    setStartDate(nextStartDate)
    setEndDate(nextEndDate)
    setCustomDatesEnabled(nextCustomDatesEnabled)
  }
  const [inputMode, setInputMode] = useState<"grid" | "manual">("grid")
  const [gridWorkMode, setGridWorkMode] = useState<WorkMode>("in-person")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const selectedSlots = useMemo(
    () => blocksToSelectedSlots(draftBlocks),
    [draftBlocks],
  )

  const weeklyHours = useMemo(() => totalWeeklyHours(draftBlocks), [draftBlocks])
  const summary = useMemo(
    () => summarizeScheduleBlocks(draftBlocks),
    [draftBlocks],
  )

  const updateDraftBlocks = (blocks: DraftScheduleBlock[]) => {
    setDraftBlocks(normalizeDraftBlocks(blocks))
    setError(null)
  }

  const handleSelectedSlotsChange = (slots: Set<string>) => {
    const fromGrid = selectedSlotsToDraftBlocks(slots)
    updateDraftBlocks(
      mergeBlockWorkModes(
        fromGrid,
        draftBlocks,
        remoteShiftsAllowed && gridWorkMode === "remote",
      ),
    )
  }

  const handleManualChange = (blocks: DraftScheduleBlock[]) => {
    updateDraftBlocks(blocks)
  }

  const termFromDate = termStartDate ? new Date(`${termStartDate}T00:00:00`) : undefined
  const termToDate = termEndDate ? new Date(`${termEndDate}T00:00:00`) : undefined
  const termRangeLabel =
    termStartDate && termEndDate
      ? `${formatTermDate(termStartDate)} – ${formatTermDate(termEndDate)}`
      : null

  const customDatesHelperText = customDatesEnabled
    ? "Set when this student's schedule is active within the term."
    : termRangeLabel
      ? `Using full term (${termRangeLabel}).`
      : "Schedule follows the full term dates."

  const handleSave = async () => {
    const normalizedBlocks = normalizeDraftBlocks(draftBlocks, {
      forceInPerson: !remoteShiftsAllowed,
    })
    const validationError = validateDraftBlocks(normalizedBlocks)
    if (validationError) {
      setError(validationError)
      return
    }

    const normalizedStartDate = customDatesEnabled ? startDate.trim() || null : null
    const normalizedEndDate = customDatesEnabled ? endDate.trim() || null : null
    const dateValidationError = customDatesEnabled
      ? validateScheduleDateOverrides(
          normalizedStartDate,
          normalizedEndDate,
          { start_date: termStartDate ?? null, end_date: termEndDate ?? null },
        )
      : null
    if (dateValidationError) {
      setError(dateValidationError)
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        blocks: normalizedBlocks,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
      })
      setDraftBlocks(normalizedBlocks)
      setError(null)
    } catch (err) {
      console.error("Save schedule failed:", err)
      setError("Failed to save schedule. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {student.role === "Student Lead" ? (
              <Badge
                variant="secondary"
                className="bg-yellow-500/20 text-yellow-500"
              >
                <Star className="mr-1 size-3" />
                Student Lead
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                Student Assistant
              </Badge>
            )}
            <Badge variant="secondary" className="bg-accent/20 text-accent">
              {formatWeeklyHours(weeklyHours)} weekly
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{summary}</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="shrink-0">
          <Save className="size-4" />
          Save schedule
        </Button>
      </div>

      <div className="rounded-sm border border-border bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label
              htmlFor="custom-schedule-dates"
              className="text-sm font-semibold uppercase tracking-wider"
            >
              Custom effective dates
            </Label>
            <p className="text-muted-foreground text-sm">{customDatesHelperText}</p>
          </div>
          <Switch
            id="custom-schedule-dates"
            checked={customDatesEnabled}
            onCheckedChange={setCustomDatesEnabled}
            className="mt-0.5 shrink-0"
          />
        </div>

        {customDatesEnabled ? (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="schedule-start-date"
                className="text-muted-foreground text-xs uppercase tracking-wider"
              >
                Start date
              </Label>
              <DatePickerField
                value={startDate}
                onChange={setStartDate}
                placeholder="Term start"
                fromDate={termFromDate}
                toDate={termToDate}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="schedule-end-date"
                className="text-muted-foreground text-xs uppercase tracking-wider"
              >
                End date
              </Label>
              <DatePickerField
                value={endDate}
                onChange={setEndDate}
                placeholder="Term end"
                fromDate={termFromDate}
                toDate={termToDate}
              />
            </div>
          </div>
        ) : null}
      </div>

      <Tabs
        value={inputMode}
        onValueChange={(value) => setInputMode(value as "grid" | "manual")}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="grid">
            <Grid3X3 className="size-4" />
            Grid
          </TabsTrigger>
          <TabsTrigger value="manual">
            <Type className="size-4" />
            Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid" forceMount className="data-[state=inactive]:hidden">
          {remoteShiftsAllowed ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">
                Paint as
              </span>
              {(["in-person", "remote"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGridWorkMode(mode)}
                  className={cn(
                    "rounded-full transition-opacity",
                    gridWorkMode === mode
                      ? "opacity-100"
                      : "opacity-45 hover:opacity-80",
                  )}
                >
                  <WorkModeBadge mode={mode} />
                </button>
              ))}
            </div>
          ) : null}
          <ScheduleGrid
            selectedSlots={selectedSlots}
            onSelectedSlotsChange={handleSelectedSlotsChange}
          />
        </TabsContent>

        <TabsContent value="manual" forceMount className="data-[state=inactive]:hidden">
          <ScheduleDayForm
            variant="compact"
            blocks={draftBlocks}
            onChange={handleManualChange}
            remoteShiftsAllowed={remoteShiftsAllowed}
          />
        </TabsContent>
      </Tabs>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function ScheduleEditorEmptyState({
  className,
  message = "Select a term above, then choose a student from the list to view and edit their weekly schedule.",
}: {
  className?: string
  message?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-sm border border-border bg-muted/40">
        <CalendarClock className="text-muted-foreground size-5" />
      </div>
      <h3 className="text-sm font-semibold uppercase tracking-wider">
        Select a student
      </h3>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">{message}</p>
    </div>
  )
}
