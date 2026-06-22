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
} as const
