import { apiFetch } from "./client"

export interface TimelinessSummary {
  totalEvaluated: number
  onTime: number
  early: number
  late: number
  absent: number
  unscheduled: number
  /** Scheduled shifts covered by Teams time off; not counted in rates. */
  excused: number
  onTimeRate: number
  punctualityRate: number
  avgMinutesLate: number
}

export interface LateByTimeSlot {
  startTime: string
  lateCount: number
  totalShifts: number
  lateRate: number
}

export interface DailyTrendPoint {
  date: string
  /** Shifts with on-time or early status (within punctuality window). */
  punctual: number
  late: number
  absent: number
  excused: number
}

export interface WeekdayPattern {
  day: string
  late: number
  absent: number
  total: number
}

export interface StudentLeaderboardEntry {
  studentAssistantId: number
  late: number
  absent: number
  total: number
}

export interface StudentLateShift {
  date: string
  startTime: string
  endTime: string
  clockIn: string | null
  minutesLate: number
  status: "late" | "absent" | "unscheduled"
}

/** Late rate for scheduled shifts on one weekday starting in one hour. */
export interface LateHeatmapCell {
  day: string
  /** Start hour, 0–23. */
  hour: number
  late: number
  total: number
}

/**
 * Per-student term counts. `strip` has one code per scheduled shift in date
 * order: o = on time/early, l = late, a = absent, e = excused.
 */
export interface StudentBreakdownEntry {
  studentAssistantId: number
  late: number
  absent: number
  excused: number
  total: number
  avgMinutesLate: number
  strip: string
}

export interface TermAnalytics {
  summary: TimelinessSummary
  dailyTrend: DailyTrendPoint[]
  lateByTimeSlot: LateByTimeSlot[]
  weekdayPatterns: WeekdayPattern[]
  lateLeaderboard: StudentLeaderboardEntry[]
  lateHeatmap: LateHeatmapCell[]
  studentBreakdown: StudentBreakdownEntry[]
}

export interface StudentAnalytics {
  summary: TimelinessSummary
  lateByTimeSlot: LateByTimeSlot[]
  weekdayPatterns: WeekdayPattern[]
  dailyTrend: DailyTrendPoint[]
  recentIssues: StudentLateShift[]
}

export const analyticsApi = {
  getTermAnalytics: (termId: number) =>
    apiFetch<TermAnalytics>(`/analytics/terms/${termId}`),

  getStudentAnalytics: (studentId: number, termId: number) =>
    apiFetch<StudentAnalytics>(
      `/analytics/students/${studentId}?termId=${termId}`,
    ),
}
