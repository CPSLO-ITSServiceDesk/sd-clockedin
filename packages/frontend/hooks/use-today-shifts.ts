"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchTodayShifts } from "@/lib/shifts/today-shifts"
import { queryKeys } from "@/lib/query-keys"

const REFETCH_INTERVAL_MS = 30_000

export function useTodayShifts(options?: { includeRemote?: boolean }) {
  return useQuery({
    queryKey: [...queryKeys.todayShifts.all, options?.includeRemote ?? false],
    queryFn: () => fetchTodayShifts(options),
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
