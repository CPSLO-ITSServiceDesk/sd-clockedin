"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { DraftScheduleBlock } from "@/components/admin/schedules/schedule-types"
import {
  apiBlockToDraft,
  type ScheduleStudent,
} from "@/lib/api/schedule-mappers"
import { scheduleBlocksApi } from "@/lib/api/scheduleBlocks"
import { schedulesApi } from "@/lib/api/schedules"
import { termsApi } from "@/lib/api/terms"
import { queryKeys } from "@/lib/query-keys"
import { sortTermsByActiveStatus } from "@/components/admin/terms/term-types"
import { useStudentSelection, type RoleFilter } from "@/hooks/use-student-selection"

export type { RoleFilter }

interface UseStudentTermSelectionOptions {
  basePath: string
}

export function useStudentTermSelection({ basePath }: UseStudentTermSelectionOptions) {
  const studentSelection = useStudentSelection({ basePath })
  const { selectStudent } = studentSelection

  const { data: terms = [], isLoading: termsLoading } = useQuery({
    queryKey: queryKeys.terms.all,
    queryFn: termsApi.list,
  })

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: queryKeys.schedules.all,
    queryFn: schedulesApi.list,
  })

  const { data: allBlocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: queryKeys.scheduleBlocks.all,
    queryFn: scheduleBlocksApi.list,
  })

  const defaultTermId = useMemo(
    () => terms.find((term) => term.is_active)?.id ?? terms[0]?.id ?? null,
    [terms],
  )

  const sortedTerms = useMemo(() => sortTermsByActiveStatus(terms), [terms])

  const [termId, setTermId] = useState<number | null>(null)
  const activeTermId = termId ?? defaultTermId

  const getScheduleForStudentTerm = useCallback(
    (studentId: number, term: number) => {
      const schedule =
        schedules.find(
          (entry) =>
            entry.student_assistant_id === studentId &&
            entry.academic_term_id === term,
        ) ?? null

      if (!schedule) {
        return { schedule: null, blocks: [] as DraftScheduleBlock[] }
      }

      const blocks = allBlocks
        .filter((block) => block.schedule_id === schedule.id)
        .map(apiBlockToDraft)
        .filter((block): block is DraftScheduleBlock => block !== null)

      return { schedule, blocks }
    },
    [allBlocks, schedules],
  )

  const changeTerm = useCallback(
    (nextTermId: number) => {
      setTermId(nextTermId)
      selectStudent(null)
    },
    [selectStudent],
  )

  const hasSchedule = useCallback(
    (student: ScheduleStudent) => {
      if (!activeTermId) return false
      const { blocks } = getScheduleForStudentTerm(student.id, activeTermId)
      return blocks.length > 0
    },
    [activeTermId, getScheduleForStudentTerm],
  )

  const scheduledCount = activeTermId
    ? studentSelection.activeStudents.filter((student) => hasSchedule(student)).length
    : 0

  const selectedTerm = terms.find((term) => term.id === activeTermId)

  const isLoading =
    studentSelection.isLoading ||
    termsLoading ||
    schedulesLoading ||
    blocksLoading

  return {
    ...studentSelection,
    isLoading,
    terms,
    sortedTerms,
    activeTermId,
    selectedTerm,
    changeTerm,
    hasSchedule,
    scheduledCount,
    getScheduleForStudentTerm,
    allBlocks,
    schedules,
  }
}