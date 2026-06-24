export const queryKeys = {
  students: {
    all: ["student-assistants"] as const,
  },
  terms: {
    all: ["terms"] as const,
  },
  schedules: {
    all: ["schedules"] as const,
  },
  scheduleBlocks: {
    all: ["schedule-blocks"] as const,
    bySchedule: (scheduleId: number) =>
      ["schedule-blocks", scheduleId] as const,
  },
  timeEntries: {
    all: ["time-entries"] as const,
  },
  todayShifts: {
    all: ["today-shifts"] as const,
  },
  analytics: {
    term: (termId: number) => ["analytics", "term", termId] as const,
    student: (studentId: number, termId: number) =>
      ["analytics", "student", studentId, termId] as const,
  },
  timesheet: {
    hoursByDay: (studentId: number, startDate: string, endDate: string) =>
      ["timesheet", "hours-by-day", studentId, startDate, endDate] as const,
  },
  admins: {
    all: ["admins"] as const,
  },
} as const
