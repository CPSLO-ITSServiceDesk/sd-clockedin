"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { formatStudentName } from "@/components/admin/mock-students"
import {
  apiStudentToScheduleStudent,
  type ScheduleStudent,
} from "@/lib/api/schedule-mappers"
import { studentAssistantsApi } from "@/lib/api/student-assistants"
import { queryKeys } from "@/lib/query-keys"

export type RoleFilter = "all" | "lead" | "assistant"

interface UseStudentSelectionOptions {
  basePath: string
}

export function useStudentSelection({ basePath }: UseStudentSelectionOptions) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data: apiStudents = [], isLoading } = useQuery({
    queryKey: queryKeys.students.all,
    queryFn: studentAssistantsApi.list,
  })

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(() => {
    const studentParam = searchParams.get("student")
    if (!studentParam) return null
    const parsed = Number(studentParam)
    return Number.isNaN(parsed) ? null : parsed
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")

  const activeStudents = useMemo(
    () =>
      apiStudents
        .filter((student) => student.is_active)
        .map(apiStudentToScheduleStudent),
    [apiStudents],
  )

  const selectedStudent = useMemo(
    () =>
      activeStudents.find((student) => student.id === selectedStudentId) ?? null,
    [activeStudents, selectedStudentId],
  )

  const selectStudent = useCallback(
    (student: ScheduleStudent | null) => {
      setSelectedStudentId(student?.id ?? null)

      const params = new URLSearchParams(searchParams.toString())
      if (student) {
        params.set("student", String(student.id))
      } else {
        params.delete("student")
      }

      const query = params.toString()
      router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false })
    },
    [basePath, router, searchParams],
  )

  const filteredStudents = useMemo(() => {
    let eligible = [...activeStudents]

    if (roleFilter === "lead") {
      eligible = eligible.filter((student) => student.role === "Student Lead")
    } else if (roleFilter === "assistant") {
      eligible = eligible.filter(
        (student) => student.role === "Student Assistant",
      )
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      eligible = eligible.filter((student) => {
        const name = formatStudentName(student).toLowerCase()
        const cardId = student.polycard_id?.toString() ?? ""
        return name.includes(query) || cardId.includes(query)
      })
    }

    return eligible.sort((a, b) =>
      formatStudentName(a).localeCompare(formatStudentName(b)),
    )
  }, [activeStudents, roleFilter, searchQuery])

  return {
    isLoading,
    activeStudents,
    selectedStudentId,
    selectedStudent,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    filteredStudents,
    selectStudent,
  }
}
