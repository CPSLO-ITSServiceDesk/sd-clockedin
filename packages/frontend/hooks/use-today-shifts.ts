"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchTodayShifts } from "@/lib/shifts/today-shifts"
import { queryKeys } from "@/lib/query-keys"

const REFETCH_INTERVAL_MS = 30_000

export function useTodayShifts() {
  return useQuery({
    queryKey: queryKeys.todayShifts.all,
    queryFn: fetchTodayShifts,
    refetchInterval: REFETCH_INTERVAL_MS,
  })
}
