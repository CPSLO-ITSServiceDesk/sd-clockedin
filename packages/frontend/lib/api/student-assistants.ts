import { apiFetch } from "./client"

export type StudentRole = "student lead, student assistant"

export interface StudentAssistant {
  created_at: string
  first_name: string | null
  id: number
  is_active: boolean | null
  last_name: string | null
  polycard_id: number | null
  position: StudentRole
}

export type StudentAssistantInput = {
  created_at?: string
  first_name?: string | null
  id?: number
  is_active?: boolean | null
  last_name?: string | null
  polycard_id?: number | null
  position?: StudentRole
}

export const studentAssistantsApi = {
  list: () => apiFetch<StudentAssistant[]>("student-assistants"),

  getById: (id: number) => apiFetch<StudentAssistant>(`student-assistants/${id}`),

  create: (payload: StudentAssistantInput) =>
    apiFetch<StudentAssistant>("student-assistants", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
      }),
    }),

  update: (id: number, payload: Partial<StudentAssistantInput>) =>
    apiFetch<StudentAssistant>(`student-assistants/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  remove: (id: number) =>
    apiFetch<void>(`student-assistants/${id}`, {
      method: "DELETE",
    }),
}

// Helper function to format student role for display
export function formatStudentRole(position: string): string {
  if (position === "student lead, student assistant") {
    return "Student Assistant"
  }
  return position
}