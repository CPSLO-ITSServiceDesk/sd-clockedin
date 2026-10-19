"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, TriangleAlert } from "lucide-react"

import { Panel, StatCard } from "@/components/admin/schedule-builder/builder-ui"
import { ROLE_BG } from "@/components/admin/schedule-builder/review-grid"
import type { BuilderContext } from "@/components/admin/schedule-builder/schedule-builder"
import { formatTermDate, type Weekday } from "@/components/admin/terms/term-types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { scheduleDraftsApi, type ShiftRole } from "@/lib/api/schedule-drafts"
import { queryKeys } from "@/lib/query-keys"
import {
  DAY_SHORT,
  ROLE_LABEL,
  WEEKDAYS,
  assignedSlots,
  availableHours,
  computeChecks,
  deskHours,
  hoursLabel,
  hourShort,
  roleAt,
  slotRange,
  summarizeCells,
  toRuns,
} from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

const ROLE_ORDER: ShiftRole[] = ["L", "m", "t"]

export function StepPublish(context: Readonly<BuilderContext>) {
  const { draft, people, nameOf, goTo, runPublish, flush, busy } = context
  const [selected, setSelected] = useState<{ day: Weekday; hour: number }>({
    day: "monday",
    hour: Math.floor(draft.rules.desk_start_slot / 2),
  })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [justPublished, setJustPublished] = useState(false)

  const checks = useMemo(() => computeChecks(draft.people, draft.rules), [draft.people, draft.rules])
  const hours = deskHours(draft.rules)
  const minOnDesk = draft.rules.min_on_desk.enabled ? draft.rules.min_on_desk.value : 1

  // Re-compare whenever any shift changes; flush first so the server sees the latest edits.
  const signature = useMemo(
    () =>
      draft.people
        .map((person) => `${person.student_assistant_id}:${WEEKDAYS.map((day) => assignedSlots(person, day).join(",")).join("|")}`)
        .join(";"),
    [draft.people],
  )
  const { data: preview, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: [...queryKeys.scheduleDrafts.preview(draft.id), signature],
    queryFn: async () => {
      await flush()
      return scheduleDraftsApi.publishPreview(draft.id)
    },
  })

  const hourSlots = (hour: number) =>
    [hour * 2, hour * 2 + 1].filter((slot) => slot >= draft.rules.desk_start_slot && slot < draft.rules.desk_end_slot)
  const cellStats = (day: Weekday, hour: number) => {
    const slots = hourSlots(hour)
    return {
      all: Math.min(...slots.map((slot) => checks.headcount(day, slot))),
      leads: Math.min(...slots.map((slot) => checks.leads(day, slot))),
    }
  }

  const onAtSelected = people
    .map((person) => {
      const slots = hourSlots(selected.hour).filter((slot) => roleAt(person, selected.day, slot))
      if (slots.length === 0) return null
      const role = roleAt(person, selected.day, slots[0])!
      const run = toRuns(assignedSlots(person, selected.day)).find(([a, b]) => slots[0] >= a && slots[0] < b)!
      return { person, role, run }
    })
    .filter((entry) => entry != null)
  const selectedStats = cellStats(selected.day, selected.hour)
  const noAvailability = people.filter((person) => availableHours(person) === 0).length

  const publish = async () => {
    setConfirmOpen(false)
    if (await runPublish()) setJustPublished(true)
  }

  const term = preview?.term
  const published = draft.status === "published"
  // Publishing logs last, so any later entry means there are unpublished edits.
  const upToDate = published && (draft.change_log[draft.change_log.length - 1]?.text.startsWith("Published") ?? false)

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard
            label="Desk hours"
            value={hoursLabel(checks.totalHours)}
            sub={draft.rules.weekly_budget.enabled ? `of ${draft.rules.weekly_budget.hours}h budget` : "per week"}
            tone={checks.overBudget ? "warn" : undefined}
          />
          <StatCard label="Shifts" value={checks.totalShifts} sub="weekly, repeating" />
          <StatCard
            label="No-lead hours"
            value={checks.noLead.length / 2}
            sub={checks.noLead.length ? summarizeCells(checks.noLead) : "none"}
            tone={checks.noLead.length ? "bad" : "good"}
          />
          <StatCard
            label="Outside requests"
            value={checks.outOfRange.length}
            sub="people"
            tone={checks.outOfRange.length ? "warn" : "good"}
          />
        </div>

        <Panel className="flex flex-col gap-2.5 px-5 py-[18px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-bold">Headcount by hour</span>
            <span className="text-xs text-muted-foreground">
              People on the desk each hour, leads underneath. Click an hour to see who.
            </span>
          </div>
          <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-1">
            <span />
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-center text-[13px] font-bold">
                {DAY_SHORT[day]}
              </span>
            ))}
            {hours.map((hour) => (
              <div key={hour} className="contents">
                <span className="self-center font-mono text-xs text-muted-foreground">{hourShort(hour)}</span>
                {WEEKDAYS.map((day) => {
                  const stats = cellStats(day, hour)
                  const noLead = draft.rules.lead_every_slot.enabled && stats.leads === 0
                  const thin = stats.all < minOnDesk
                  const on = selected.day === day && selected.hour === hour
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSelected({ day, hour })}
                      title={`${DAY_SHORT[day]} ${hourShort(hour)}: ${stats.all} on desk, ${stats.leads} leads`}
                      className={cn(
                        "flex h-[42px] flex-col items-center justify-center gap-px rounded-[10px] border",
                        noLead
                          ? "border-destructive/30 bg-destructive/10"
                          : thin
                            ? "border-amber-500/30 bg-amber-500/15"
                            : "border-transparent bg-accent/10",
                        on && "outline-2 outline-offset-2 outline-accent",
                      )}
                    >
                      <span className="font-mono text-base font-semibold">{stats.all}</span>
                      <span
                        className={cn(
                          "text-[10px] font-bold",
                          noLead ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {noLead ? "no lead" : `${stats.leads} lead${stats.leads === 1 ? "" : "s"}`}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-col gap-2.5 rounded-[14px] bg-muted/50 px-4 py-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="font-mono text-[15px] font-semibold">
                {DAY_SHORT[selected.day]} {hourShort(selected.hour)}
              </span>
              <span
                className={cn(
                  "text-[13px] font-bold",
                  draft.rules.lead_every_slot.enabled && selectedStats.leads === 0
                    ? "text-destructive"
                    : selectedStats.all < minOnDesk
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-accent",
                )}
              >
                {selectedStats.all} on desk · {selectedStats.leads} {selectedStats.leads === 1 ? "lead" : "leads"}
              </span>
            </div>
            {onAtSelected.length === 0 ? (
              <span className="text-[13px] text-muted-foreground">Nobody is scheduled this hour.</span>
            ) : (
              ROLE_ORDER.map((role) => {
                const group = onAtSelected.filter((entry) => entry.role === role)
                if (group.length === 0) return null
                return (
                  <div key={role} className="grid gap-2.5 sm:grid-cols-[90px_minmax(0,1fr)]">
                    <span className="pt-[5px] text-xs font-bold text-muted-foreground">{ROLE_LABEL[role]}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {group.map(({ person, run }) => (
                        <span
                          key={person.student_assistant_id}
                          className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-card pr-2.5 pl-[5px] text-xs font-semibold"
                        >
                          <span className={cn("size-[18px] rounded-[5px]", ROLE_BG[role])} />
                          {nameOf(person.student_assistant_id)}
                          <span className="font-mono font-medium text-muted-foreground">{slotRange(run[0], run[1])}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-3.5">
        <Panel className="flex flex-col gap-3 px-5 py-[18px]">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-role-training/15 text-role-training">
              <CalendarDays className="size-[17px]" />
            </span>
            <span className="text-base font-bold">Publish to Schedules</span>
          </div>

          <div className="flex flex-col gap-2 text-[13px]">
            <Row label="Term" value={term?.name ?? context.termName} />
            <Row
              label="Repeats weekly"
              value={
                term?.start_date && term.end_date
                  ? `${formatTermDate(term.start_date)} – ${formatTermDate(term.end_date)}`
                  : "Term dates not set"
              }
            />
            <Row
              label="Skips"
              value={
                term && term.skips.length > 0
                  ? `${term.skips.map((skip) => formatTermDate(skip.date)).join(", ")} (from Terms)`
                  : "None"
              }
            />
          </div>

          <div className="flex flex-col gap-1.5 rounded-[14px] bg-muted/50 px-3.5 py-3">
            <span className="text-xs font-bold">Compared with Schedules now</span>
            {previewLoading ? (
              <span className="text-[13px] text-muted-foreground">Comparing...</span>
            ) : previewError || !preview ? (
              <span className="text-[13px] text-destructive">Couldn&apos;t compare with current schedules.</span>
            ) : (
              <>
                <Diff label="New shifts" value={`+${preview.new_shifts}`} className="text-accent" />
                <Diff label="Removed shifts" value={`−${preview.removed_shifts}`} className="text-destructive" />
                <Diff label="Unchanged (entries stay linked)" value={String(preview.unchanged_shifts)} />
                <Diff label="Students affected" value={String(preview.students_affected)} />
              </>
            )}
          </div>

          {preview?.teams_sync_enabled ? (
            <div className="flex gap-2 rounded-xl bg-amber-500/15 px-3 py-2.5 text-xs leading-[1.45] text-amber-800 dark:text-amber-200">
              <TriangleAlert className="mt-px size-4 shrink-0" />
              <span>
                Teams sync is on. The next sync replaces these shifts with what&apos;s in Teams Shifts for
                anyone on the Teams roster, so enter the same schedule in Teams before it runs.
              </span>
            </div>
          ) : null}

          {justPublished || upToDate ? (
            <div className="flex flex-col gap-0.5 rounded-[14px] bg-accent/15 px-3.5 py-3">
              <span className="text-sm font-bold text-accent">Published to Schedules</span>
              <span className="text-xs text-accent">
                {checks.totalShifts} shifts saved for {context.termName}.{" "}
                <Link href="/admin/schedules" className="font-semibold underline">
                  View in Schedules
                </Link>
              </span>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy === "publish" || checks.totalShifts === 0}
              onClick={() => setConfirmOpen(true)}
              className="h-11 rounded-full bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy === "publish"
                ? "Publishing..."
                : published
                  ? `Publish changes (${checks.totalShifts} shifts)`
                  : `Publish ${checks.totalShifts} shifts`}
            </button>
          )}
        </Panel>

        <Panel className="flex flex-col gap-2 px-5 py-4">
          <span className="text-sm font-bold">Still open</span>
          {checks.noLead.length === 0 && checks.outOfRange.length === 0 && noAvailability === 0 ? (
            <span className="text-[13px] text-muted-foreground">Nothing. Every hour has a lead and everyone is in range.</span>
          ) : null}
          {checks.noLead.length > 0 ? (
            <OpenItem tone="bad">No lead on {summarizeCells(checks.noLead, 4)}</OpenItem>
          ) : null}
          {checks.outOfRange.length > 0 ? (
            <OpenItem tone="warn">
              {checks.outOfRange
                .slice(0, 4)
                .map((person) => nameOf(person.student_assistant_id))
                .join(", ")}
              {checks.outOfRange.length > 4 ? ` +${checks.outOfRange.length - 4}` : ""} outside their requested hours
            </OpenItem>
          ) : null}
          {noAvailability > 0 ? (
            <OpenItem tone="warn">{noAvailability} people have no availability and aren&apos;t scheduled</OpenItem>
          ) : null}
          <button type="button" onClick={() => goTo(3)} className="self-start text-[13px] font-semibold text-accent hover:underline">
            Back to review
          </button>
        </Panel>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Publish {checks.totalShifts} shifts?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces each student&apos;s weekly schedule for {context.termName}
              {preview ? ` (${preview.students_affected} students change)` : ""}. Shifts that don&apos;t
              change keep their clock-in history linked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void publish()}>Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  )
}

function Diff({ label, value, className }: Readonly<{ label: string; value: string; className?: string }>) {
  return (
    <div className="flex justify-between text-[13px]">
      <span>{label}</span>
      <span className={cn("font-mono font-semibold", className)}>{value}</span>
    </div>
  )
}

function OpenItem({ tone, children }: Readonly<{ tone: "warn" | "bad"; children: React.ReactNode }>) {
  return (
    <div className="flex items-start gap-2 text-[13px] leading-[1.4]">
      <span className={cn("mt-[5px] size-2 shrink-0 rounded-full", tone === "bad" ? "bg-destructive" : "bg-amber-500")} />
      <span>{children}</span>
    </div>
  )
}
