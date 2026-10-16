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
    byDate: (includeRemote: boolean, date?: string) =>
      ["today-shifts", includeRemote, date ?? "today"] as const,
  },
  analytics: {
    term: (termId: number) => ["analytics", "term", termId] as const,
    student: (studentId: number, termId: number) =>
      ["analytics", "student", studentId, termId] as const,
  },
  normalization: {
    preview: (termId: number) => ["normalization", "preview", termId] as const,
  },
  timesheet: {
    all: ["timesheet"] as const,
    month: (month: string) => ["timesheet", "month", month] as const,
    studentMonth: (studentId: number, month: string) =>
      ["timesheet", "student", studentId, month] as const,
  },
  admins: {
    all: ["admins"] as const,
  },
  teamsSync: {
    all: ["teams-sync"] as const,
    status: (termId?: number | null) =>
      ["teams-sync", "status", termId ?? "active"] as const,
  },
} as const
