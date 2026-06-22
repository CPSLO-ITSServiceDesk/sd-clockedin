import { apiFetch } from "./client"

export interface Schedule {
  academic_term_id: number | null
  created_at: string
  id: number
  student_assistant_id: number | null
}

export type ScheduleInput = {
  academic_term_id?: number | null
  created_at?: string
  id?: number
  student_assistant_id?: number | null
}

export const schedulesApi = {
  list: () => apiFetch<Schedule[]>("/schedules"),

  getById: (id: number) => apiFetch<Schedule>(`/schedules/${id}`),

  create: (payload: ScheduleInput) =>
    apiFetch<Schedule>("/schedules", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: number, payload: Partial<ScheduleInput>) =>
    apiFetch<Schedule>(`/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  remove: (id: number) =>
    apiFetch<void>(`/schedules/${id}`, {
      method: "DELETE",
    }),
}