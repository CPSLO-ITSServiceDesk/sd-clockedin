"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CalendarClock,
  Grid3X3,
  Save,
  Star,
  Type,
} from "lucide-react"
import type { StudentAssistant } from "@/components/admin/students/student-assistant-form"
import { ScheduleDayForm } from "@/components/admin/schedules/schedule-day-form"
import { ScheduleGrid } from "@/components/admin/schedules/schedule-grid"
import { useScheduleStore } from "@/components/admin/schedules/mock-schedule-store"
import type { DraftScheduleBlock } from "@/components/admin/schedules/schedule-types"
import {
  blocksToSelectedSlots,
  formatWeeklyHours,
  selectedSlotsToDraftBlocks,
  summarizeScheduleBlocks,
  totalWeeklyHours,
  validateDraftBlocks,
} from "@/components/admin/schedules/schedule-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ScheduleEditorPanelProps {
  student: StudentAssistant
  termId: number
}

export function ScheduleEditorPanel({ student, termId }: ScheduleEditorPanelProps) {
  const { getScheduleForStudentTerm, saveScheduleBlocks } = useScheduleStore()
  const [draftBlocks, setDraftBlocks] = useState<DraftScheduleBlock[]>([])
  const [inputMode, setInputMode] = useState<"grid" | "manual">("grid")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const { blocks } = getScheduleForStudentTerm(student.id, termId)
    setDraftBlocks(
      blocks.map(({ day, start_time, end_time }) => ({
        day,
        start_time,
        end_time,
      })),
    )
    setError(null)
  }, [getScheduleForStudentTerm, student.id, termId])

  const selectedSlots = useMemo(
    () => blocksToSelectedSlots(draftBlocks),
    [draftBlocks],
  )

  const weeklyHours = useMemo(() => totalWeeklyHours(draftBlocks), [draftBlocks])
  const summary = useMemo(
    () => summarizeScheduleBlocks(draftBlocks),
    [draftBlocks],
  )

  const handleSelectedSlotsChange = (slots: Set<string>) => {
    setDraftBlocks(selectedSlotsToDraftBlocks(slots))
    setError(null)
  }

  const handleSave = () => {
    const validationError = validateDraftBlocks(draftBlocks)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    saveScheduleBlocks(student.id, termId, draftBlocks)
    setIsSaving(false)
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

        <TabsContent value="grid">
          <ScheduleGrid
            selectedSlots={selectedSlots}
            onSelectedSlotsChange={handleSelectedSlotsChange}
          />
        </TabsContent>

        <TabsContent value="manual">
          <ScheduleDayForm
            variant="compact"
            blocks={draftBlocks}
            onChange={(blocks) => {
              setDraftBlocks(blocks)
              setError(null)
            }}
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

export function ScheduleEditorEmptyState({ className }: { className?: string }) {
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
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        Choose a student from the list to view and edit their weekly schedule.
      </p>
    </div>
  )
}
