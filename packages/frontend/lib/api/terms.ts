import { apiFetch } from "./client"

export interface Term {
  created_at: string
  end_date: string | null
  id: number
  is_active: boolean | null
  name: string | null
  off_days: any | null // Using any for Json type since we don't have the exact type definition
  remote_shifts_allowed: boolean
  start_date: string | null
}

export type TermInput = {
  created_at?: string
  end_date?: string | null
  id?: number
  is_active?: boolean | null
  name?: string | null
  off_days?: any | null
  remote_shifts_allowed?: boolean
  start_date?: string | null
}

export const termsApi = {
  list: () => apiFetch<Term[]>("/terms"),

  getById: (id: number) => apiFetch<Term>(`/terms/${id}`),

  create: (payload: TermInput) =>
    apiFetch<Term>("/terms", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: number, payload: Partial<TermInput>) =>
    apiFetch<Term>(`/terms/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  remove: (id: number) =>
    apiFetch<void>(`/terms/${id}`, {
      method: "DELETE",
    }),
}