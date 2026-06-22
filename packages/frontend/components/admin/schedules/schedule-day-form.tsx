"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SCHEDULE_WEEKDAYS,
  type DraftScheduleBlock,
  type Weekday,
} from "@/components/admin/schedules/schedule-types"
import { formatTimeRange, normalizeTimeKey } from "@/lib/format-time"
import { cn } from "@/lib/utils"

interface ScheduleDayFormProps {
  blocks: DraftScheduleBlock[]
  onChange: (blocks: DraftScheduleBlock[]) => void
  variant?: "default" | "compact"
}

function createEmptyBlock(day: Weekday = "monday"): DraftScheduleBlock {
  return {
    day,
    start_time: "09:00",
    end_time: "12:00",
  }
}

export function ScheduleDayForm({
  blocks,
  onChange,
  variant = "default",
}: ScheduleDayFormProps) {
  const updateBlock = (
    index: number,
    patch: Partial<DraftScheduleBlock>,
  ) => {
    const normalizedPatch = {
      ...patch,
      ...(patch.start_time
        ? { start_time: normalizeTimeKey(patch.start_time) }
        : {}),
      ...(patch.end_time ? { end_time: normalizeTimeKey(patch.end_time) } : {}),
    }

    onChange(
      blocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...normalizedPatch } : block,
      ),
    )
  }

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, blockIndex) => blockIndex !== index))
  }

  const addBlock = (day: Weekday) => {
    onChange([...blocks, createEmptyBlock(day)])
  }

  if (variant === "compact") {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs uppercase tracking-wider">
          Enter shift times for each day. Add multiple blocks for split shifts.
        </p>

        {SCHEDULE_WEEKDAYS.map((weekday) => {
          const dayBlocks = blocks
            .map((block, index) => ({ block, index }))
            .filter((entry) => entry.block.day === weekday.value)

          return (
            <div
              key={weekday.value}
              className="rounded-sm border border-border bg-card/50 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider">
                    {weekday.label}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {dayBlocks.length === 0
                      ? "Off day"
                      : dayBlocks
                          .map(({ block }) =>
                            formatTimeRange(block.start_time, block.end_time),
                          )
                          .join(" · ")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addBlock(weekday.value)}
                >
                  <Plus className="size-4" />
                  Add block
                </Button>
              </div>

              {dayBlocks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No shifts scheduled</p>
              ) : (
                <div className="space-y-2">
                  {dayBlocks.map(({ block, index }, rangeIndex) => (
                    <div
                      key={`${weekday.value}-${index}`}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Input
                        type="time"
                        value={block.start_time}
                        onChange={(event) =>
                          updateBlock(index, { start_time: event.target.value })
                        }
                        className="w-[132px] border-border bg-input"
                      />
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">
                        to
                      </span>
                      <Input
                        type="time"
                        value={block.end_time}
                        onChange={(event) =>
                          updateBlock(index, { end_time: event.target.value })
                        }
                        className="w-[132px] border-border bg-input"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeBlock(index)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Remove block</span>
                      </Button>
                      {rangeIndex === dayBlocks.length - 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => addBlock(weekday.value)}
                        >
                          <Plus className="size-4" />
                          Add
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {SCHEDULE_WEEKDAYS.map((weekday) => {
        const dayBlocks = blocks
          .map((block, index) => ({ block, index }))
          .filter((entry) => entry.block.day === weekday.value)

        return (
          <div
            key={weekday.value}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{weekday.label}</p>
                <p className="text-muted-foreground text-xs">
                  {dayBlocks.length === 0
                    ? "No shifts"
                    : dayBlocks
                        .map(({ block }) =>
                          formatTimeRange(block.start_time, block.end_time),
                        )
                        .join(" · ")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addBlock(weekday.value)}
              >
                <Plus className="size-4" />
                Add block
              </Button>
            </div>

            {dayBlocks.length === 0 ? (
              <p className="text-muted-foreground text-sm">Off day</p>
            ) : (
              <div className="space-y-2">
                {dayBlocks.map(({ block, index }) => (
                  <div
                    key={`${weekday.value}-${index}`}
                    className={cn("flex flex-wrap items-end gap-2")}
                  >
                    <div className="min-w-[140px] flex-1 space-y-1">
                      <label className="text-muted-foreground text-xs uppercase tracking-wider">
                        Day
                      </label>
                      <Select
                        value={block.day}
                        onValueChange={(value) =>
                          updateBlock(index, { day: value as Weekday })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCHEDULE_WEEKDAYS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-xs uppercase tracking-wider">
                        Start
                      </label>
                      <Input
                        type="time"
                        value={block.start_time}
                        onChange={(event) =>
                          updateBlock(index, { start_time: event.target.value })
                        }
                        className="w-[132px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-xs uppercase tracking-wider">
                        End
                      </label>
                      <Input
                        type="time"
                        value={block.end_time}
                        onChange={(event) =>
                          updateBlock(index, { end_time: event.target.value })
                        }
                        className="w-[132px]"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeBlock(index)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove block</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
