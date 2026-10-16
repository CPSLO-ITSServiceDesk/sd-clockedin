"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { toast } from "sonner"

import { formatStudentName } from "@/components/admin/mock-students"
import { TimesheetCalendar } from "@/components/admin/timesheet/timesheet-calendar"
import { TimesheetDayPanel } from "@/components/admin/timesheet/timesheet-day-panel"
import { useAdminSession } from "@/hooks/use-admin-session"
import { useStudentSelection } from "@/hooks/use-student-selection"
import { getAvatarToneClass } from "@/lib/avatar-tones"
import type { ScheduleStudent } from "@/lib/api/schedule-mappers"
import { timesheetApi, type StudentMonthSummary } from "@/lib/api/timesheet"
import { getOrgLocalDateString } from "@/lib/org-time"
import { queryKeys } from "@/lib/query-keys"
import {
  formatHours,
  formatMonthLabel,
  formatSignedHours,
  pickDefaultDay,
  shiftMonthKey,
  studentTag,
  type StudentTag,
} from "@/lib/timesheet/month-calendar"
import { cn } from "@/lib/utils"

const BASE_PATH = "/admin/timesheet-verification"

/** Month differences at or above this are highlighted. */
const DIFF_HIGHLIGHT_HOURS = 0.5

const TAG_CLASSES: Record<StudentTag["tone"], string> = {
  verified: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  issues: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  ready: "bg-muted text-foreground",
  empty: "bg-muted text-muted-foreground",
}

function initials(student: ScheduleStudent): string {
  return `${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toUpperCase()
}

function Tag({ tag, className }: Readonly<{ tag: StudentTag; className?: string }>) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold",
        TAG_CLASSES[tag.tone],
        className,
      )}
    >
      {tag.label}
    </span>
  )
}

export function TimesheetVerification() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { email } = useAdminSession()
  const {
    isLoading: studentsLoading,
    activeStudents,
    selectedStudent,
    searchQuery,
    setSearchQuery,
    filteredStudents,
    selectStudent,
  } = useStudentSelection({ basePath: BASE_PATH })

  const monthParam = searchParams.get("month")
  const month =
    monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)
      ? monthParam
      : getOrgLocalDateString().slice(0, 7)
  const [dayChoice, setDayChoice] = useState<{ key: string; date: string } | null>(null)

  const summaryQuery = useQuery({
    queryKey: queryKeys.timesheet.month(month),
    queryFn: () => timesheetApi.getMonth(month),
  })
  const studentQuery = useQuery({
    queryKey: queryKeys.timesheet.studentMonth(selectedStudent?.id ?? 0, month),
    queryFn: () => timesheetApi.getStudentMonth(selectedStudent!.id, month),
    enabled: !!selectedStudent,
  })

  const summaries = new Map(
    (summaryQuery.data?.students ?? []).map((summary) => [summary.studentAssistantId, summary]),
  )
  const verificationAvailable = summaryQuery.data?.verificationAvailable ?? true
  const verifiedCount = activeStudents.filter((student) => summaries.get(student.id)?.verification).length

  const sheet = studentQuery.data
  const selectionKey = `${selectedStudent?.id}-${month}`
  const selectedDate =
    dayChoice?.key === selectionKey ? dayChoice.date : sheet ? pickDefaultDay(sheet.days) : null

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.timesheet.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all }),
    ])

  const verifyMutation = useMutation({
    mutationFn: async ({ studentId, verified }: { studentId: number; verified: boolean }) =>
      verified ? timesheetApi.verify(studentId, month, email || null) : timesheetApi.unverify(studentId, month),
    onSuccess: async (_data, { verified }) => {
      await refresh()
      toast.success(verified ? "Timesheet verified" : "Verification removed")
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't update verification"),
  })

  const changeMonth = (delta: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("month", shiftMonthKey(month, delta))
    router.replace(`${BASE_PATH}?${params.toString()}`, { scroll: false })
  }

  const summary: StudentMonthSummary | undefined = sheet ?? (selectedStudent ? summaries.get(selectedStudent.id) : undefined)
  const diff = summary ? summary.workedHours - summary.scheduledHours : 0
  const stats = summary
    ? [
        { value: `${formatHours(summary.workedHours)}h`, label: "worked", className: "bg-muted" },
        { value: `${formatHours(summary.scheduledHours)}h`, label: "scheduled", className: "bg-muted" },
        {
          value: `${formatSignedHours(diff)}h`,
          label: "difference",
          className:
            Math.abs(diff) >= DIFF_HIGHLIGHT_HOURS
              ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        },
        {
          value: `${formatHours(summary.excusedHours)}h`,
          label: "excused (Teams)",
          className: "bg-sky-500/10 text-sky-800 dark:text-sky-200",
        },
        {
          value: String(summary.issueCount),
          label: "days to review",
          className: summary.issueCount > 0 ? "bg-destructive/10 text-destructive" : "bg-muted",
        },
      ]
    : []

  const isVerified = Boolean(summary?.verification)
  const verifyLabel = isVerified
    ? "Verified"
    : summary && summary.issueCount > 0
      ? "Verify anyway"
      : "Mark verified"

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Timesheet verification</h1>
          <p className="text-sm text-muted-foreground">
            {formatMonthLabel(month)} · {verifiedCount} of {activeStudents.length} verified
          </p>
        </div>
        <div className="flex h-[38px] items-center gap-1 self-start rounded-full border border-border bg-card px-1.5 md:self-auto">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="flex size-7 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronLeft className="size-3.5" />
            <span className="sr-only">Previous month</span>
          </button>
          <span className="min-w-[120px] text-center text-sm font-semibold">{formatMonthLabel(month)}</span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="flex size-7 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronRight className="size-3.5" />
            <span className="sr-only">Next month</span>
          </button>
        </div>
      </div>

      {!verificationAvailable ? (
        <p className="rounded-xl bg-amber-500/10 px-4 py-2.5 text-[13px] font-semibold text-amber-800 dark:text-amber-200">
          Verification can&apos;t be saved yet. Apply the timesheet_verification database migration to turn it on.
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-2.5 rounded-[20px] border border-border bg-card p-3.5">
          <label className="flex h-[38px] items-center gap-2 rounded-full border border-border bg-muted/50 px-3">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search students"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex max-h-[640px] flex-col gap-0.5 overflow-y-auto">
            {studentsLoading ? (
              <p className="px-2.5 py-4 text-sm text-muted-foreground">Loading students...</p>
            ) : filteredStudents.length === 0 ? (
              <p className="px-2.5 py-4 text-sm text-muted-foreground">No students match.</p>
            ) : (
              filteredStudents.map((student) => {
                const studentSummary = summaries.get(student.id)
                const selected = student.id === selectedStudent?.id
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => selectStudent(student)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                      selected ? "bg-accent/10" : "hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        selected ? "bg-accent text-accent-foreground" : getAvatarToneClass(student.id),
                      )}
                    >
                      {initials(student)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{formatStudentName(student)}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {studentSummary
                          ? `${formatHours(studentSummary.workedHours)} / ${formatHours(studentSummary.scheduledHours)}h`
                          : summaryQuery.isLoading
                            ? "…"
                            : "0.0 / 0.0h"}
                      </span>
                    </span>
                    {summaryQuery.isLoading ? null : <Tag tag={studentTag(studentSummary)} />}
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col gap-[18px] rounded-[20px] border border-border bg-card px-6 py-[22px]">
          {!selectedStudent ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Pick a student to compare their hours with their schedule.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[22px] font-bold tracking-[-0.01em]">
                    {formatStudentName(selectedStudent)}
                  </span>
                  {summary ? <Tag tag={studentTag(summary)} className="px-2.5 py-[3px] text-xs" /> : null}
                </div>
                <button
                  type="button"
                  disabled={!summary || !verificationAvailable || verifyMutation.isPending}
                  onClick={() =>
                    verifyMutation.mutate({ studentId: selectedStudent.id, verified: !isVerified })
                  }
                  title={isVerified ? "Click to remove verification" : undefined}
                  className={cn(
                    "flex h-[38px] items-center gap-1.5 rounded-full px-[18px] text-[13px] font-bold disabled:opacity-50",
                    isVerified
                      ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
                      : "bg-accent text-accent-foreground hover:bg-accent/90",
                  )}
                >
                  {isVerified ? <Check className="size-3.5" /> : null}
                  {verifyLabel}
                </button>
              </div>
              {summary?.verification ? (
                <p className="-mt-3 text-xs text-muted-foreground">
                  Verified{summary.verification.verifiedBy ? ` by ${summary.verification.verifiedBy}` : ""} on{" "}
                  {new Date(summary.verification.verifiedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {stats.map((stat) => (
                  <div key={stat.label} className={cn("flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3", stat.className)}>
                    <span className="font-mono text-2xl font-semibold">{stat.value}</span>
                    <span className="text-xs">{stat.label}</span>
                  </div>
                ))}
              </div>

              {studentQuery.isLoading ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Loading timesheet...</p>
              ) : studentQuery.error ? (
                <p className="py-12 text-center text-sm text-destructive">Couldn&apos;t load this timesheet.</p>
              ) : sheet ? (
                <>
                  <TimesheetCalendar
                    month={month}
                    days={sheet.days}
                    selectedDate={selectedDate}
                    onSelectDate={(date) => setDayChoice({ key: selectionKey, date })}
                  />
                  {selectedDate ? (
                    <TimesheetDayPanel
                      key={`${selectionKey}-${selectedDate}`}
                      studentId={selectedStudent.id}
                      date={selectedDate}
                      day={sheet.days.find((day) => day.date === selectedDate)}
                      onChanged={refresh}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nothing scheduled or worked this month. Click a day to add an entry.
                    </p>
                  )}
                </>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
