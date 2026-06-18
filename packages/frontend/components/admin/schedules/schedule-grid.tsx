"use client"

import { useCallback, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { formatStartTimeHeader } from "@/lib/format-time"
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  SCHEDULE_WEEKDAYS,
  type Weekday,
  slotKey,
} from "@/components/admin/schedules/schedule-types"
import { generateTimeSlots } from "@/components/admin/schedules/schedule-utils"

interface ScheduleGridProps {
  selectedSlots: Set<string>
  onSelectedSlotsChange: (slots: Set<string>) => void
}

export function ScheduleGrid({
  selectedSlots,
  onSelectedSlotsChange,
}: ScheduleGridProps) {
  const timeSlots = generateTimeSlots()
  const [dragDay, setDragDay] = useState<Weekday | null>(null)
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null)
  const dragModeRef = useRef<"select" | "deselect">("select")

  const applyRange = useCallback(
    (
      day: Weekday,
      startIndex: number,
      endIndex: number,
      mode: "select" | "deselect",
    ) => {
      const low = Math.min(startIndex, endIndex)
      const high = Math.max(startIndex, endIndex)
      const next = new Set(selectedSlots)

      for (let index = low; index <= high; index += 1) {
        const key = slotKey(day, timeSlots[index])
        if (mode === "select") {
          next.add(key)
        } else {
          next.delete(key)
        }
      }

      onSelectedSlotsChange(next)
    },
    [onSelectedSlotsChange, selectedSlots, timeSlots],
  )

  const handlePointerDown = (day: Weekday, slotIndex: number) => {
    const isSelected = selectedSlots.has(slotKey(day, timeSlots[slotIndex]))
    dragModeRef.current = isSelected ? "deselect" : "select"
    setDragDay(day)
    setDragStartIndex(slotIndex)
    setDragEndIndex(slotIndex)
  }

  const handlePointerEnter = (day: Weekday, slotIndex: number) => {
    if (dragDay !== day || dragStartIndex === null) return
    setDragEndIndex(slotIndex)
  }

  const handlePointerUp = () => {
    if (dragDay !== null && dragStartIndex !== null && dragEndIndex !== null) {
      applyRange(dragDay, dragStartIndex, dragEndIndex, dragModeRef.current)
    }
    setDragDay(null)
    setDragStartIndex(null)
    setDragEndIndex(null)
  }

  const isPreviewSelected = (day: Weekday, slotIndex: number) => {
    if (dragDay === day && dragStartIndex !== null && dragEndIndex !== null) {
      const low = Math.min(dragStartIndex, dragEndIndex)
      const high = Math.max(dragStartIndex, dragEndIndex)
      if (slotIndex >= low && slotIndex <= high) {
        return dragModeRef.current === "select"
      }
    }

    return selectedSlots.has(slotKey(day, timeSlots[slotIndex]))
  }

  return (
    <div className="select-none">
      <p className="text-muted-foreground mb-3 text-xs uppercase tracking-wider">
        Click or drag within a day column to select available hours
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <div
          className="min-w-[560px] px-1 pt-1"
          onMouseLeave={handlePointerUp}
          onMouseUp={handlePointerUp}
        >
          <div className="mb-1 grid grid-cols-[60px_repeat(5,minmax(0,1fr))] gap-1">
            <div />
            {SCHEDULE_WEEKDAYS.map((weekday) => (
              <div
                key={weekday.value}
                className="py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {weekday.label.slice(0, 3)}
              </div>
            ))}
          </div>

          {timeSlots.map((time, slotIndex) => (
            <div
              key={time}
              className="mb-1 grid grid-cols-[60px_repeat(5,minmax(0,1fr))] gap-1"
            >
              <div className="text-muted-foreground py-2 pr-2 text-right text-xs">
                {formatStartTimeHeader(time)}
              </div>
              {SCHEDULE_WEEKDAYS.map((weekday) => {
                const selected = isPreviewSelected(weekday.value, slotIndex)

                return (
                  <button
                    key={weekday.value}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${weekday.label} ${formatStartTimeHeader(time)}`}
                    className={cn(
                      "h-10 cursor-pointer rounded-md border transition-colors",
                      selected
                        ? "border-accent/50 bg-accent/80 hover:bg-accent"
                        : "border-border bg-muted/50 hover:bg-muted",
                    )}
                    onMouseDown={() =>
                      handlePointerDown(weekday.value, slotIndex)
                    }
                    onMouseEnter={() =>
                      handlePointerEnter(weekday.value, slotIndex)
                    }
                  />
                )
              })}
            </div>
          ))}
        </div>
        <p className="border-t border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {GRID_START_HOUR}:00 AM – {GRID_END_HOUR - 12}:00 PM hourly blocks
        </p>
      </div>
    </div>
  )
}
