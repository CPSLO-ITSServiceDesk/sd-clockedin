import { apiFetch } from "./client"
import type { TodayShift } from "@/lib/shifts/today-shifts"

/** A scheduled block omitted from `shifts` because Teams time off covers all of it, or covers it now. */
export interface TodayTimeOffShift {
  scheduleBlockId: number
  studentAssistantId: number
  firstName: string
  lastName: string
  role: string
  startTime: string
  endTime: string
  isRemote: boolean
  timeOffStartsAt: string
  timeOffEndsAt: string
  timeOffReason: string | null
}

/** Time off active now or starting within the next 14 days. */
export interface UpcomingTimeOff {
  studentAssistantId: number
  firstName: string
  lastName: string
  startsAt: string
  endsAt: string
  reason: string | null
}

export interface TodayShiftsResponse {
  shifts: TodayShift[]
  remoteOnlyStudentIds: number[]
  timeOffShifts?: TodayTimeOffShift[]
  upcomingTimeOff?: UpcomingTimeOff[]
  /** Every time off overlapping today, including ones that already ended. */
  todayTimeOff?: UpcomingTimeOff[]
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
