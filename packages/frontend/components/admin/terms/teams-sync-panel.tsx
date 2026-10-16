"use client"

import { RefreshCw } from "lucide-react"
import { ScheduleImportPanel } from "@/components/admin/schedules/schedule-import-panel"
import {
  useTeamsSyncNow,
  useTeamsSyncStatus,
} from "@/hooks/use-teams-sync"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { TeamsSyncRunStatus } from "@/lib/api/teams-sync"

interface TeamsSyncPanelProps {
  termId: number
  termName?: string
  showSpreadsheetFallback?: boolean
  className?: string
}

function statusLabel(status: TeamsSyncRunStatus | null, graphConfigured: boolean) {
  if (!graphConfigured) return "Not configured"
  if (status === "success") return "Synced"
  if (status === "error") return "Failed"
  if (status === "not_configured") return "Not configured"
  return "Waiting for first sync"
}

function formatTimestamp(value: string | null) {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function TeamsSyncPanel({
  termId,
  termName,
  showSpreadsheetFallback = false,
  className,
}: TeamsSyncPanelProps) {
  const { data, isLoading, error } = useTeamsSyncStatus(termId)
  const syncNow = useTeamsSyncNow(termId)

  const graphConfigured = data?.graph_configured ?? false
  const status = data?.status ?? null
  const waitingForFirstSync = graphConfigured && status == null
  const syncing = syncNow.isPending || waitingForFirstSync

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-md border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Teams Shifts sync</h3>
              <Badge variant="outline">
                {isLoading ? "Loading" : statusLabel(status, graphConfigured)}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Roster, weekly templates, and time off come from Teams Shifts.
              Saving an active term starts a sync automatically.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => syncNow.mutate()}
            disabled={!graphConfigured || syncNow.isPending}
          >
            <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
            {syncNow.isPending ? "Syncing..." : "Sync now"}
          </Button>
        </div>

        {!graphConfigured ? (
          <p className="text-muted-foreground text-sm">
            Microsoft Graph is not configured on the server. The term is saved;
            connect Entra (tenant, client, secret, team id) to pull from Teams.
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load sync status"}
          </p>
        ) : null}

        {syncNow.error ? (
          <p className="text-sm text-destructive">
            {syncNow.error instanceof Error
              ? syncNow.error.message
              : "Teams sync failed"}
          </p>
        ) : null}

        {data?.error_message && status === "error" ? (
          <p className="text-sm text-destructive">{data.error_message}</p>
        ) : null}

        {data ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Last run</dt>
              <dd>{formatTimestamp(data.finished_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Scheduling group</dt>
              <dd>{data.scheduling_group ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Students</dt>
              <dd>
                {data.students_created} created · {data.students_matched} matched
                {data.students_deactivated > 0
                  ? ` · ${data.students_deactivated} deactivated`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Schedules</dt>
              <dd>
                {data.total_blocks} blocks
                {data.time_off_upserted > 0
                  ? ` · ${data.time_off_upserted} time-off rows`
                  : ""}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      {showSpreadsheetFallback ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="px-0 text-muted-foreground">
              Import a spreadsheet instead
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <ScheduleImportPanel
              termId={termId}
              termName={termName ?? `Term ${termId}`}
            />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}
