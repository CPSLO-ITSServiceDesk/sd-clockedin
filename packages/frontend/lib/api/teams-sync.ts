import { apiFetch } from "./client"

export type TeamsSyncRunStatus = "success" | "error" | "not_configured"

export interface TeamsSyncStatus {
  academic_term_id: number
  graph_configured: boolean
  status: TeamsSyncRunStatus | null
  started_at: string | null
  finished_at: string | null
  error_message: string | null
  students_created: number
  students_matched: number
  students_deactivated: number
  schedules_updated: number
  total_blocks: number
  remote_blocks: number
  time_off_upserted: number
  team_id: string | null
  scheduling_group: string | null
}

export const teamsSyncApi = {
  getStatus: (termId?: number) => {
    const query =
      termId != null ? `?academic_term_id=${encodeURIComponent(String(termId))}` : ""
    return apiFetch<TeamsSyncStatus>(`/teams-sync/status${query}`)
  },

  syncNow: (termId?: number) =>
    apiFetch<TeamsSyncStatus>("/teams-sync/sync-now", {
      method: "POST",
      body: JSON.stringify(
        termId != null ? { academic_term_id: termId } : {},
      ),
    }),
}
