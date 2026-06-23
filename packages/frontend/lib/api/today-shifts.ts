import { apiFetch } from "./client"
import type { TodayShift } from "@/lib/shifts/today-shifts"

export interface TodayShiftsResponse {
  shifts: TodayShift[]
  remoteOnlyStudentIds: number[]
}

export const todayShiftsApi = {
  listToday: (options?: { includeRemote?: boolean }) => {
    const params = options?.includeRemote ? "?include_remote=1" : ""
    return apiFetch<TodayShiftsResponse>(`/shifts/today${params}`)
  },
}
