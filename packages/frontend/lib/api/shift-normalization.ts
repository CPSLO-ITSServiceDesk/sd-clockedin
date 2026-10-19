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
  clockOut: string | null
  reason: UnmatchedReason
}

export type ClockOutIssue =
  | "missing"
  | "still_open"
  | "auto_clock_out"
  | "next_day"
  | "long_after_end"
  | "before_clock_in"

/** A linked clock-in whose clock-out looks wrong, with the shift's scheduled end as the fix. */
export interface ClockOutFix {
  timeEntryId: number
  studentAssistantId: number
  studentName: string
  date: string
  clockIn: string
  clockOut: string | null
  scheduleBlockId: number
  blockStartTime: string
  blockEndTime: string
  proposedClockOut: string
  issue: ClockOutIssue
}

export interface NormalizationPreview {
  summary: {
    totalUnscheduled: number
    proposedMatches: number
    noMatch: number
  }
  proposals: NormalizationProposal[]
  unmatched: NormalizationUnmatched[]
  clockOutFixes: ClockOutFix[]
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

export async function applyClockOutFixes(
  termId: number,
  timeEntryIds: number[],
): Promise<NormalizationApplyResult> {
  return apiFetch<NormalizationApplyResult>(
    `/normalization/terms/${termId}/clock-outs`,
    {
      method: "POST",
      body: JSON.stringify({ timeEntryIds }),
    },
  )
}
