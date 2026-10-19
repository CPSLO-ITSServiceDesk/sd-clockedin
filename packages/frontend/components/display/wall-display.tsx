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
const CANVAS_HEIGHT = 540

/**
 * Below this scale the display stops shrinking and reflows instead (columns
 * stack), so small windows stay readable.
 */
const MIN_SCALE = 0.6

/** Canvas sizes (in design px) where the layout steps down. */
const STACK_BELOW_WIDTH = 1600
const STACK_BELOW_HEIGHT = 480

// The display runs unattended for days, so keep "synced N min ago" fresh.
const SYNC_STATUS_REFRESH_MS = 5 * 60_000

/** The "Here" list fills two columns of four rows, top to bottom. */
const HERE_ROWS = 4
const HERE_MAX = HERE_ROWS * 2
const ARRIVING_MAX = 4
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

function SectionLabel({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className={cn("text-[22px] font-semibold uppercase tracking-[0.12em]", COLORS.muted)}>
      {children}
    </span>
  )
}

function HereRow({ tile }: Readonly<{ tile: WorkingTile }>) {
  let since = "remote"
  if (tile.clockInLabel) since = stripPeriod(tile.clockInLabel)
  else if (!tile.isRemote) since = "walk-in"

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[28px] font-bold leading-[1.15]">{tile.name}</span>
        <span className={cn("whitespace-nowrap font-mono text-xl", COLORS.muted)}>
          <span>{since}</span>
          {tile.endLabel ? (
            <>
              {" → "}
              <span className="text-white">{stripPeriod(tile.endLabel)}</span>
            </>
          ) : null}
        </span>
      </div>
      <div className={cn("h-1.5 overflow-hidden rounded-full", COLORS.track)}>
        <div
          className="h-full rounded-full bg-white"
          style={{ width: `${tile.progress ?? 0}%` }}
        />
      </div>
    </div>
  )
}

export function WallDisplay() {
  const canvas = useCanvasSize()
  const canvasWidth = canvas?.width ?? CANVAS_WIDTH
  const canvasHeight = canvas?.height ?? CANVAS_HEIGHT
  const stacked = canvasWidth < STACK_BELOW_WIDTH || canvasHeight < STACK_BELOW_HEIGHT
  // On screens taller than the strip (e.g. 16:9), keep the strip's height and center it.
  const letterboxed = !stacked && canvasHeight > CANVAS_HEIGHT

  const mountedNow = useNow(1000)
  const now = mountedNow ?? new Date(0)
  const { shifts, timeOffShifts, todayTimeOff, isLoading, error } = useTodayShiftList({ includeRemote: true })
  const { data: syncStatus } = useActiveTermTeamsSyncStatus({
    refetchIntervalMs: SYNC_STATUS_REFRESH_MS,
  })

  const ready = Boolean(mountedNow) && !isLoading
  const tiles = mountedNow ? buildWorkingTiles(shifts, now) : []
  const arriving = mountedNow ? buildUpNext(shifts, now).slice(0, ARRIVING_MAX) : []
  const outToday = mountedNow ? buildOutToday(todayTimeOff, timeOffShifts, now).slice(0, OUT_TODAY_MAX) : []
  const clock = formatClock(now)

  const currentHour = Math.floor(getOrgLocalMinutes(now) / 60)
  const scheduledThisHour = new Set(
    shifts
      .filter((shift) => shift.startTime && isScheduledDuringHour(shift, currentHour))
      .map((shift) => shift.studentAssistantId),
  ).size

  const overflow = tiles.length > HERE_MAX ? tiles.length - (HERE_MAX - 1) : 0
  const hereTiles = overflow > 0 ? tiles.slice(0, HERE_MAX - 1) : tiles

  let hereBody: ReactNode
  if (!ready) {
    hereBody = <span className={cn("text-3xl", COLORS.muted)}>Loading...</span>
  } else if (error) {
    hereBody = <span className="text-3xl text-[#F2B856]">Couldn&apos;t load today&apos;s shifts</span>
  } else if (tiles.length === 0) {
    hereBody = <span className={cn("text-[28px]", COLORS.muted)}>No one is on the desk right now.</span>
  } else {
    hereBody = (
      <div
        className="grid grid-flow-col grid-cols-2 gap-x-9 gap-y-3"
        style={{ gridTemplateRows: `repeat(${HERE_ROWS}, auto)` }}
      >
        {hereTiles.map((tile) => (
          <HereRow key={tile.studentAssistantId} tile={tile} />
        ))}
        {overflow > 0 ? (
          <span className={cn("self-center text-[28px] font-bold", COLORS.muted)}>+{overflow} more</span>
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
        className={cn("flex flex-col gap-5 px-12 py-7", letterboxed && "justify-center")}
        style={{
          zoom: canvas?.scale ?? 1,
          width: canvasWidth,
          ...(stacked ? { minHeight: canvas?.height } : { height: canvas?.height ?? CANVAS_HEIGHT }),
          visibility: canvas === null ? "hidden" : "visible",
        }}
      >
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-3.5">
            <svg
              width={28}
              height={28}
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
            <span className="text-[26px] font-bold">Service Desk</span>
            {mountedNow ? <span className={cn("text-[22px]", COLORS.muted)}>{clock.date}</span> : null}
          </div>
          {mountedNow ? (
            <span className="font-mono text-[44px] font-semibold tracking-[-0.03em] tabular-nums">
              {clock.hm}
              <span className={cn("ml-2 text-2xl", COLORS.gold)}>{clock.period}</span>
            </span>
          ) : null}
        </header>

        <div
          className={cn(
            "grid gap-12",
            stacked
              ? "grid-cols-1 gap-y-10"
              : "min-h-0 grid-cols-[300px_minmax(0,1fr)_340px_360px]",
            !stacked && (letterboxed ? "h-[420px]" : "flex-1"),
          )}
        >
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Working now</SectionLabel>
            <span
              className={cn(
                // Size before leading: tailwind-merge drops a leading-* that comes before a text-* size.
                "text-[240px] font-extrabold leading-[0.85] tracking-[-0.06em] tabular-nums",
                COLORS.gold,
              )}
            >
              {ready ? tiles.length : "–"}
            </span>
            <span className="text-2xl">
              {ready
                ? scheduledThisHour > 0
                  ? `of ${scheduledThisHour} scheduled this hour`
                  : "nobody scheduled this hour"
                : " "}
            </span>
            {syncStatus?.graph_configured && syncStatus.status === "success" && syncStatus.finished_at ? (
              <span className={cn("mt-auto flex items-center gap-2 pt-3 text-base", COLORS.muted)}>
                <span className="size-2 rounded-full bg-[#4ED19A]" />
                Teams Shifts · synced {formatTimeAgo(syncStatus.finished_at, now)}
              </span>
            ) : null}
          </div>

          <div className={cn("flex min-w-0 flex-col gap-3.5", !stacked && "min-h-0 overflow-hidden")}>
            <SectionLabel>Here</SectionLabel>
            {hereBody}
          </div>

          <div className="flex min-w-0 flex-col gap-3.5">
            <SectionLabel>Arriving</SectionLabel>
            {ready && arriving.length === 0 ? (
              <span className={cn("text-2xl", COLORS.muted)}>No one in the next 2 hours.</span>
            ) : (
              arriving.map((entry) => (
                <div key={entry.studentAssistantId} className="flex min-w-0 items-baseline gap-4">
                  <span className={cn("w-[110px] shrink-0 font-mono text-[22px]", COLORS.gold)}>{entry.start}</span>
                  <span className="truncate text-[28px] font-semibold">{entry.name}</span>
                  {entry.isRemote ? <span className={cn("shrink-0 text-lg", COLORS.muted)}>remote</span> : null}
                </div>
              ))
            )}
          </div>

          {outToday.length > 0 ? (
            <section className="flex flex-col gap-3.5 self-start rounded-[20px] bg-[#E8EFF8] px-6 py-5">
              <span className="text-[22px] font-bold uppercase tracking-[0.12em] text-[#1F3A63]">Out today</span>
              {outToday.map((entry) => (
                <div key={entry.studentAssistantId} className="flex min-w-0 items-baseline justify-between gap-4">
                  <span className="truncate text-[28px] font-semibold text-[#1F3A63]">{entry.name}</span>
                  <span className="shrink-0 text-xl text-[#2B4C7E]">{entry.window}</span>
                </div>
              ))}
            </section>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  )
}
