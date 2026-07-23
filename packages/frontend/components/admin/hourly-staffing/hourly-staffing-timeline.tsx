"use client"

import type { NowMarker, TimelineRow } from "@/lib/shifts/hourly-staffing"
import { cn } from "@/lib/utils"

interface HourlyStaffingTimelineProps {
  rows: TimelineRow[]
  axisTicks: string[]
  nowMarker: NowMarker
}

export function HourlyStaffingTimeline({
  rows,
  axisTicks,
  nowMarker,
}: HourlyStaffingTimelineProps) {
  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No shifts scheduled for this day.
      </div>
    )
  }

  return (
    <div className="relative pt-5">
      {nowMarker.visible ? (
        <div
          className="pointer-events-none absolute bottom-0 top-5 z-10 w-0.5 bg-destructive"
          style={{
            left: `calc(150px + (100% - 150px) * ${nowMarker.fraction})`,
          }}
        >
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-destructive px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-destructive-foreground">
            Now · {nowMarker.label}
          </div>
          <div className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive" />
        </div>
      ) : null}

      <div className="mb-2 flex justify-between pl-[150px] text-[11px] text-muted-foreground">
        {axisTicks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2.5">
            <div className="flex w-[140px] shrink-0 min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  row.isRemote ? "bg-sky-500" : "bg-accent",
                )}
              />
              <span className="truncate text-sm">{row.name}</span>
            </div>
            <div className="relative h-6 flex-1 rounded-md bg-muted/60">
              {row.blocks.map((block, index) => (
                <div
                  key={`${row.key}-${index}`}
                  title={block.title}
                  className={cn(
                    "absolute top-0.5 bottom-0.5 rounded-sm",
                    block.filled
                      ? "bg-accent"
                      : "border border-dashed border-accent/50 bg-accent/15",
                  )}
                  style={{
                    left: `${block.leftPct}%`,
                    width: `${block.widthPct}%`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
