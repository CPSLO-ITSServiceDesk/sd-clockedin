import type { Weekday } from "@/components/admin/terms/term-types"
import type { ShiftRole } from "@/lib/api/schedule-drafts"
import { apiFetch } from "./client"

export interface PublishRange {
  fromDate: string
  toDate: string
}

export interface PersonWeeklyShift {
  day: Weekday
  /** "HH:mm", org-local. */
  start_time: string
  end_time: string
  role?: ShiftRole
}

export interface TeamsPublishPreview {
  range: PublishRange
  scheduling_group: string
  people: number
  missing_teams: { id: number; name: string }[]
  skipped_dates: { date: string; label?: string }[]
  create: number
  keep: number
  remove: number
  restore: number
  hours_added: number
  hours_removed: number
}

export interface TeamsPublishResult extends TeamsPublishPreview {
  failed: { action: string; message: string }[]
  students_affected: number
}

export interface TeamsPersonPattern {
  week_of: string | null
  shifts: (PersonWeeklyShift & { remote: boolean })[]
  linked: boolean
}

export interface TeamsPublishVersion {
  id: number
  kind: "term" | "person"
  student_name: string | null
  from_date: string
  to_date: string
  created_count: number
  kept_count: number
  removed_count: number
  failed_count: number
  summary: string
  created_at: string
}

const rangeBody = (range: PublishRange) => ({ from_date: range.fromDate, to_date: range.toDate })

export const teamsPublishApi = {
  previewDraft: (draftId: number, range: PublishRange) =>
    apiFetch<TeamsPublishPreview>(`/teams-publish/drafts/${draftId}/preview`, {
      method: "POST",
      body: JSON.stringify(rangeBody(range)),
    }),

  publishDraft: (draftId: number, range: PublishRange) =>
    apiFetch<TeamsPublishResult>(`/teams-publish/drafts/${draftId}/publish`, {
      method: "POST",
      body: JSON.stringify(rangeBody(range)),
    }),

  personPattern: (termId: number, studentId: number, week: string) =>
    apiFetch<TeamsPersonPattern>(
      `/teams-publish/students/${studentId}/pattern?academic_term_id=${termId}&week=${week}`,
    ),

  previewPerson: (termId: number, studentId: number, shifts: PersonWeeklyShift[], range: PublishRange) =>
    apiFetch<TeamsPublishPreview>(`/teams-publish/students/${studentId}/preview`, {
      method: "POST",
      body: JSON.stringify({ academic_term_id: termId, shifts, ...rangeBody(range) }),
    }),

  publishPerson: (termId: number, studentId: number, shifts: PersonWeeklyShift[], range: PublishRange) =>
    apiFetch<TeamsPublishResult>(`/teams-publish/students/${studentId}/publish`, {
      method: "POST",
      body: JSON.stringify({ academic_term_id: termId, shifts, ...rangeBody(range) }),
    }),

  history: (termId: number) => apiFetch<TeamsPublishVersion[]>(`/teams-publish/terms/${termId}/history`),
}
