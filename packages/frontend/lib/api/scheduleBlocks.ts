import { apiFetch } from "./client"

export type ScheduleBlockDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"

export interface ScheduleBlock {
  created_at: string
  days: ScheduleBlockDay | null
  end_time: string | null
  id: number
  is_remote: boolean
  schedule_id: number | null
  start_time: string | null
}

export type ScheduleBlockInput = {
  created_at?: string
  days?: ScheduleBlockDay | null
  end_time?: string | null
  id?: number
  is_remote?: boolean
  schedule_id?: number | null
  start_time?: string | null
}

export const scheduleBlocksApi = {
  list: () => apiFetch<ScheduleBlock[]>("/schedule-blocks"),

  getById: (id: number) => apiFetch<ScheduleBlock>(`/schedule-blocks/${id}`),

  create: (payload: ScheduleBlockInput) =>
    apiFetch<ScheduleBlock>("/schedule-blocks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: number, payload: Partial<ScheduleBlockInput>) =>
    apiFetch<ScheduleBlock>(`/schedule-blocks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  remove: (id: number) =>
    apiFetch<void>(`/schedule-blocks/${id}`, {
      method: "DELETE",
    }),

  getByScheduleId: (scheduleId: number) =>
    apiFetch<ScheduleBlock[]>(`/schedules/${scheduleId}/blocks`),
}