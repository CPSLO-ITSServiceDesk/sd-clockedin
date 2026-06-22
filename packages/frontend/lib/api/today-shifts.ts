import { apiFetch } from "./client"
import type { TodayShift } from "@/lib/shifts/today-shifts"

export const todayShiftsApi = {
  listToday: () => apiFetch<TodayShift[]>("/shifts/today"),
}
