"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchTodayShifts } from "@/lib/shifts/today-shifts"
import { queryKeys } from "@/lib/query-keys"
import {
  formatOrgDateString,
  isOrgToday,
} from "@/lib/shifts/hourly-staffing-dates"

const REFETCH_INTERVAL_MS = 30_000

export function useTodayShifts(options?: { includeRemote?: boolean }) {
  const includeRemote = options?.includeRemote ?? false
  return useQuery({
    queryKey: queryKeys.todayShifts.byDate(includeRemote),
    queryFn: () => fetchTodayShifts({ includeRemote }),
    refetchInterval: REFETCH_INTERVAL_MS,
  })
}

export function useTodayShiftList(options?: { includeRemote?: boolean }) {
  const query = useTodayShifts(options)
  return {
    ...query,
    shifts: query.data?.shifts ?? [],
    remoteOnlyStudentIds: query.data?.remoteOnlyStudentIds ?? [],
  }
}

/**
 * Fetch shifts for an org-local calendar date.
 * When `date` is org-today, shares the dashboard cache and omits `?date`
 * so the backend uses the live clock.
 */
export function useShiftsForDate(options: {
  date: string
  includeRemote?: boolean
}) {
  const includeRemote = options.includeRemote ?? false
  const viewingToday = isOrgToday(options.date)

  const query = useQuery({
    queryKey: viewingToday
      ? queryKeys.todayShifts.byDate(includeRemote)
      : queryKeys.todayShifts.byDate(includeRemote, options.date),
    queryFn: () =>
      viewingToday
        ? fetchTodayShifts({ includeRemote })
        : fetchTodayShifts({ includeRemote, date: options.date }),
    refetchInterval: viewingToday ? REFETCH_INTERVAL_MS : false,
  })

  return {
    ...query,
    shifts: query.data?.shifts ?? [],
    remoteOnlyStudentIds: query.data?.remoteOnlyStudentIds ?? [],
    isToday: viewingToday,
    todayDate: formatOrgDateString(),
  }
}
