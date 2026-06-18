"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type {
  DraftScheduleBlock,
  MockAcademicTerm,
  Schedule,
  ScheduleBlock,
} from "@/components/admin/schedules/schedule-types"

const MOCK_TERMS: MockAcademicTerm[] = [
  { id: 1, name: "Fall 2025", is_active: true },
  { id: 2, name: "Spring 2026", is_active: false },
]

const INITIAL_SCHEDULES: Schedule[] = [
  { id: 1, student_assistant_id: 1, academic_term_id: 1 },
  { id: 2, student_assistant_id: 2, academic_term_id: 1 },
]

const INITIAL_BLOCKS: ScheduleBlock[] = [
  {
    id: 1,
    schedule_id: 1,
    day: "monday",
    start_time: "08:00",
    end_time: "12:00",
  },
  {
    id: 2,
    schedule_id: 1,
    day: "wednesday",
    start_time: "13:00",
    end_time: "17:00",
  },
  {
    id: 3,
    schedule_id: 2,
    day: "tuesday",
    start_time: "09:00",
    end_time: "13:00",
  },
  {
    id: 4,
    schedule_id: 2,
    day: "thursday",
    start_time: "09:00",
    end_time: "13:00",
  },
]

interface ScheduleStoreValue {
  terms: MockAcademicTerm[]
  schedules: Schedule[]
  blocks: ScheduleBlock[]
  getScheduleForStudentTerm: (
    studentId: number,
    termId: number,
  ) => { schedule: Schedule | null; blocks: ScheduleBlock[] }
  saveScheduleBlocks: (
    studentId: number,
    termId: number,
    draftBlocks: DraftScheduleBlock[],
  ) => void
}

const ScheduleStoreContext = createContext<ScheduleStoreValue | null>(null)

export function ScheduleStoreProvider({ children }: { children: ReactNode }) {
  const [schedules, setSchedules] = useState<Schedule[]>(INITIAL_SCHEDULES)
  const [blocks, setBlocks] = useState<ScheduleBlock[]>(INITIAL_BLOCKS)
  const [nextScheduleId, setNextScheduleId] = useState(INITIAL_SCHEDULES.length + 1)
  const [nextBlockId, setNextBlockId] = useState(INITIAL_BLOCKS.length + 1)

  const getScheduleForStudentTerm = useCallback(
    (studentId: number, termId: number) => {
      const schedule =
        schedules.find(
          (entry) =>
            entry.student_assistant_id === studentId &&
            entry.academic_term_id === termId,
        ) ?? null

      if (!schedule) {
        return { schedule: null, blocks: [] }
      }

      return {
        schedule,
        blocks: blocks.filter((block) => block.schedule_id === schedule.id),
      }
    },
    [blocks, schedules],
  )

  const saveScheduleBlocks = useCallback(
    (studentId: number, termId: number, draftBlocks: DraftScheduleBlock[]) => {
      setSchedules((currentSchedules) => {
        const existing = currentSchedules.find(
          (entry) =>
            entry.student_assistant_id === studentId &&
            entry.academic_term_id === termId,
        )

        if (draftBlocks.length === 0) {
          if (existing) {
            setBlocks((currentBlocks) =>
              currentBlocks.filter((block) => block.schedule_id !== existing.id),
            )
            return currentSchedules.filter((entry) => entry.id !== existing.id)
          }
          return currentSchedules
        }

        const scheduleId = existing?.id ?? nextScheduleId

        setBlocks((currentBlocks) => {
          const withoutOld = existing
            ? currentBlocks.filter((block) => block.schedule_id !== existing.id)
            : currentBlocks

          let blockId = nextBlockId
          const created = draftBlocks.map((block) => {
            const saved: ScheduleBlock = {
              id: blockId,
              schedule_id: scheduleId,
              day: block.day,
              start_time: block.start_time,
              end_time: block.end_time,
            }
            blockId += 1
            return saved
          })

          setNextBlockId(blockId)
          return [...withoutOld, ...created]
        })

        if (!existing) {
          setNextScheduleId((current) => current + 1)
          return [
            ...currentSchedules,
            {
              id: scheduleId,
              student_assistant_id: studentId,
              academic_term_id: termId,
            },
          ]
        }

        return currentSchedules
      })
    },
    [nextBlockId, nextScheduleId],
  )

  const value = useMemo(
    () => ({
      terms: MOCK_TERMS,
      schedules,
      blocks,
      getScheduleForStudentTerm,
      saveScheduleBlocks,
    }),
    [blocks, getScheduleForStudentTerm, saveScheduleBlocks, schedules],
  )

  return (
    <ScheduleStoreContext.Provider value={value}>
      {children}
    </ScheduleStoreContext.Provider>
  )
}

export function useScheduleStore(): ScheduleStoreValue {
  const context = useContext(ScheduleStoreContext)
  if (!context) {
    throw new Error("useScheduleStore must be used within ScheduleStoreProvider")
  }
  return context
}
