"use client"

import { useRef, useState, type ReactNode } from "react"
import { Clock } from "lucide-react"

import { useNow } from "@/hooks/use-now"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import { getOrgLocalMinutes, ORG_TIMEZONE } from "@/lib/org-time"
import {
  BOARD_STATUS_LABELS,
  BOARD_STATUS_ORDER,
  buildBoardRows,
  filterByLocation,
  findNowGroup,
  groupByStartTime,
  type BoardRow,
  type BoardStatus,
  type LocationFilter,
} from "@/lib/shifts/shift-board"
import { formatStartTimeHeader } from "@/lib/format-time"
import { getTodayDay } from "@/lib/shifts/today-shifts"
import { cn } from "@/lib/utils"

const NOW_TICK_MS = 30_000

const LOCATIONS: { value: LocationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-person", label: "In person" },
  { value: "remote", label: "Remote" },
]

const STATUS_DOT: Record<BoardStatus, string> = {
  on: "bg-emerald-500",
  late: "bg-[var(--status-pending)]",
  absent: "bg-destructive",
  incoming: "bg-muted-foreground/40",
  excused: "bg-sky-400",
  remote: "bg-muted-foreground",
  done: "bg-muted-foreground/70",
}

const STATUS_PILL: Record<BoardStatus, string> = {
  on: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  late: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  absent: "bg-destructive/10 text-destructive",
  incoming: "border border-border bg-card text-muted-foreground",
  excused: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  remote: "bg-muted text-foreground",
  done: "bg-muted text-muted-foreground",
}

const ACTUAL_TONE: Partial<Record<BoardStatus, string>> = {
  late: "text-amber-700 dark:text-amber-300",
  absent: "text-destructive",
  excused: "text-sky-700 dark:text-sky-300",
  remote: "text-muted-foreground",
  done: "text-muted-foreground",
}

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_110px_minmax(0,1.3fr)_minmax(0,1.5fr)_130px] md:gap-4"

type StatusFilter = BoardStatus | "all"

function formatHeaderDate(now: Date): string {
  const day = now.toLocaleDateString("en-US", {
    timeZone: ORG_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const time = now.toLocaleTimeString("en-US", {
    timeZone: ORG_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  })
  return `${day} · ${time}`
}

function ShiftRow({ row }: Readonly<{ row: BoardRow }>) {
  const excused = row.status === "excused"
  return (
    <div className={cn(ROW_GRID, "items-center border-b border-border/60 py-2.5 pl-[21px] pr-6 hover:bg-muted/30")}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            excused
              ? "border-[1.5px] border-dashed border-sky-400 text-sky-800 dark:text-sky-200"
              : "bg-muted text-foreground",
          )}
        >
          {row.initials}
        </span>
        <span className="truncate text-sm font-semibold">{row.name}</span>
      </div>
      <span className="hidden text-sm text-muted-foreground md:inline">{row.role}</span>
      <span
        className={cn(
          "hidden justify-self-start rounded-full px-2.5 py-[3px] text-xs font-semibold md:inline",
          row.isRemote ? "bg-muted text-foreground" : "bg-accent/15 text-accent",
        )}
      >
        {row.isRemote ? "Remote" : "In person"}
      </span>
      <span
        className={cn(
          "order-3 font-mono text-[13px] text-muted-foreground md:order-none md:text-foreground/80",
          excused && "line-through",
        )}
      >
        {row.expected}
      </span>
      <span className={cn("order-4 font-mono text-[13px] md:order-none", ACTUAL_TONE[row.status])}>
        {row.actual}
      </span>
      <span
        className={cn(
          "justify-self-end whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold",
          STATUS_PILL[row.status],
        )}
      >
        {row.status === "late" ? `Late ${row.minutesLate}m` : BOARD_STATUS_LABELS[row.status]}
      </span>
    </div>
  )
}

export function ShiftsTable() {
  const [location, setLocation] = useState<LocationFilter>("all")
  const [status, setStatus] = useState<StatusFilter>("all")
  const groupRefs = useRef(new Map<string, HTMLDivElement>())
  const now = useNow(NOW_TICK_MS)
  const { shifts, timeOffShifts, isLoading, error, refetch } = useTodayShiftList({
    includeRemote: true,
  })

  const nowMinutes = getOrgLocalMinutes(now ?? new Date())
  const byLocation = filterByLocation(buildBoardRows(shifts, timeOffShifts, nowMinutes), location)
  const visible = status === "all" ? byLocation : byLocation.filter((row) => row.status === status)
  const groups = groupByStartTime(visible, nowMinutes)

  const chips: { value: StatusFilter; label: string; count: number; dot: string }[] = [
    { value: "all", label: "All", count: byLocation.length, dot: "bg-foreground" },
    ...BOARD_STATUS_ORDER.map((value) => ({
      value,
      label: BOARD_STATUS_LABELS[value],
      count: byLocation.filter((row) => row.status === value).length,
      dot: STATUS_DOT[value],
    })),
  ]

  const scrollToNow = () => {
    const group = findNowGroup(groups)
    if (group) {
      groupRefs.current.get(group.startTime)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  let body: ReactNode
  if (isLoading) {
    body = <p className="px-6 py-10 text-center text-sm text-muted-foreground">Loading shifts...</p>
  } else if (error) {
    body = (
      <div className="flex flex-col items-center gap-3 px-6 py-10">
        <p className="text-sm text-destructive">Error loading shifts: {error.message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="h-8 rounded-full border border-border px-3.5 text-[13px] font-semibold hover:bg-muted"
        >
          Retry
        </button>
      </div>
    )
  } else if (groups.length === 0) {
    let message = "No shifts match these filters."
    if (shifts.length === 0 && timeOffShifts.length === 0) {
      message = getTodayDay() ? "No shifts scheduled for today." : "No shifts scheduled for weekends."
    }
    body = <p className="px-6 py-10 text-center text-sm text-muted-foreground">{message}</p>
  } else {
    body = groups.map((group) => (
      <div
        key={group.startTime || "walk-in"}
        ref={(element) => {
          if (element) groupRefs.current.set(group.startTime, element)
          else groupRefs.current.delete(group.startTime)
        }}
        className={cn("scroll-mt-24 border-l-[3px]", group.isNow ? "border-accent" : "border-transparent")}
      >
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 pb-2.5 pl-[21px] pr-6 pt-3.5",
            group.isNow ? "bg-accent/5" : "bg-muted/30",
          )}
        >
          <span className="font-mono text-xl font-semibold tracking-[-0.02em]">
            {group.startTime ? formatStartTimeHeader(group.startTime) : "Walk-ins"}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-[3px] text-xs font-semibold text-muted-foreground">
            {group.rows.length} {group.startTime ? "expected" : "unscheduled"}
          </span>
          {group.started ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-[3px] text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {group.onShift} on shift
            </span>
          ) : null}
          {group.isNow ? (
            <span className="rounded-full bg-accent px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-[0.08em] text-accent-foreground">
              Now
            </span>
          ) : null}
        </div>
        {group.rows.map((row) => (
          <ShiftRow key={row.key} row={row} />
        ))}
      </div>
    ))
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <span className="min-h-5 text-[13px] text-muted-foreground">{now ? formatHeaderDate(now) : ""}</span>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Shifts</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full border border-border bg-card p-1">
            {LOCATIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLocation(option.value)}
                className={cn(
                  "h-[30px] rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                  location === option.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={scrollToNow}
            disabled={groups.length === 0}
            className="flex h-[38px] items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
          >
            <Clock className="size-3.5" />
            Go to now
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const active = status === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setStatus(chip.value)}
              aria-pressed={active}
              className={cn(
                "flex h-[34px] items-center gap-2 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <span className={cn("size-2 rounded-full", chip.dot, active && chip.value === "all" && "bg-background")} />
              {chip.label}
              <span className="font-mono text-xs opacity-75">{chip.count}</span>
            </button>
          )
        })}
      </div>

      <section className="overflow-hidden rounded-[20px] border border-border bg-card">
        <div
          className={cn(
            ROW_GRID,
            "hidden border-b border-border/60 px-6 py-3 text-xs font-semibold text-muted-foreground md:grid",
          )}
        >
          <span>Name</span>
          <span>Role</span>
          <span>Location</span>
          <span>Expected</span>
          <span>Actual</span>
          <span className="text-right">Status</span>
        </div>
        {body}
      </section>
    </div>
  )
}
