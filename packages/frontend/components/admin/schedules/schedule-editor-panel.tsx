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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ScheduleEditorPanelProps {
  student: ScheduleStudent
  initialBlocks: DraftScheduleBlock[]
  remoteShiftsAllowed?: boolean
  onSave: (_blocks: DraftScheduleBlock[]) => Promise<void>
}

export function ScheduleEditorPanel({
  student,
  initialBlocks,
  remoteShiftsAllowed = false,
  onSave,
}: ScheduleEditorPanelProps) {
  const normalizedInitialBlocks = useMemo(
    () => normalizeDraftBlocks(initialBlocks),
    [initialBlocks],
  )
  const [draftBlocks, setDraftBlocks] = useState(normalizedInitialBlocks)
  const [loadedBlocks, setLoadedBlocks] = useState(normalizedInitialBlocks)

  if (normalizedInitialBlocks !== loadedBlocks) {
    setLoadedBlocks(normalizedInitialBlocks)
    setDraftBlocks(normalizedInitialBlocks)
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

  const handleSave = async () => {
    const normalizedBlocks = normalizeDraftBlocks(draftBlocks, {
      forceInPerson: !remoteShiftsAllowed,
    })
    const validationError = validateDraftBlocks(normalizedBlocks)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    try {
      await onSave(normalizedBlocks)
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
