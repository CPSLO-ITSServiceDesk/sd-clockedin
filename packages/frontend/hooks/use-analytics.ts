"use client"

import { useQuery } from "@tanstack/react-query"
import { analyticsApi } from "@/lib/api/analytics"
import { queryKeys } from "@/lib/query-keys"

export function useTermAnalytics(termId: number | null) {
  return useQuery({
    queryKey: queryKeys.analytics.term(termId ?? 0),
    queryFn: () => analyticsApi.getTermAnalytics(termId!),
    enabled: termId != null,
  })
}

export function useStudentAnalytics(
  studentId: number | null,
  termId: number | null,
) {
  return useQuery({
    queryKey: queryKeys.analytics.student(studentId ?? 0, termId ?? 0),
    queryFn: () => analyticsApi.getStudentAnalytics(studentId!, termId!),
    enabled: studentId != null && termId != null,
  })
}
