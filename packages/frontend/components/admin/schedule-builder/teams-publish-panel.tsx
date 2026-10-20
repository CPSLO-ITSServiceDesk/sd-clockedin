"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { CalendarDays, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/admin/schedule-builder/builder-ui"
import type { BuilderContext } from "@/components/admin/schedule-builder/schedule-builder"
import {
  WeekRangePicker,
  spanToRange,
  useTermWeeks,
  type WeekSpan,
} from "@/components/admin/schedule-builder/week-range-picker"
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
import { ApiRequestError } from "@/lib/api/client"
import { teamsPublishApi, type TeamsPublishPreview, type TeamsPublishResult } from "@/lib/api/teams-publish"
import { formatTimeAgo } from "@/lib/format-time"
import { queryKeys } from "@/lib/query-keys"
import { WEEKDAYS, assignedSlots, type DraftChecks } from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

const errorText = (err: unknown) =>
  err instanceof ApiRequestError || err instanceof Error ? err.message : "Something went wrong"

/** 14.4 · send the whole draft to Teams Shifts as drafts, for the chosen weeks. */
export function TeamsPublishPanel({ context, checks }: Readonly<{ context: BuilderContext; checks: DraftChecks }>) {
  const { draft, term, flush, reload } = context
  const queryClient = useQueryClient()
  const { weeks, today, firstOpen } = useTermWeeks(term)
  const [span, setSpan] = useState<WeekSpan>({ from: firstOpen, to: Math.max(firstOpen, weeks.length - 1) })
  const range = spanToRange(span, weeks, term, today)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<TeamsPublishResult | null>(null)

  const signature = useMemo(
    () =>
      draft.people
        .map((person) => `${person.student_assistant_id}:${WEEKDAYS.map((day) => assignedSlots(person, day).join(",")).join("|")}`)
        .join(";"),
    [draft.people],
  )
  const previewQuery = useQuery({
    queryKey: [...queryKeys.teamsPublish.draftPreview(draft.id, range?.fromDate ?? "", range?.toDate ?? ""), signature],
    queryFn: async () => {
      await flush()
      return teamsPublishApi.previewDraft(draft.id, range!)
    },
    enabled: range != null,
  })
  const preview = previewQuery.data
  const changes = preview ? preview.create + preview.remove + preview.restore : 0

  const send = async () => {
    if (!range) return
    setConfirmOpen(false)
    setSending(true)
    try {
      await flush()
      const sent = await teamsPublishApi.publishDraft(draft.id, range)
      setResult(sent)
      await Promise.all([
        reload(),
        queryClient.invalidateQueries({ queryKey: queryKeys.teamsPublish.all }),
      ])
      if (sent.failed.length > 0) toast.error(`${sent.failed.length} changes didn't go through. See the details below.`)
      else toast.success("Sent to Teams as drafts")
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Panel className="flex flex-col gap-3 px-5 py-[18px]">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-role-training/15 text-role-training">
            <CalendarDays className="size-[17px]" />
          </span>
          <span className="text-base font-bold">Publish to Teams Shifts</span>
        </div>

        <div className="flex flex-col gap-2 text-[13px]">
          <Line label="Team" value={preview?.scheduling_group ?? "…"} />
          <Line
            label="Skips"
            value={
              preview && preview.skipped_dates.length > 0
                ? `${preview.skipped_dates.map((entry) => format(parseISO(entry.date), "MMM d")).join(", ")} (from Terms)`
                : "None in these weeks"
            }
          />
        </div>

        <WeekRangePicker term={term} value={span} onChange={setSpan} />

        <Comparison
          title="Compared with what's in Teams now"
          preview={preview}
          loading={previewQuery.isFetching && !preview}
          error={previewQuery.error}
          extraRows={preview ? [["People", String(preview.people)]] : []}
        />

        {preview && preview.missing_teams.length > 0 ? (
          <div className="flex gap-2 rounded-xl bg-amber-500/15 px-3 py-2.5 text-xs leading-[1.45] text-amber-800 dark:text-amber-200">
            <TriangleAlert className="mt-px size-4 shrink-0" />
            <span>
              Not linked to a Teams account, so they&apos;re left out:{" "}
              {preview.missing_teams.slice(0, 5).map((person) => person.name).join(", ")}
              {preview.missing_teams.length > 5 ? ` +${preview.missing_teams.length - 5}` : ""}. They link on the next sync once
              they&apos;re in the Teams scheduling group.
            </span>
          </div>
        ) : null}

        <span className="text-xs leading-[1.45] text-muted-foreground">
          Sent as <b className="text-foreground">drafts</b>: students don&apos;t see anything until a manager shares the
          schedule in Teams. ClockedIn picks the shifts up at the next sync after that.
        </span>

        {result ? <SendResult result={result} /> : null}

        <button
          type="button"
          disabled={!range || !preview || changes === 0 || sending || checks.totalShifts === 0}
          onClick={() => setConfirmOpen(true)}
          className="h-11 rounded-full bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
        >
          {sending
            ? "Sending to Teams…"
            : !preview
              ? "Send to Teams as drafts"
              : changes === 0
                ? "Teams already matches"
                : `Send to Teams as drafts (+${preview.create} / −${preview.remove})`}
        </button>
      </Panel>

      <VersionsPanel termId={term.id} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Send this schedule to Teams?</AlertDialogTitle>
            <AlertDialogDescription>
              {preview && range
                ? `For ${format(parseISO(range.fromDate), "MMM d")} – ${format(parseISO(range.toDate), "MMM d")}: ${preview.create} new shifts and ${preview.remove} removals go into Teams as drafts for ${preview.people} people${preview.restore ? `, and ${preview.restore} shifts staged for deletion are restored` : ""}. Nothing changes for students until a manager shares the schedule in Teams.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()}>Send as drafts</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function Line({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  )
}

export function Comparison({
  title,
  preview,
  loading,
  error,
  extraRows = [],
}: Readonly<{
  title: string
  preview: TeamsPublishPreview | undefined
  loading: boolean
  error: unknown
  extraRows?: [string, string][]
}>) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] bg-muted/50 px-3.5 py-3">
      <span className="text-xs font-bold">{title}</span>
      {loading ? (
        <span className="text-[13px] text-muted-foreground">Comparing with Teams…</span>
      ) : error ? (
        <span className="text-[13px] text-destructive">{errorText(error)}</span>
      ) : preview ? (
        <>
          <Row label="New shifts" value={`+${preview.create}${preview.hours_added ? ` (${preview.hours_added} h)` : ""}`} tone={preview.create ? "good" : "muted"} />
          <Row label="Removed" value={`−${preview.remove}${preview.hours_removed ? ` (${preview.hours_removed} h)` : ""}`} tone={preview.remove ? "bad" : "muted"} />
          {preview.restore ? <Row label="Restored (were staged for deletion)" value={String(preview.restore)} /> : null}
          <Row label="Unchanged" value={String(preview.keep)} tone="muted" />
          {extraRows.map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
        </>
      ) : (
        <span className="text-[13px] text-muted-foreground">Pick the weeks to compare.</span>
      )}
    </div>
  )
}

function Row({ label, value, tone }: Readonly<{ label: string; value: string; tone?: "good" | "bad" | "muted" }>) {
  return (
    <div className="flex justify-between text-[13px]">
      <span>{label}</span>
      <span
        className={cn(
          "font-mono font-semibold",
          tone === "good" && "text-accent",
          tone === "bad" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function SendResult({ result }: Readonly<{ result: TeamsPublishResult }>) {
  const failed = result.failed.length
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[14px] px-3.5 py-3 text-xs",
        failed ? "bg-amber-500/15 text-amber-800 dark:text-amber-200" : "bg-accent/15 text-accent",
      )}
    >
      <span className="text-sm font-bold">{failed ? "Sent, with some failures" : "Sent to Teams as drafts"}</span>
      <span>
        +{result.create} / −{result.remove} shifts for {result.students_affected}{" "}
        {result.students_affected === 1 ? "person" : "people"}. Share the schedule in Teams to make it live.
      </span>
      {result.failed.slice(0, 3).map((failure, index) => (
        <span key={index} className="font-mono text-[11px] break-words opacity-80">
          {failure.action}: {failure.message}
        </span>
      ))}
      {failed > 3 ? <span>…and {failed - 3} more. Send again to retry; finished changes are skipped.</span> : null}
    </div>
  )
}

/** Recent sends to Teams for the term. */
export function VersionsPanel({ termId }: Readonly<{ termId: number }>) {
  const { data: versions = [], isLoading } = useQuery({
    queryKey: queryKeys.teamsPublish.history(termId),
    queryFn: () => teamsPublishApi.history(termId),
  })
  return (
    <Panel className="flex flex-col gap-2.5 px-5 py-4">
      <span className="text-sm font-bold">Versions</span>
      {isLoading ? <span className="text-[13px] text-muted-foreground">Loading…</span> : null}
      {!isLoading && versions.length === 0 ? (
        <span className="text-[13px] text-muted-foreground">Nothing sent to Teams from here yet.</span>
      ) : null}
      {versions.map((version, index) => (
        <div key={version.id} className="flex items-center gap-2.5 text-[13px]">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              version.failed_count ? "bg-amber-500" : version.kind === "term" ? "bg-role-lead" : "bg-role-main",
            )}
          />
          <span className="font-mono text-xs font-semibold text-muted-foreground">v{versions.length - index}</span>
          <span className="min-w-0 flex-1 truncate" title={version.summary}>
            {version.summary}
            <span className="text-muted-foreground">
              {" "}
              · {format(parseISO(version.from_date), "MMM d")}–{format(parseISO(version.to_date), "MMM d")}
            </span>
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{formatTimeAgo(version.created_at)}</span>
        </div>
      ))}
    </Panel>
  )
}
