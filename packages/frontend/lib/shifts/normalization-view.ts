import type {
  NormalizationProposal,
  NormalizationUnmatched,
  UnmatchedReason,
} from "@/lib/api/shift-normalization"
import { formatTime, timeToMinutes } from "@/lib/format-time"
import { formatOrgClock, toOrgWallClockMinutes } from "@/lib/org-time"

/** Clock-ins within this many minutes of the shift start are preselected. */
export const CLOSE_MATCH_MINUTES = 15

/** Minutes of padding shown either side of the shift on the overlap bar. */
const BAR_PADDING_MINUTES = 60

export function formatEntryDate(date: string): string {
  if (!date) return "—"
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function formatEntryRange(clockIn: string, clockOut: string | null): string {
  return `${formatOrgClock(clockIn)} – ${clockOut ? formatOrgClock(clockOut) : "—"}`
}

export interface ProposalView {
  proposal: NormalizationProposal
  isClose: boolean
  needsLook: boolean
  difference: string
  blockLabel: string
  /** Percent positions on the overlap bar. */
  block: { left: number; width: number }
  entry: { left: number; width: number; open: boolean }
}

function formatMinutes(minutes: number): string {
  const abs = Math.abs(minutes)
  if (abs < 60) return `${abs}m`
  return abs % 60 === 0 ? `${abs / 60}h` : `${Math.floor(abs / 60)}h ${abs % 60}m`
}

function describe(minutes: number, side: "in" | "out"): string | null {
  if (minutes === 0) return null
  return `${side} ${formatMinutes(minutes)} ${minutes > 0 ? "late" : "early"}`
}

export function buildProposalView(proposal: NormalizationProposal): ProposalView {
  const blockStart = timeToMinutes(proposal.blockStartTime)
  const blockEnd = timeToMinutes(proposal.blockEndTime)
  const clockIn = toOrgWallClockMinutes(proposal.clockIn)
  const clockOut = proposal.clockOut ? toOrgWallClockMinutes(proposal.clockOut) : null

  const inDiff = clockIn - blockStart
  const outDiff = clockOut == null ? null : clockOut - blockEnd
  const parts = [describe(inDiff, "in"), clockOut == null ? "no clock-out" : describe(outDiff ?? 0, "out")].filter(
    (part): part is string => Boolean(part),
  )

  const lo = Math.min(blockStart - BAR_PADDING_MINUTES, clockIn)
  const hi = Math.max(blockEnd + BAR_PADDING_MINUTES, clockOut ?? blockEnd)
  const span = Math.max(hi - lo, 1)
  const entryEnd = clockOut ?? blockEnd
  const day = proposal.blockDay.slice(0, 3)

  return {
    proposal,
    isClose: Math.abs(inDiff) <= CLOSE_MATCH_MINUTES,
    needsLook:
      Math.abs(inDiff) > CLOSE_MATCH_MINUTES ||
      clockOut == null ||
      Math.abs(outDiff ?? 0) > CLOSE_MATCH_MINUTES,
    difference: parts.length > 0 ? parts.join(" · ") : "Exact match",
    blockLabel: `${day.charAt(0).toUpperCase()}${day.slice(1)} ${formatTime(proposal.blockStartTime)} – ${formatTime(proposal.blockEndTime)}`,
    block: { left: ((blockStart - lo) / span) * 100, width: ((blockEnd - blockStart) / span) * 100 },
    entry: {
      left: ((clockIn - lo) / span) * 100,
      width: (Math.max(entryEnd - clockIn, 0) / span) * 100,
      open: clockOut == null,
    },
  }
}

const REASONS: Record<UnmatchedReason, { label: string; next: (_firstName: string) => string }> = {
  no_schedule: {
    label: "No schedule",
    next: (name) => `${name} has no schedule this term. Add one in Schedules, or remove the entry in Student Records.`,
  },
  outside_term_range: {
    label: "Outside term dates",
    next: () => "The clock-in falls outside the term or the student's schedule dates. Check the entry in Student Records.",
  },
  no_blocks_that_day: {
    label: "No shifts that day",
    next: () =>
      "Nothing was scheduled that day (or it was a day off or time off). Add a one-off shift in Teams or remove the entry.",
  },
  outside_window: {
    label: "Too far from a shift",
    next: (name) => `The clock-in is too far from any shift that day. Check with ${name}, then edit the entry by hand.`,
  },
  block_already_claimed: {
    label: "Shift already linked",
    next: () => "That shift already has a clock-in. One is probably a duplicate tap.",
  },
}

export function describeUnmatched(entry: NormalizationUnmatched): { label: string; next: string } {
  const reason = REASONS[entry.reason]
  const firstName = entry.studentName.split(" ")[0] || "the student"
  return { label: reason.label, next: reason.next(firstName) }
}
