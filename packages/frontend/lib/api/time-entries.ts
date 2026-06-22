import { apiFetch } from "./client"

export interface TimeEntry {
  clock_in: string | null
  clock_out: string | null
  created_at: string
  id: number
  schedule_block_id: number | null
  student_assistant_id: number | null
}

export type TimeEntryInput = {
  clock_in?: string | null
  clock_out?: string | null
  created_at?: string
  id?: number
  schedule_block_id?: number | null
  student_assistant_id?: number | null
}

export const timeEntriesApi = {
  list: () => apiFetch<TimeEntry[]>("/time-entries"),

  getById: (id: number) => apiFetch<TimeEntry>(`/time-entries/${id}`),

  getOpenByScheduleAndAssistant: (
    schedule_block_id: number,
    student_assistant_id: number
  ) =>
    apiFetch<TimeEntry>(
      `/time-entries?schedule_block_id=eq.${schedule_block_id}&student_assistant_id=eq.${student_assistant_id}&clock_out=is.null`,
    ),

  create: (payload: TimeEntryInput) =>
    apiFetch<TimeEntry>("/time-entries", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: number, payload: Partial<TimeEntryInput>) =>
    apiFetch<TimeEntry>(`/time-entries/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  remove: (id: number) =>
    apiFetch<void>(`/time-entries/${id}`, {
      method: "DELETE",
    }),

  closeOpen: (schedule_block_id: number, student_assistant_id: number) =>
    apiFetch<TimeEntry>("/time-entries/close-open", {
      method: "PATCH",
      body: JSON.stringify({ schedule_block_id, student_assistant_id }),
    }),
}