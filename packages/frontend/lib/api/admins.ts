import { apiFetch } from "./client"

export interface Admin {
  created_at: string
  email: string | null
  first_name: string | null
  id: number
  isactive: boolean | null
  last_login: string | null
  last_name: string | null
}

export type AdminInput = {
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  isactive?: boolean | null
  last_login?: string | null
}

export const adminsApi = {
  list: () => apiFetch<Admin[]>("/admins"),

  getById: (id: number) => apiFetch<Admin>(`/admins/${id}`),

  create: (payload: AdminInput) =>
    apiFetch<Admin>("/admins", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: number, payload: Partial<AdminInput>) =>
    apiFetch<Admin>(`/admins/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  remove: (id: number) =>
    apiFetch<void>(`/admins/${id}`, {
      method: "DELETE",
    }),
}

export function getAdminDisplayName(admin: Admin): string {
  const parts = [admin.first_name, admin.last_name]
    .map((value) => value?.trim())
    .filter(Boolean)

  if (parts.length > 0) {
    return parts.join(" ")
  }

  if (admin.email) {
    return admin.email.split("@")[0] ?? admin.email
  }

  return "Admin"
}

export function getAdminInitials(admin: Admin): string {
  const displayName = getAdminDisplayName(admin)
  const segments = displayName.trim().split(/\s+/).filter(Boolean)

  if (segments.length === 0) return "A"
  if (segments.length === 1) return segments[0].slice(0, 2).toUpperCase()
  return `${segments[0][0]}${segments[1][0]}`.toUpperCase()
}

export function isAdminActive(admin: Admin): boolean {
  return admin.isactive !== false
}
