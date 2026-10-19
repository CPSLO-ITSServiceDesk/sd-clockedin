"use client"

import { useState } from "react"

import { Segmented } from "@/components/admin/schedule-builder/builder-ui"
import type { Weekday } from "@/components/admin/terms/term-types"
import { usePaintStroke } from "@/hooks/use-paint-stroke"
import type { DraftPerson, DraftRules } from "@/lib/api/schedule-drafts"
import {
  DAY_SHORT,
  WEEKDAYS,
  deskSlots,
  isAvailable,
  setAvailable,
  slotClock,
} from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

type Granularity = "60" | "30"

interface PaintCell {
  day: Weekday
  slots: number[]
}

/** Drag across the grid to open or close a person's available hours. */
export function AvailabilityPainter({
  person,
  rules,
  onChange,
  onStrokeEnd,
}: Readonly<{
  person: DraftPerson
  rules: DraftRules
  onChange: (_update: (_person: DraftPerson) => DraftPerson) => void
  onStrokeEnd?: () => void
}>) {
  const [granularity, setGranularity] = useState<Granularity>("60")
  const step = granularity === "60" ? 2 : 1
  const rows = deskSlots(rules).filter((slot) => (slot - rules.desk_start_slot) % step === 0)

  const paint = usePaintStroke<PaintCell, boolean>({
    onPaint: (cell, open) => onChange((current) => setAvailable(current, cell.day, cell.slots, open)),
    onFinish: () => onStrokeEnd?.(),
  })

  const cellSlots = (slot: number) =>
    step === 2 ? [slot, slot + 1].filter((s) => s < rules.desk_end_slot) : [slot]

  return (
    <div className="flex flex-col gap-2 select-none">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Drag across the times they can work.</span>
        <Segmented
          mono
          options={[
            { value: "60", label: "1 h" },
            { value: "30", label: "30 m" },
          ]}
          value={granularity}
          onChange={setGranularity}
        />
      </div>
      <div className="grid grid-cols-[56px_repeat(5,minmax(0,1fr))] gap-1">
        <span />
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-[13px] font-bold">
            {DAY_SHORT[day]}
          </span>
        ))}
        {rows.map((slot) => (
          <div key={slot} className="contents">
            <span className="font-mono text-xs text-muted-foreground">{slotClock(slot)}</span>
            {WEEKDAYS.map((day) => {
              const slots = cellSlots(slot)
              const open = slots.filter((s) => isAvailable(person, day, s)).length
              const full = open === slots.length
              return (
                <div
                  key={day}
                  role="button"
                  tabIndex={0}
                  aria-pressed={full}
                  aria-label={`${DAY_SHORT[day]} ${slotClock(slot)} ${full ? "available" : "not available"}`}
                  onMouseDown={() => paint.start({ day, slots }, !full)}
                  onMouseEnter={() => paint.enter({ day, slots })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onChange((current) => setAvailable(current, day, slots, !full))
                      onStrokeEnd?.()
                    }
                  }}
                  className={cn(
                    "cursor-pointer rounded-md border transition-colors",
                    step === 2 ? "h-7" : "h-[18px]",
                    full
                      ? "border-transparent bg-avail"
                      : open > 0
                        ? isAvailable(person, day, slots[0])
                          ? "border-transparent bg-[linear-gradient(180deg,var(--avail)_50%,var(--muted)_50%)]"
                          : "border-transparent bg-[linear-gradient(180deg,var(--muted)_50%,var(--avail)_50%)]"
                        : "border-border/70 bg-muted/40 hover:bg-muted",
                  )}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
