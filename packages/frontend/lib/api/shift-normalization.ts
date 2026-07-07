import { apiFetch } from "./client"

export type UnmatchedReason =
  | "no_schedule"
  | "outside_term_range"
  | "no_blocks_that_day"
  | "outside_window"
  | "block_already_claimed"

export interface NormalizationProposal {
  timeEntryId: number
  studentAssistantId: number
  studentName: string
  date: string
  clockIn: string
  clockOut: string | null
  proposedBlockId: number
  blockStartTime: string
  blockEndTime: string
  blockDay: string
}

export interface NormalizationUnmatched {
  timeEntryId: number
  studentAssistantId: number
  studentName: string
  date: string
  clockIn: string
  reason: UnmatchedReason
}

export interface NormalizationPreview {
  summary: {
    totalUnscheduled: number
    proposedMatches: number
    noMatch: number
  }
  proposals: NormalizationProposal[]
  unmatched: NormalizationUnmatched[]
}

export interface NormalizationMatchInput {
  timeEntryId: number
  scheduleBlockId: number
}

export interface NormalizationApplyResult {
  applied: number
  skipped: Array<{ timeEntryId: number; reason: string }>
}

export async function fetchNormalizationPreview(
  termId: number,
): Promise<NormalizationPreview> {
  return apiFetch<NormalizationPreview>(`/normalization/terms/${termId}/preview`)
}

export async function applyNormalizationMatches(
  termId: number,
  matches: NormalizationMatchInput[],
): Promise<NormalizationApplyResult> {
  return apiFetch<NormalizationApplyResult>(
    `/normalization/terms/${termId}/apply`,
    {
      method: "POST",
      body: JSON.stringify({ matches }),
    },
  )
}
