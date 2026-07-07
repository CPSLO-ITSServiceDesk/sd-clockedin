"use client"

import { useCallback, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Link2, Search } from "lucide-react"
import { toast } from "sonner"
import { TermPageHeader } from "@/components/admin/student-term/term-page-header"
import {
  applyNormalizationMatches,
  fetchNormalizationPreview,
  type NormalizationPreview,
  type NormalizationProposal,
  type UnmatchedReason,
} from "@/lib/api/shift-normalization"
import { formatTime, formatTimeRange } from "@/lib/format-time"
import { queryKeys } from "@/lib/query-keys"
import { useStudentTermSelection } from "@/hooks/use-student-term-selection"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const BASE_PATH = "/admin/shift-normalization"

const UNMATCHED_REASON_LABELS: Record<UnmatchedReason, string> = {
  no_schedule: "No schedule",
  outside_term_range: "Outside term range",
  no_blocks_that_day: "No blocks that day",
  outside_window: "Outside window",
  block_already_claimed: "Block already claimed",
}

function formatBlockDay(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

export function ShiftNormalizationManager() {
  const queryClient = useQueryClient()
  const { sortedTerms, activeTermId, selectedTerm, changeTerm } =
    useStudentTermSelection({ basePath: BASE_PATH })

  const [preview, setPreview] = useState<NormalizationPreview | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unmatchedOpen, setUnmatchedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const proposals = preview?.proposals ?? []
  const selectedCount = useMemo(
    () => proposals.filter((p) => selectedIds.has(p.timeEntryId)).length,
    [proposals, selectedIds],
  )

  const handleScan = useCallback(async () => {
    if (!activeTermId) return

    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const result = await fetchNormalizationPreview(activeTermId)
      setPreview(result)
      setSelectedIds(new Set(result.proposals.map((p) => p.timeEntryId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed")
    } finally {
      setLoading(false)
    }
  }, [activeTermId])

  const toggleProposal = useCallback((timeEntryId: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(timeEntryId)
      } else {
        next.delete(timeEntryId)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(proposals.map((p) => p.timeEntryId)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [proposals],
  )

  const handleApply = useCallback(async () => {
    if (!activeTermId || selectedCount === 0) return

    setApplying(true)
    setConfirmOpen(false)

    const matches = proposals
      .filter((p) => selectedIds.has(p.timeEntryId))
      .map((p) => ({
        timeEntryId: p.timeEntryId,
        scheduleBlockId: p.proposedBlockId,
      }))

    try {
      const result = await applyNormalizationMatches(activeTermId, matches)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.analytics.term(activeTermId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.todayShifts.all }),
      ])

      toast.success(
        `Linked ${result.applied} ${result.applied === 1 ? "entry" : "entries"}${
          result.skipped.length > 0 ? `; ${result.skipped.length} skipped` : ""
        }`,
      )

      await handleScan()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed")
    } finally {
      setApplying(false)
    }
  }, [activeTermId, selectedCount, proposals, selectedIds, queryClient, handleScan])

  const allSelected = proposals.length > 0 && selectedCount === proposals.length

  return (
    <div className="space-y-6">
      <TermPageHeader
        title="Shift Normalization"
        description="Find unscheduled time entries and link them to matching schedule blocks."
        sortedTerms={sortedTerms}
        activeTermId={activeTermId}
        onTermChange={changeTerm}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleScan}
          disabled={!activeTermId || loading || applying}
        >
          <Search className="size-4" />
          {loading ? "Scanning..." : "Scan for matches"}
        </Button>
        {preview && proposals.length > 0 ? (
          <Button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={selectedCount === 0 || applying}
          >
            <Link2 className="size-4" />
            Apply selected ({selectedCount})
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}

      {preview ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Unscheduled entries"
              value={preview.summary.totalUnscheduled}
            />
            <SummaryCard
              label="Proposed matches"
              value={preview.summary.proposedMatches}
            />
            <SummaryCard label="No match" value={preview.summary.noMatch} />
          </div>

          {proposals.length > 0 ? (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Proposed matches</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked) =>
                            toggleAll(checked === true)
                          }
                          aria-label="Select all proposals"
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock in</TableHead>
                      <TableHead>Clock out</TableHead>
                      <TableHead>Proposed block</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposals.map((proposal: NormalizationProposal) => (
                      <TableRow key={proposal.timeEntryId}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(proposal.timeEntryId)}
                            onCheckedChange={(checked) =>
                              toggleProposal(
                                proposal.timeEntryId,
                                checked === true,
                              )
                            }
                            aria-label={`Select entry ${proposal.timeEntryId}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {proposal.studentName}
                        </TableCell>
                        <TableCell>{proposal.date}</TableCell>
                        <TableCell>{formatTime(proposal.clockIn)}</TableCell>
                        <TableCell>
                          {proposal.clockOut
                            ? formatTime(proposal.clockOut)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {formatBlockDay(proposal.blockDay)}{" "}
                          {formatTimeRange(
                            proposal.blockStartTime,
                            proposal.blockEndTime,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                {preview.summary.totalUnscheduled === 0
                  ? `No unscheduled entries found for ${selectedTerm?.name ?? "this term"}.`
                  : "No close matches found. Unmatched entries are listed below."}
              </CardContent>
            </Card>
          )}

          {preview.unmatched.length > 0 ? (
            <Collapsible open={unmatchedOpen} onOpenChange={setUnmatchedOpen}>
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex h-auto w-full items-center justify-between px-0 hover:bg-transparent"
                    >
                      <CardTitle className="text-lg">
                        Unmatched ({preview.unmatched.length})
                      </CardTitle>
                      <ChevronDown
                        className={cn(
                          "text-muted-foreground size-4 transition-transform",
                          unmatchedOpen && "rotate-180",
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="overflow-x-auto pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Clock in</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.unmatched.map((entry) => (
                          <TableRow key={entry.timeEntryId}>
                            <TableCell className="font-medium">
                              {entry.studentName}
                            </TableCell>
                            <TableCell>{entry.date || "—"}</TableCell>
                            <TableCell>{formatTime(entry.clockIn)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {UNMATCHED_REASON_LABELS[entry.reason]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ) : null}
        </>
      ) : (
        <Card className="border-border">
          <CardContent className="text-muted-foreground flex min-h-[280px] flex-col items-center justify-center gap-3 text-center text-sm">
            <Link2 className="size-8 opacity-40" />
            <p>
              Select a term and scan to find unscheduled entries that can be
              linked to schedule blocks.
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply selected matches?</AlertDialogTitle>
            <AlertDialogDescription>
              This will link {selectedCount}{" "}
              {selectedCount === 1 ? "entry" : "entries"} to their proposed
              schedule blocks for {selectedTerm?.name ?? "the selected term"}.
              This cannot be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApply} disabled={applying}>
              {applying ? "Applying..." : "Apply matches"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
