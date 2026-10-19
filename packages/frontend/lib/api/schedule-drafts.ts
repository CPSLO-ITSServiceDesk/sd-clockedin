import type { Weekday } from "@/components/admin/terms/term-types"
import { apiFetch, apiUpload } from "./client"

/** Desk role painted on a half-hour slot: Lead, Main desk, Training. */
export type ShiftRole = "L" | "m" | "t"

export type PersonGroup = "lead" | "student" | "trainee"

/** Absolute half-hour slot indexes per weekday (16 = 8:00). */
export type DaySlots = Partial<Record<Weekday, number[]>>

export type DayAssignments = Partial<Record<Weekday, Record<string, ShiftRole>>>

export interface DraftPerson {
  student_assistant_id: number
  group: PersonGroup
  responded: boolean
  min_hours: number | null
  ideal_hours: number | null
  max_hours: number | null
  notes: string
  availability: DaySlots
  assignments: DayAssignments
  import_warnings: string[]
}

export interface UnmatchedResponse {
  key: string
  name: string
  email: string
  min_hours: number | null
  ideal_hours: number | null
  max_hours: number | null
  notes: string
  availability: DaySlots
  import_warnings: string[]
}

export interface DraftRules {
  desk_start_slot: number
  desk_end_slot: number
  min_on_desk: { enabled: boolean; value: number }
  lead_every_slot: { enabled: boolean }
  shift_length: { enabled: boolean; min_hours: number; max_hours: number }
  within_requested: { enabled: boolean }
  weekly_budget: { enabled: boolean; hours: number }
  trainee_with_lead: { enabled: boolean }
}

export interface ChangeLogEntry {
  at: string
  by: "you" | "builder" | "import"
  text: string
}

export interface ScheduleDraft {
  id: number
  academic_term_id: number
  status: "draft" | "published"
  step: number
  source_filename: string | null
  rules: DraftRules
  people: DraftPerson[]
  unmatched: UnmatchedResponse[]
  change_log: ChangeLogEntry[]
  created_at: string
  updated_at: string
  published_at: string | null
}

export type ScheduleDraftPatch = Partial<
  Pick<ScheduleDraft, "step" | "rules" | "people" | "unmatched" | "change_log">
>

export interface AvailabilityColumn {
  field: string
  header: string
  filled: number
}

export interface AvailabilityImportResult {
  draft: ScheduleDraft
  columns: AvailabilityColumn[]
  responses: number
  matched: number
  unmatched: number
}

export interface PublishPreview {
  term: {
    id: number
    name: string | null
    start_date: string | null
    end_date: string | null
    skips: { date: string; label?: string }[]
  }
  total_shifts: number
  new_shifts: number
  removed_shifts: number
  unchanged_shifts: number
  students_affected: number
  teams_sync_enabled: boolean
}

export const scheduleDraftsApi = {
  latestForTerm: (termId: number) =>
    apiFetch<ScheduleDraft | null>(`/schedule-drafts?academic_term_id=${termId}`),

  create: (termId: number) =>
    apiFetch<ScheduleDraft>("/schedule-drafts", {
      method: "POST",
      body: JSON.stringify({ academic_term_id: termId }),
    }),

  update: (id: number, patch: ScheduleDraftPatch) =>
    apiFetch<ScheduleDraft>(`/schedule-drafts/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  remove: (id: number) => apiFetch<void>(`/schedule-drafts/${id}`, { method: "DELETE" }),

  importAvailability: (id: number, file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return apiUpload<AvailabilityImportResult>(`/schedule-drafts/${id}/import`, formData)
  },

  generate: (id: number) =>
    apiFetch<ScheduleDraft>(`/schedule-drafts/${id}/generate`, { method: "POST" }),

  publishPreview: (id: number) =>
    apiFetch<PublishPreview>(`/schedule-drafts/${id}/publish-preview`),

  publish: (id: number) =>
    apiFetch<ScheduleDraft>(`/schedule-drafts/${id}/publish`, { method: "POST" }),
}
