"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import { useNow } from "@/hooks/use-now"
import { useActiveTermTeamsSyncStatus } from "@/hooks/use-teams-sync"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import { getAvatarToneClass } from "@/lib/avatar-tones"
import { formatTimeAgo } from "@/lib/format-time"
import { ORG_TIMEZONE } from "@/lib/org-time"
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
 * Below this scale the display stops shrinking and reflows instead (fewer
 * tile columns, sidebar under the tiles), so small windows stay readable.
 */
const MIN_SCALE = 0.6

/** Canvas sizes (in design px) where the layout steps down. */
const STACK_BELOW_WIDTH = 1500
const STACK_BELOW_HEIGHT = 850
const NARROW_BELOW_WIDTH = 1000
const COMPACT_BELOW_WIDTH = 1700

// The display runs unattended for days, so keep "synced N min ago" fresh.
const SYNC_STATUS_REFRESH_MS = 5 * 60_000

const MAX_TILES = 9
const MAX_TILES_DENSE = 16

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

function ClockIcon({ size }: Readonly<{ size: number }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function PersonTile({ tile, dense }: Readonly<{ tile: WorkingTile; dense: boolean }>) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border border-border bg-card",
        dense ? "gap-3 p-5" : "gap-[18px] p-6",
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full font-bold",
            dense ? "size-12 text-lg" : "size-16 text-2xl",
            getAvatarToneClass(tile.studentAssistantId),
          )}
        >
          {tile.initials}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "truncate font-bold tracking-[-0.01em]",
              dense ? "text-[22px]" : "text-[28px]",
            )}
          >
            {tile.name}
          </span>
          <span className={cn("truncate text-muted-foreground", dense ? "text-base" : "text-xl")}>
            {tile.role}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          {tile.progress !== null ? (
            <div
              className={cn(
                "h-full rounded-full",
                tile.late ? "bg-[var(--status-pending)]" : "bg-accent",
              )}
              style={{ width: `${tile.progress}%` }}
            />
          ) : null}
        </div>
        <div
          className={cn(
            "flex justify-between gap-3 font-mono text-muted-foreground",
            dense ? "text-base" : "text-xl",
          )}
        >
          <span className={cn(tile.late && "text-amber-700 dark:text-amber-300")}>
            {tile.inLabel}
          </span>
          {tile.endLabel ? <span>until {tile.endLabel}</span> : null}
        </div>
      </div>
    </div>
  )
}

export function WallDisplay() {
  const canvas = useCanvasSize()
  const canvasWidth = canvas?.width ?? CANVAS_WIDTH
  const stacked = canvasWidth < STACK_BELOW_WIDTH || (canvas?.height ?? CANVAS_HEIGHT) < STACK_BELOW_HEIGHT
  const narrow = canvasWidth < NARROW_BELOW_WIDTH
  // Side by side but with less room for tiles: one column fewer.
  const compact = !stacked && canvasWidth < COMPACT_BELOW_WIDTH
  const mountedNow = useNow(1000)
  const now = mountedNow ?? new Date(0)
  const { shifts, timeOffShifts, isLoading, error } = useTodayShiftList({ includeRemote: true })
  const { data: syncStatus } = useActiveTermTeamsSyncStatus({
    refetchIntervalMs: SYNC_STATUS_REFRESH_MS,
  })

  const tiles = mountedNow ? buildWorkingTiles(shifts, now) : []
  const upNext = mountedNow ? buildUpNext(shifts, now) : []
  const outToday = mountedNow ? buildOutToday(timeOffShifts, now) : []
  const clock = formatClock(now)

  const dense = tiles.length > MAX_TILES
  const tileLimit = dense ? MAX_TILES_DENSE : MAX_TILES
  const overflow = tiles.length > tileLimit ? tiles.length - (tileLimit - 1) : 0
  const visibleTiles = overflow > 0 ? tiles.slice(0, tileLimit - 1) : tiles

  let tileArea: ReactNode
  if (isLoading || !mountedNow) {
    tileArea = <p className="text-3xl text-muted-foreground">Loading...</p>
  } else if (error) {
    tileArea = <p className="text-3xl text-destructive">Couldn&apos;t load today&apos;s shifts</p>
  } else if (tiles.length === 0) {
    tileArea = <p className="text-3xl text-muted-foreground">No one is working right now.</p>
  } else {
    tileArea = (
      <div
        className={cn(
          "grid content-start gap-4",
          narrow
            ? dense ? "grid-cols-2" : "grid-cols-1"
            : stacked || compact
              ? dense ? "grid-cols-3" : "grid-cols-2"
              : dense ? "grid-cols-4" : "grid-cols-3",
        )}
      >
        {visibleTiles.map((tile) => (
          <PersonTile key={tile.studentAssistantId} tile={tile} dense={dense} />
        ))}
        {overflow > 0 ? (
          <div className="flex items-center justify-center rounded-3xl border border-dashed border-border text-[28px] font-bold text-muted-foreground">
            +{overflow} more
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "h-dvh w-full bg-background text-foreground",
        stacked ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden",
      )}
    >
      {/* zoom (not transform) so the scaled canvas keeps a real layout size and can scroll when stacked. */}
      <div
        className="flex flex-col gap-9 px-14 py-12"
        style={{
          zoom: canvas?.scale ?? 1,
          width: canvasWidth,
          ...(stacked ? { minHeight: canvas?.height } : { height: canvas?.height ?? CANVAS_HEIGHT }),
          visibility: canvas === null ? "hidden" : "visible",
        }}
      >
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 items-center justify-center rounded-[14px] bg-accent text-accent-foreground">
                <ClockIcon size={26} />
              </div>
              <span className="text-[28px] font-bold">Service Desk</span>
            </div>
            <span className="text-[56px] font-bold leading-none tracking-[-0.03em]">
              {mountedNow && !isLoading ? `${tiles.length} working now` : " "}
            </span>
          </div>
          {mountedNow ? (
            <div className="flex flex-col items-end gap-1.5">
              <span className="font-mono text-[88px] font-semibold leading-[0.9] tracking-[-0.04em] tabular-nums">
                {clock.hm}
                <span className="ml-3 text-[40px] text-accent">{clock.period}</span>
              </span>
              <span className="text-[22px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {clock.date}
              </span>
            </div>
          ) : null}
        </header>

        <div
          className={cn(
            "grid gap-7",
            stacked ? "grid-cols-1" : "min-h-0 flex-1 grid-cols-[minmax(0,1fr)_520px]",
          )}
        >
          <div className={cn(!stacked && "min-h-0 overflow-hidden")}>{tileArea}</div>

          <aside className={cn("flex flex-col gap-5", !stacked && "min-h-0")}>
            <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-7">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[30px] font-bold">Up next</h2>
                <span className="text-xl text-muted-foreground">next 2 hours</span>
              </div>
              {upNext.length === 0 ? (
                <p className="text-2xl text-muted-foreground">No one else starting soon.</p>
              ) : (
                upNext.slice(0, 6).map((entry) => (
                  <div key={entry.studentAssistantId} className="flex items-center gap-4 py-2">
                    <span className="w-[120px] shrink-0 font-mono text-2xl font-semibold">
                      {entry.start}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[26px] font-semibold">
                      {entry.name}
                    </span>
                    {entry.isRemote ? (
                      <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-lg font-bold text-muted-foreground">
                        Remote
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </section>

            {outToday.length > 0 ? (
              <section className="flex flex-col gap-4 rounded-3xl bg-sky-500/10 p-7">
                <h2 className="text-[30px] font-bold text-sky-900 dark:text-sky-100">Out today</h2>
                {outToday.slice(0, 5).map((entry) => (
                  <div key={entry.studentAssistantId} className="flex items-center justify-between gap-4">
                    <span className="truncate text-[26px] font-semibold text-sky-900 dark:text-sky-100">
                      {entry.name}
                    </span>
                    <span className="shrink-0 text-xl text-sky-800 dark:text-sky-200">{entry.window}</span>
                  </div>
                ))}
              </section>
            ) : null}

            {stacked ? null : <div className="flex-1" />}
            {syncStatus?.graph_configured && syncStatus.status === "success" && syncStatus.finished_at ? (
              <div className="flex items-center gap-2.5 text-lg text-muted-foreground">
                <span className="size-2.5 rounded-full bg-accent" />
                Schedules from Teams Shifts · synced {formatTimeAgo(syncStatus.finished_at, now)}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  )
}
