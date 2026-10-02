"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { teamsSyncApi } from "@/lib/api/teams-sync"
import { queryKeys } from "@/lib/query-keys"

export function useTeamsSyncStatus(termId: number | null) {
  return useQuery({
    queryKey: queryKeys.teamsSync.status(termId),
    queryFn: () => teamsSyncApi.getStatus(termId ?? undefined),
    enabled: termId != null,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000
      if (data.graph_configured && data.status == null) return 2000
      return false
    },
  })
}

export function useTeamsSyncNow(termId: number | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => teamsSyncApi.syncNow(termId ?? undefined),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.teamsSync.all,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.students.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.all }),
      ])
    },
  })
}
