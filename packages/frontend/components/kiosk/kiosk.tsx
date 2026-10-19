"use client"

import { useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { DoorOpen, LogIn, LogOut } from "lucide-react"
import { toast } from "sonner"

import { AuthNotifications } from "@/components/auth-notifications"
import { ClockModal } from "@/components/clock-modal"
import { LeadLogin } from "@/components/lead-login"
import { SystemStatus } from "@/components/system-status"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { useActiveTermTeamsSyncStatus } from "@/hooks/use-teams-sync"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { getAvatarToneClass } from "@/lib/avatar-tones"
import { formatTimeAgo } from "@/lib/format-time"
import { ORG_TIMEZONE } from "@/lib/org-time"
import { queryKeys } from "@/lib/query-keys"
import { isDuringLastWorkingHour } from "@/lib/shifts/dashboard-stats"
import {
  buildOutToday,
  buildUpNext,
  buildWorkingTiles,
  type WorkingTile,
} from "@/lib/shifts/today-board"
import { getTodayDay } from "@/lib/shifts/today-shifts"
import { cn } from "@/lib/utils"

function formatClockParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ""

  return {
    hm: `${get("hour")}:${get("minute")}`,
    sec: get("second"),
    period: get("dayPeriod").toUpperCase(),
    date: now.toLocaleDateString("en-US", {
      timeZone: ORG_TIMEZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
  }
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function SyncPill() {
  const now = useNow(60_000)
  const { data: status } = useActiveTermTeamsSyncStatus({ refetchIntervalMs: 5 * 60_000 })
  if (!now || !status?.graph_configured) return null

  let dot = "bg-muted-foreground"
  let detail = "waiting for first sync"
  if (status.status === "error") {
    dot = "bg-destructive"
    detail = "sync failed"
  } else if (status.status === "success" && status.finished_at) {
    dot = "bg-accent"
    detail = `synced ${formatTimeAgo(status.finished_at, now)}`
  }

  return (
    <div className="hidden h-9 items-center gap-2 rounded-full bg-muted px-3.5 text-[13px] sm:flex">
      <span className={cn("size-2 rounded-full", dot)} />
      <span className="font-semibold">Teams Shifts</span>
      <span className="text-muted-foreground">{detail}</span>
    </div>
  )
}

function StatTile({
  value,
  label,
  tone = "default",
}: Readonly<{ value: number | null; label: string; tone?: "default" | "time-off" }>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl border p-4",
        tone === "time-off"
          ? "border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200"
          : "border-border bg-card",
      )}
    >
      <span className="font-mono text-[28px] font-semibold tabular-nums">{value ?? "—"}</span>
      <span className={cn("text-[13px]", tone === "default" && "text-muted-foreground")}>{label}</span>
    </div>
  )
}

function ClockedInCard({
  tile,
  onClockOut,
}: Readonly<{ tile: WorkingTile; onClockOut: () => void }>) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-muted/60 py-3 pl-3.5 pr-3 transition-colors hover:bg-muted">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          getAvatarToneClass(tile.studentAssistantId),
        )}
      >
        {tile.initials}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-semibold">{tile.name}</span>
          {tile.late ? (
            <span className="shrink-0 rounded-full bg-[var(--status-pending)]/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-200">
              Late
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>{tile.clockInLabel ?? tile.inLabel}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
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
          <span>{tile.endLabel ?? "Unscheduled"}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onClockOut}
        aria-label={`Clock out ${tile.name}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
      >
        <DoorOpen className="size-[17px]" />
      </button>
    </div>
  )
}

export function Kiosk() {
  const queryClient = useQueryClient()
  const mountedNow = useNow(1000)
  const now = mountedNow ?? new Date(0)
  const { shifts, timeOffShifts, todayTimeOff, isLoading, error } = useTodayShiftList()
  const [modalMode, setModalMode] = useState<"in" | "out" | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<WorkingTile | null>(null)
  const [clockOutAllOpen, setClockOutAllOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [clockingInId, setClockingInId] = useState<number | null>(null)
  const [arrivalError, setArrivalError] = useState<string | null>(null)

  const clockedIn = mountedNow ? buildWorkingTiles(shifts, now) : []
  const arrivals = mountedNow ? buildUpNext(shifts, now) : []
  const outToday = mountedNow ? buildOutToday(todayTimeOff, timeOffShifts, now) : []
  const clock = formatClockParts(now)
  const ready = mountedNow !== null && !isLoading
  const showClockOutAll = mountedNow !== null && isDuringLastWorkingHour(now)
  const isWeekday = getTodayDay() !== null

  const refreshShifts = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.todayShifts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all }),
    ])

  const handleConfirmClockOut = async () => {
    if (!confirmTarget || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await timeEntriesApi.closeOpenByAssistant(confirmTarget.studentAssistantId)
      await refreshShifts()
      toast.success(`${confirmTarget.name} clocked out`)
      setConfirmTarget(null)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClockOutAll = async () => {
    if (submitting || clockedIn.length === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await Promise.all(
        clockedIn.map((tile) => timeEntriesApi.closeOpenByAssistant(tile.studentAssistantId)),
      )
      await refreshShifts()
      toast.success("Everyone clocked out")
      setClockOutAllOpen(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const handleArrivalClockIn = async (studentAssistantId: number, name: string) => {
    if (clockingInId != null) return
    setClockingInId(studentAssistantId)
    setArrivalError(null)
    try {
      await timeEntriesApi.clockIn({
        student_assistant_id: studentAssistantId,
        clock_in: new Date().toISOString(),
      })
      await refreshShifts()
      toast.success(
        `${name} clocked in at ${new Date().toLocaleTimeString("en-US", {
          timeZone: ORG_TIMEZONE,
          hour: "numeric",
          minute: "2-digit",
        })}`,
      )
    } catch (err) {
      setArrivalError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setClockingInId(null)
    }
  }

  let clockedInBody: ReactNode
  if (!ready) {
    clockedInBody = <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Loading...</p>
  } else if (error) {
    clockedInBody = (
      <p className="col-span-full py-8 text-center text-sm text-destructive">
        Failed to load clocked-in employees
      </p>
    )
  } else if (clockedIn.length === 0) {
    clockedInBody = (
      <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
        No one is currently clocked in
      </p>
    )
  } else {
    clockedInBody = clockedIn.map((tile) => (
      <ClockedInCard
        key={tile.studentAssistantId}
        tile={tile}
        onClockOut={() => {
          setSubmitError(null)
          setConfirmTarget(tile)
        }}
      />
    ))
  }

  let arrivalsEmpty: string | null = null
  if (!ready) arrivalsEmpty = "Loading..."
  else if (error) arrivalsEmpty = "Failed to load expected arrivals"
  else if (!isWeekday) arrivalsEmpty = "No shifts scheduled for weekends"
  else if (arrivals.length === 0 && outToday.length === 0) arrivalsEmpty = "No pending arrivals for today"

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh">
      <AuthNotifications />
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-10">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-[10px] bg-accent text-accent-foreground">
            <ClockIcon />
          </div>
          <div className="flex flex-col gap-px">
            <span className="text-[17px] font-bold tracking-[-0.01em]">SD-ClockedIn</span>
            <span className="text-xs text-muted-foreground">Service Desk</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <SyncPill />
          <ThemeToggle className="size-9 rounded-full" />
          <LeadLogin className="h-9 rounded-full px-4 text-sm font-semibold normal-case tracking-normal" />
        </div>
      </header>

      <main className="grid flex-1 gap-6 px-4 pb-5 pt-7 sm:px-10 lg:min-h-0 lg:grid-cols-[440px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <section className="flex flex-col gap-7 rounded-[20px] border border-border bg-card p-8">
            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {mountedNow ? clock.date : " "}
              </span>
              <div className="flex items-baseline gap-2.5 font-mono tabular-nums">
                <span className="text-[84px] font-semibold leading-none tracking-[-0.04em]">
                  {mountedNow ? clock.hm : "--:--"}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[22px] font-medium text-muted-foreground">
                    {mountedNow ? clock.sec : "--"}
                  </span>
                  <span className="text-lg font-semibold text-accent">{mountedNow ? clock.period : ""}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <Button
                onClick={() => setModalMode("in")}
                className="h-[60px] rounded-[14px] bg-accent text-lg font-bold text-accent-foreground hover:bg-accent/90"
              >
                <LogIn className="size-5" strokeWidth={2.25} />
                Clock in
              </Button>
              <Button
                variant="outline"
                onClick={() => setModalMode("out")}
                className="h-[60px] rounded-[14px] border-border bg-card text-lg font-bold hover:bg-muted"
              >
                <LogOut className="size-5" strokeWidth={2.25} />
                Clock out
              </Button>
            </div>
          </section>

          <div className="grid grid-cols-3 gap-2.5">
            <StatTile value={ready ? clockedIn.length : null} label="On shift" />
            <StatTile value={ready ? arrivals.length : null} label="Arriving · 2 hrs" />
            <StatTile value={ready ? outToday.length : null} label="Time off today" tone="time-off" />
          </div>

          <div className="hidden flex-1 lg:block" />
          <footer className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <SystemStatus variant="compact" />
            <span className="font-mono">v2.0.0</span>
          </footer>
        </div>

        <div className="grid min-h-0 gap-4 lg:grid-rows-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col rounded-[20px] border border-border bg-card">
            <div className="flex items-center justify-between px-6 pb-3.5 pt-5">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold tracking-[-0.01em]">Clocked in</h2>
                <div className="flex h-[26px] items-center gap-[7px] rounded-full bg-accent/15 px-2.5 text-[13px] font-semibold text-accent">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-accent" />
                  </span>
                  {ready ? clockedIn.length : "—"} on shift
                </div>
              </div>
              {showClockOutAll ? (
                <button
                  type="button"
                  disabled={clockedIn.length === 0 || submitting}
                  onClick={() => {
                    setSubmitError(null)
                    setClockOutAllOpen(true)
                  }}
                  className="h-[34px] rounded-full border border-destructive/30 bg-card px-3.5 text-[13px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Clock out all
                </button>
              ) : null}
            </div>
            <div className="grid min-h-0 flex-1 content-start gap-2.5 overflow-y-auto px-4 pb-4 sm:grid-cols-2">
              {clockedInBody}
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-[20px] border border-border bg-card">
            <div className="flex items-center justify-between px-6 pb-3 pt-5">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-xl font-bold tracking-[-0.01em]">Expected arrivals</h2>
                <span className="text-[13px] text-muted-foreground">In-person staff in the next 2 hours</span>
              </div>
              <span className="font-mono text-[13px] font-semibold text-muted-foreground">
                {ready ? arrivals.length : "—"} pending
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
              {arrivalsEmpty ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{arrivalsEmpty}</p>
              ) : (
                <>
                  {arrivals.map((entry) => (
                    <div
                      key={entry.studentAssistantId}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/60"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-bold text-muted-foreground">
                        {entry.initials}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className="truncate text-[15px] font-semibold">{entry.name}</span>
                        <span className="truncate text-[13px] text-muted-foreground">{entry.role}</span>
                      </div>
                      <span className="hidden shrink-0 rounded-full bg-muted px-2.5 py-1 font-mono text-[13px] sm:inline">
                        {entry.start} – {entry.end}
                      </span>
                      <button
                        type="button"
                        disabled={clockingInId != null}
                        onClick={() => handleArrivalClockIn(entry.studentAssistantId, entry.name)}
                        className="h-[34px] shrink-0 rounded-full bg-accent/15 px-3.5 text-[13px] font-bold text-accent hover:bg-accent/25 disabled:opacity-50"
                      >
                        {clockingInId === entry.studentAssistantId ? "Clocking in..." : "Clock in"}
                      </button>
                    </div>
                  ))}
                  {outToday.map((entry) => (
                    <div key={`off-${entry.studentAssistantId}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-sky-500/50 text-[13px] font-bold text-accent">
                        {entry.initials}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className="truncate text-[15px] font-semibold text-muted-foreground line-through decoration-border">
                          {entry.name}
                        </span>
                        <span className="text-[13px] text-muted-foreground">{entry.window}</span>
                      </div>
                      <span className="shrink-0 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:text-sky-200">
                        {entry.reason ?? "Time off"} · Teams
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
            {arrivalError ? (
              <div className="border-t border-border px-6 py-3 text-sm text-destructive">{arrivalError}</div>
            ) : null}
          </section>
        </div>
      </main>

      <ClockModal
        open={modalMode !== null}
        mode={modalMode ?? "in"}
        onClose={() => setModalMode(null)}
      />

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setConfirmTarget(null)
            setSubmitError(null)
          }
        }}
      >
        <AlertDialogContent className="rounded-[20px] border-border bg-card sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Clock out?</AlertDialogTitle>
            <AlertDialogDescription>
              Clock out {confirmTarget?.name ?? "this person"} now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {submitError && confirmTarget !== null ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="rounded-full">Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={submitting} onClick={handleConfirmClockOut} className="rounded-full">
              {submitting ? "Clocking out..." : "Clock out"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={clockOutAllOpen}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setClockOutAllOpen(false)
            setSubmitError(null)
          }
        }}
      >
        <AlertDialogContent className="rounded-[20px] border-border bg-card sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Clock out everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clock out all {clockedIn.length}{" "}
              {clockedIn.length === 1 ? "person" : "people"} still on shift today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {submitError && clockOutAllOpen ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="rounded-full">Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={submitting} onClick={handleClockOutAll} className="rounded-full">
              {submitting ? "Clocking out..." : "Clock out all"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
