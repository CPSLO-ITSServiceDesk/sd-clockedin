"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import { useNow } from "@/hooks/use-now"
import { useActiveTermTeamsSyncStatus } from "@/hooks/use-teams-sync"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import { formatTimeAgo } from "@/lib/format-time"
import { getOrgLocalMinutes, ORG_TIMEZONE } from "@/lib/org-time"
import { isScheduledDuringHour } from "@/lib/shifts/dashboard-stats"
import {
  buildOutToday,
  buildUpNext,
  buildWorkingTiles,
  type WorkingTile,
} from "@/lib/shifts/today-board"
import { cn } from "@/lib/utils"

/** The design canvas; the whole display scales to fit the screen. */
const CANVAS_WIDTH = 1920
const CANVAS_HEIGHT = 1080

/**
 * Below this scale the display stops shrinking and reflows instead (columns
 * stack), so small windows stay readable.
 */
const MIN_SCALE = 0.6

/** Canvas sizes (in design px) where the layout steps down. */
const STACK_BELOW_WIDTH = 1750
const STACK_BELOW_HEIGHT = 850

// The display runs unattended for days, so keep "synced N min ago" fresh.
const SYNC_STATUS_REFRESH_MS = 5 * 60_000

/** Names in the "Here" list before it splits into two columns, and the cap after that. */
const HERE_SINGLE_COLUMN_MAX = 8
const HERE_MAX = 16
const ARRIVING_MAX = 5
const OUT_TODAY_MAX = 4

// The ambient display is brand-colored in both themes.
const COLORS = {
  background: "bg-[#154734]",
  muted: "text-[#B9D3C5]",
  gold: "text-[#E8B64A]",
  track: "bg-[#2C5E49]",
}

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
}

interface CanvasSize {
  scale: number
  width: number
  height: number
}

// useSyncExternalStore needs a stable snapshot, so the size is cached as a string key.
function getCanvasKey(): string {
  const fit = Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT)
  const scale = Math.max(MIN_SCALE, fit)
  return `${scale}|${window.innerWidth / scale}|${window.innerHeight / scale}`
}

function useCanvasSize(): CanvasSize | null {
  const key = useSyncExternalStore(subscribeResize, getCanvasKey, () => null)
  if (!key) return null
  const [scale, width, height] = key.split("|").map(Number)
  return { scale, width, height }
}

function formatClock(now: Date): { hm: string; period: string; date: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ""

  return {
    hm: `${get("hour")}:${get("minute")}`,
    period: get("dayPeriod").toUpperCase(),
    date: now.toLocaleDateString("en-US", {
      timeZone: ORG_TIMEZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
  }
}

/** "10:22 AM" → "10:22" */
function stripPeriod(label: string): string {
  return label.replace(/\s?[AP]M$/i, "")
}

function SectionLabel({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <span className={cn("text-2xl font-semibold uppercase tracking-[0.12em]", COLORS.muted, className)}>
      {children}
    </span>
  )
}

function HereRow({ tile, compact }: Readonly<{ tile: WorkingTile; compact: boolean }>) {
  let since = "remote"
  if (tile.clockInLabel) since = `${tile.late ? "late " : ""}${stripPeriod(tile.clockInLabel)}`
  else if (!tile.isRemote) since = "walk-in"

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex min-w-0 items-baseline justify-between gap-6">
        <span
          className={cn(
            "truncate font-bold tracking-[-0.01em]",
            compact ? "text-[30px]" : "text-[38px]",
          )}
        >
          {tile.name}
        </span>
        <span className={cn("shrink-0 font-mono", compact ? "text-xl" : "text-2xl", COLORS.muted)}>
          <span className={cn(tile.late && COLORS.gold)}>{since}</span>
          {tile.endLabel ? (
            <>
              {" → "}
              <span className="text-white">{stripPeriod(tile.endLabel)}</span>
            </>
          ) : null}
        </span>
      </div>
      <div className={cn("h-2 overflow-hidden rounded-full", COLORS.track)}>
        <div
          className={cn("h-full rounded-full", tile.late ? "bg-[#E8B64A]" : "bg-white")}
          style={{ width: `${tile.progress ?? 0}%` }}
        />
      </div>
    </div>
  )
}

export function WallDisplay() {
  const canvas = useCanvasSize()
  const canvasWidth = canvas?.width ?? CANVAS_WIDTH
  const stacked = canvasWidth < STACK_BELOW_WIDTH || (canvas?.height ?? CANVAS_HEIGHT) < STACK_BELOW_HEIGHT

  const mountedNow = useNow(1000)
  const now = mountedNow ?? new Date(0)
  const { shifts, timeOffShifts, isLoading, error } = useTodayShiftList({ includeRemote: true })
  const { data: syncStatus } = useActiveTermTeamsSyncStatus({
    refetchIntervalMs: SYNC_STATUS_REFRESH_MS,
  })

  const ready = Boolean(mountedNow) && !isLoading
  const tiles = mountedNow ? buildWorkingTiles(shifts, now) : []
  const arriving = mountedNow ? buildUpNext(shifts, now).slice(0, ARRIVING_MAX) : []
  const outToday = mountedNow ? buildOutToday(timeOffShifts, now).slice(0, OUT_TODAY_MAX) : []
  const clock = formatClock(now)

  const currentHour = Math.floor(getOrgLocalMinutes(now) / 60)
  const scheduledThisHour = new Set(
    shifts
      .filter((shift) => shift.startTime && isScheduledDuringHour(shift, currentHour))
      .map((shift) => shift.studentAssistantId),
  ).size

  const twoColumns = tiles.length > HERE_SINGLE_COLUMN_MAX
  const overflow = tiles.length > HERE_MAX ? tiles.length - (HERE_MAX - 1) : 0
  const hereTiles = overflow > 0 ? tiles.slice(0, HERE_MAX - 1) : tiles

  let hereBody: ReactNode
  if (!ready) {
    hereBody = <span className={cn("text-3xl", COLORS.muted)}>Loading...</span>
  } else if (error) {
    hereBody = <span className="text-3xl text-[#F2B856]">Couldn&apos;t load today&apos;s shifts</span>
  } else if (tiles.length === 0) {
    hereBody = <span className={cn("text-[34px]", COLORS.muted)}>No one is on the desk right now.</span>
  } else {
    hereBody = (
      <div className={cn("grid gap-x-12", twoColumns ? "grid-cols-2 gap-y-4" : "grid-cols-1 gap-y-[18px]")}>
        {hereTiles.map((tile) => (
          <HereRow key={tile.studentAssistantId} tile={tile} compact={twoColumns} />
        ))}
        {overflow > 0 ? (
          <span className={cn("self-center text-[30px] font-bold", COLORS.muted)}>+{overflow} more</span>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "h-dvh w-full text-white",
        COLORS.background,
        stacked ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden",
      )}
    >
      {/* zoom (not transform) so the scaled canvas keeps a real layout size and can scroll when stacked. */}
      <div
        className="flex flex-col gap-10 px-16 py-12"
        style={{
          zoom: canvas?.scale ?? 1,
          width: canvasWidth,
          ...(stacked ? { minHeight: canvas?.height } : { height: canvas?.height ?? CANVAS_HEIGHT }),
          visibility: canvas === null ? "hidden" : "visible",
        }}
      >
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <svg
              width={34}
              height={34}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E8B64A"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[30px] font-bold">Service Desk</span>
            {mountedNow ? <span className={cn("text-2xl", COLORS.muted)}>{clock.date}</span> : null}
          </div>
          {mountedNow ? (
            <span className="font-mono text-[56px] font-semibold tracking-[-0.03em] tabular-nums">
              {clock.hm}
              <span className={cn("ml-2.5 text-[30px]", COLORS.gold)}>{clock.period}</span>
            </span>
          ) : null}
        </header>

        <div
          className={cn(
            "grid gap-16",
            stacked
              ? "grid-cols-1 gap-y-12"
              : "min-h-0 flex-1 grid-cols-[520px_minmax(0,1fr)_460px]",
          )}
        >
          <div className={cn("flex flex-col gap-2", !stacked && "justify-end")}>
            <SectionLabel className="text-[26px]">Working now</SectionLabel>
            <span
              className={cn(
                // Size before leading: tailwind-merge drops a leading-* that comes before a text-* size.
                stacked ? "text-[240px]" : "text-[360px]",
                "font-extrabold leading-[0.85] tracking-[-0.06em] tabular-nums",
                COLORS.gold,
              )}
            >
              {ready ? tiles.length : "–"}
            </span>
            <span className="text-[30px]">
              {ready
                ? scheduledThisHour > 0
                  ? `of ${scheduledThisHour} scheduled this hour`
                  : "nobody scheduled this hour"
                : " "}
            </span>
            {syncStatus?.graph_configured && syncStatus.status === "success" && syncStatus.finished_at ? (
              <span className={cn("mt-6 flex items-center gap-2.5 text-lg", COLORS.muted)}>
                <span className="size-2.5 rounded-full bg-[#4ED19A]" />
                Teams Shifts · synced {formatTimeAgo(syncStatus.finished_at, now)}
              </span>
            ) : null}
          </div>

          <div className={cn("flex min-w-0 flex-col gap-[18px] pt-3", !stacked && "min-h-0 overflow-hidden")}>
            <SectionLabel>Here</SectionLabel>
            {hereBody}
          </div>

          <div className={cn("flex flex-col gap-7 pt-3", !stacked && "min-h-0")}>
            <div className="flex flex-col gap-[18px]">
              <SectionLabel>Arriving</SectionLabel>
              {ready && arriving.length === 0 ? (
                <span className={cn("text-[28px]", COLORS.muted)}>No one in the next 2 hours.</span>
              ) : (
                arriving.map((entry) => (
                  <div key={entry.studentAssistantId} className="flex min-w-0 items-baseline gap-5">
                    <span className={cn("w-[130px] shrink-0 font-mono text-[26px]", COLORS.gold)}>
                      {entry.start}
                    </span>
                    <span className="truncate text-[32px] font-semibold">{entry.name}</span>
                    {entry.isRemote ? (
                      <span className={cn("shrink-0 text-xl", COLORS.muted)}>remote</span>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {stacked ? null : <div className="flex-1" />}

            {outToday.length > 0 ? (
              <section className="flex flex-col gap-3.5 rounded-3xl bg-[#E8EFF8] p-7">
                <span className="text-2xl font-bold uppercase tracking-[0.12em] text-[#1F3A63]">Out today</span>
                {outToday.map((entry) => (
                  <div key={entry.studentAssistantId} className="flex min-w-0 items-baseline justify-between gap-4">
                    <span className="truncate text-[30px] font-semibold text-[#1F3A63]">{entry.name}</span>
                    <span className="shrink-0 text-[22px] text-[#2B4C7E]">{entry.window}</span>
                  </div>
                ))}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
