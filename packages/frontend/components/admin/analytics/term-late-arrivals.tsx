"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import type { StudentBreakdownEntry } from "@/lib/api/analytics"
import { parseStrip, type StripCode } from "@/lib/analytics/term-summary"
import { cn } from "@/lib/utils"

const MAX_ROWS = 5
/** Most recent shifts shown in each row's strip. */
const STRIP_LENGTH = 28

const STRIP_CLASSES: Record<StripCode, string> = {
  o: "bg-muted-foreground/30",
  l: "bg-[var(--status-pending)]",
  a: "bg-destructive",
  e: "border-[1.5px] border-dashed border-sky-500/60",
}

const STRIP_LABELS: Record<StripCode, string> = {
  o: "On time",
  l: "Late",
  a: "Absent",
  e: "Excused (not counted)",
}

const GRID =
  "grid grid-cols-[24px_minmax(0,1.6fr)_repeat(4,minmax(0,0.6fr))] md:grid-cols-[32px_minmax(0,1.6fr)_minmax(0,2.6fr)_repeat(4,minmax(0,0.6fr))] gap-3"

export interface LateArrivalRow extends StudentBreakdownEntry {
  name: string
  initials: string
}

export function TermLateArrivals({
  rows,
  isLoading,
}: Readonly<{ rows: LateArrivalRow[]; isLoading: boolean }>) {
  const visible = rows.filter((row) => row.late > 0 || row.absent > 0).slice(0, MAX_ROWS)

  let body: ReactNode
  if (isLoading) {
    body = <p className="px-6 py-8 text-sm text-muted-foreground">Loading...</p>
  } else if (visible.length === 0) {
    body = <p className="px-6 py-8 text-sm text-muted-foreground">No late arrivals or absences recorded yet</p>
  } else {
    body = visible.map((row, index) => {
      const strip = parseStrip(row.strip).slice(-STRIP_LENGTH)
      return (
        <div
          key={row.studentAssistantId}
          className={cn(GRID, "items-center border-b border-border/60 px-6 py-3 last:border-0 hover:bg-muted/40")}
        >
          <span className="font-mono text-[13px] text-muted-foreground">{index + 1}</span>
          <Link
            href={`/admin/studentrecords?student=${row.studentAssistantId}&tab=analytics`}
            className="flex min-w-0 items-center gap-2.5 hover:text-accent"
          >
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
              {row.initials}
            </span>
            <span className="truncate text-sm font-semibold">{row.name}</span>
          </Link>
          <div className="hidden flex-wrap gap-[3px] md:flex" aria-label={`${row.name}'s recent shifts`}>
            {strip.map((code, i) => (
              <span
                key={i}
                title={STRIP_LABELS[code]}
                className={cn("h-3.5 w-[11px] rounded-[3px]", STRIP_CLASSES[code])}
              />
            ))}
          </div>
          <span className="font-mono text-sm font-semibold text-amber-700 dark:text-amber-300">{row.late}</span>
          <span className="font-mono text-sm text-destructive">{row.absent}</span>
          <span className="font-mono text-sm text-sky-700 dark:text-sky-300">{row.excused}</span>
          <span className="text-right font-mono text-sm">
            {row.late > 0 ? `${Math.round(row.avgMinutesLate)}m` : "—"}
          </span>
        </div>
      )
    })
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 pb-2.5 pt-5">
        <h2 className="text-[17px] font-bold">Most late arrivals</h2>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {(Object.keys(STRIP_LABELS) as StripCode[]).map((code) => (
            <span key={code} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-[3px]", STRIP_CLASSES[code])} />
              {STRIP_LABELS[code]}
            </span>
          ))}
        </div>
      </div>
      <div className={cn(GRID, "border-b border-border/60 px-6 py-2.5 text-xs font-semibold text-muted-foreground")}>
        <span>#</span>
        <span>Student</span>
        <span className="hidden md:inline">Recent shifts</span>
        <span>Late</span>
        <span>Absent</span>
        <span>Excused</span>
        <span className="text-right">Avg late</span>
      </div>
      {body}
    </section>
  )
}
