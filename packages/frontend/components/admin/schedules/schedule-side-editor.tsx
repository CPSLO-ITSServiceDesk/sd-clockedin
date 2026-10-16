"use client"

import { CalendarClock, Plus, X } from "lucide-react"

import { formatStudentName } from "@/components/admin/mock-students"
import {
  SCHEDULE_WEEKDAYS,
  type DraftScheduleBlock,
  type Weekday,
} from "@/components/admin/schedules/schedule-types"
import {
  formatWeeklyHours,
  summarizeScheduleBlocks,
  timeToMinutes,
  totalWeeklyHours,
} from "@/components/admin/schedules/schedule-utils"
import { DatePickerField } from "@/components/admin/terms/date-picker-field"
import { formatTermDate } from "@/components/admin/terms/term-types"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { ScheduleStudent } from "@/lib/api/schedule-mappers"
import { normalizeTimeKey } from "@/lib/format-time"
import { nextBlockForDay } from "@/lib/schedules/team-week"
import { cn } from "@/lib/utils"

export interface ScheduleDraft {
  blocks: DraftScheduleBlock[]
  customDates: boolean
  startDate: string
  endDate: string
}

interface ScheduleSideEditorProps {
  student: ScheduleStudent
  draft: ScheduleDraft
  onDraftChange: (_draft: ScheduleDraft) => void
  termStartDate: string | null
  termEndDate: string | null
  remoteShiftsAllowed: boolean
  unsaved: boolean
  isSaving: boolean
  error: string | null
  onSave: () => void
  onDiscard: () => void
}

function toDate(value: string | null): Date | undefined {
  return value ? new Date(`${value}T00:00:00`) : undefined
}

export function ScheduleSideEditor({
  student,
  draft,
  onDraftChange,
  termStartDate,
  termEndDate,
  remoteShiftsAllowed,
  unsaved,
  isSaving,
  error,
  onSave,
  onDiscard,
}: Readonly<ScheduleSideEditorProps>) {
  const { blocks } = draft
  const name = formatStudentName(student)
  const setBlocks = (next: DraftScheduleBlock[]) => onDraftChange({ ...draft, blocks: next })
  const updateBlock = (index: number, patch: Partial<DraftScheduleBlock>) =>
    setBlocks(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)))
  const addBlock = (day: Weekday) => setBlocks([...blocks, nextBlockForDay(blocks, day)])

  const termRange =
    termStartDate && termEndDate
      ? `${formatTermDate(termStartDate)} – ${formatTermDate(termEndDate)}`
      : null

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-5 lg:sticky lg:top-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[13px] font-bold text-accent">
          {`${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[17px] font-bold">{name}</span>
          <span className="text-[13px] text-muted-foreground">
            {student.role} · {formatWeeklyHours(totalWeeklyHours(blocks))} weekly
          </span>
        </div>
      </div>
      <p className="text-[13px] leading-[1.45] text-muted-foreground">
        {blocks.length > 0 ? summarizeScheduleBlocks(blocks) : "No shifts scheduled this term."}
      </p>

      <div className="flex flex-col gap-2.5">
        {SCHEDULE_WEEKDAYS.map((weekday) => {
          const dayBlocks = blocks
            .map((block, index) => ({ block, index }))
            .filter(({ block }) => block.day === weekday.value)
            .sort((a, b) => timeToMinutes(a.block.start_time) - timeToMinutes(b.block.start_time))
          return (
            <div
              key={weekday.value}
              className="flex flex-col gap-1.5 border-b border-border/60 pb-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold">{weekday.label}</span>
                <button
                  type="button"
                  onClick={() => addBlock(weekday.value)}
                  className="flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold text-accent hover:bg-accent/10"
                >
                  <Plus className="size-3" />
                  Add
                </button>
              </div>
              {dayBlocks.length === 0 ? (
                <span className="text-xs text-muted-foreground">Off</span>
              ) : (
                dayBlocks.map(({ block, index }) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <div className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-full bg-muted px-2.5">
                      <Input
                        type="time"
                        aria-label={`${weekday.label} start`}
                        value={block.start_time}
                        onChange={(event) =>
                          updateBlock(index, { start_time: normalizeTimeKey(event.target.value) })
                        }
                        className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        aria-label={`${weekday.label} end`}
                        value={block.end_time}
                        onChange={(event) =>
                          updateBlock(index, { end_time: normalizeTimeKey(event.target.value) })
                        }
                        className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!remoteShiftsAllowed}
                      onClick={() => updateBlock(index, { is_remote: !block.is_remote })}
                      title={remoteShiftsAllowed ? "Switch location" : "Remote shifts are off for this term"}
                      className={cn(
                        "shrink-0 rounded-full px-2 py-[3px] text-[11px] font-semibold disabled:cursor-default",
                        block.is_remote && remoteShiftsAllowed
                          ? "bg-muted text-foreground"
                          : "bg-accent/15 text-accent",
                      )}
                    >
                      {block.is_remote && remoteShiftsAllowed ? "Remote" : "In person"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlocks(blocks.filter((_, i) => i !== index))}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-3.5" />
                      <span className="sr-only">Remove block</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="custom-schedule-dates" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {draft.customDates ? "Custom dates" : termRange ? `Full term · ${termRange}` : "Full term"}
          </label>
          <Switch
            id="custom-schedule-dates"
            checked={draft.customDates}
            onCheckedChange={(customDates) => onDraftChange({ ...draft, customDates })}
          />
        </div>
        {draft.customDates ? (
          <div className="grid grid-cols-2 gap-2">
            <DatePickerField
              value={draft.startDate}
              onChange={(startDate) => onDraftChange({ ...draft, startDate })}
              placeholder="Term start"
              fromDate={toDate(termStartDate)}
              toDate={toDate(termEndDate)}
            />
            <DatePickerField
              value={draft.endDate}
              onChange={(endDate) => onDraftChange({ ...draft, endDate })}
              placeholder="Term end"
              fromDate={toDate(termStartDate)}
              toDate={toDate(termEndDate)}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {unsaved ? (
          <button
            type="button"
            onClick={onDiscard}
            className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300"
          >
            Unsaved · discard
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">All changes saved</span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={!unsaved || isSaving}
          className="h-9 rounded-full bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </section>
  )
}

export function ScheduleSideEditorEmpty({ message }: Readonly<{ message: string }>) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-border bg-card px-6 py-12 text-center lg:sticky lg:top-6">
      <CalendarClock className="size-5 text-muted-foreground" />
      <span className="text-sm font-semibold">Pick a student</span>
      <span className="text-[13px] text-muted-foreground">{message}</span>
    </section>
  )
}
