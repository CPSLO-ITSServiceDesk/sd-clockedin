import { apiFetch } from "./client"
import type { TodayShift } from "@/lib/shifts/today-shifts"

export interface TodayShiftsResponse {
  shifts: TodayShift[]
  remoteOnlyStudentIds: number[]
}

export const todayShiftsApi = {
  listToday: (options?: { includeRemote?: boolean; date?: string }) => {
    const params = new URLSearchParams()
    if (options?.includeRemote) params.set("include_remote", "1")
    if (options?.date) params.set("date", options.date)
    const query = params.toString()
    return apiFetch<TodayShiftsResponse>(
      `/shifts/today${query ? `?${query}` : ""}`,
    )
  },
}
