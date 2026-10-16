import { apiFetch } from "./client"

export type TimesheetDayStatus =
  | "ok"
  | "off"
  | "absent"
  | "open"
  | "excused"
  | "remote"
  | "unscheduled"
  | "upcoming"
  | "in-progress"

export interface TimesheetBlock {
  scheduleBlockId: number
  startTime: string
  endTime: string
  isRemote: boolean
  excused: boolean
  hours: number
}

export interface TimesheetEntry {
  id: number
  scheduleBlockId: number | null
  clockIn: string
  clockOut: string | null
  hours: number | null
}

export interface TimesheetDay {
  date: string
  status: TimesheetDayStatus
  blocks: TimesheetBlock[]
  entries: TimesheetEntry[]
  workedHours: number
  scheduledHours: number
  excusedHours: number
  remoteHours: number
}

export interface TimesheetVerification {
  verifiedAt: string
  verifiedBy: string | null
}

export interface StudentMonthSummary {
  studentAssistantId: number
  workedHours: number
  scheduledHours: number
  excusedHours: number
  remoteHours: number
  excusedDays: number
  issues: { absent: number; open: number; off: number; unscheduled: number }
  issueCount: number
  verification: TimesheetVerification | null
}

export interface MonthTimesheetSummary {
  month: string
  verificationAvailable: boolean
  students: StudentMonthSummary[]
}

export interface StudentMonthTimesheet extends StudentMonthSummary {
  month: string
  verificationAvailable: boolean
  days: TimesheetDay[]
}

export const timesheetApi = {
  getMonth: (month: string) =>
    apiFetch<MonthTimesheetSummary>(`/timesheet/months?month=${month}`),

  getStudentMonth: (studentId: number, month: string) =>
    apiFetch<StudentMonthTimesheet>(`/timesheet/students/${studentId}/months?month=${month}`),

  verify: (studentId: number, month: string, verifiedBy: string | null) =>
    apiFetch<TimesheetVerification>(`/timesheet/students/${studentId}/months/${month}/verification`, {
      method: "PUT",
      body: JSON.stringify({ verified_by: verifiedBy }),
    }),

  unverify: (studentId: number, month: string) =>
    apiFetch<void>(`/timesheet/students/${studentId}/months/${month}/verification`, {
      method: "DELETE",
    }),
}
