"use client"

import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"

import {
  SCHEDULE_WEEKDAYS,
  type DraftScheduleBlock,
} from "@/components/admin/schedules/schedule-types"
import {
  formatDayShort,
  formatWeeklyHours,
  timeToMinutes,
  totalWeeklyHours,
} from "@/components/admin/schedules/schedule-utils"
import {
  STUDENT_ROLE_OPTIONS,
  emptyStudentFormValues,
  studentAssistantFormSchema,
  type StudentAssistantFormValues,
} from "@/components/admin/students/student-assistant-form"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { formatHourShort } from "@/lib/schedules/team-week"
import { cn } from "@/lib/utils"

const INPUT_CLASS =
  "h-[38px] w-full min-w-0 rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"

function compactTime(value: string): string {
  const minutes = timeToMinutes(value)
  const hour = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return formatHourShort(hour)
  return `${hour % 12 || 12}:${String(rest).padStart(2, "0")}${hour < 12 ? "a" : "p"}`
}

export interface StudentEditPanelSchedule {
  blocks: DraftScheduleBlock[]
  termName: string | null
  fromTeams: boolean
}

interface StudentEditPanelProps {
  /** Null when adding a new student. */
  studentId: number | null
  initialValues: StudentAssistantFormValues | null
  isActive: boolean
  schedule: StudentEditPanelSchedule | null
  existingStudents: { id: number; polycard_id: number | null }[]
  isSaving: boolean
  onSubmit: (_values: StudentAssistantFormValues) => Promise<boolean>
  onToggleActive: () => void
  onDelete: () => void
  onCancel: () => void
}

export function StudentEditPanel({
  studentId,
  initialValues,
  isActive,
  schedule,
  existingStudents,
  isSaving,
  onSubmit,
  onToggleActive,
  onDelete,
  onCancel,
}: Readonly<StudentEditPanelProps>) {
  const isNew = studentId === null
  const form = useForm<StudentAssistantFormValues>({
    resolver: zodResolver(studentAssistantFormSchema),
    defaultValues: initialValues ?? emptyStudentFormValues,
    mode: "onTouched",
  })

  const [firstName, lastName, polycardId] = form.watch(["first_name", "last_name", "polycard_id"])
  const name = `${firstName} ${lastName}`.trim()
  const initials = `${firstName.trim()[0] ?? ""}${lastName.trim()[0] ?? ""}`.toUpperCase()
  const missingCard = !isNew && isActive && polycardId.trim() === ""

  const handleSubmit = form.handleSubmit(async (values) => {
    if (values.polycard_id) {
      const card = Number(values.polycard_id)
      const duplicate = existingStudents.some(
        (other) => other.polycard_id === card && other.id !== studentId,
      )
      if (duplicate) {
        form.setError("polycard_id", {
          type: "manual",
          message: "This Polycard ID is already assigned to another student",
        })
        return
      }
    }
    const saved = await onSubmit(values)
    if (saved) form.reset(values)
  })

  const blocks = schedule?.blocks ?? []
  const hours = totalWeeklyHours(blocks)
  const source = schedule?.fromTeams ? "from Teams Shifts" : schedule?.termName

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-5 lg:sticky lg:top-6"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground">
            {initials || "+"}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-lg font-bold">
              {isNew ? name || "New student" : name || "Unnamed student"}
            </span>
            <span className="text-xs text-muted-foreground">
              {isNew
                ? "Teams sync matches them by work email"
                : "Synced from Teams · edits stay in ClockedIn"}
            </span>
          </div>
        </div>

        {missingCard ? (
          <div className="rounded-xl bg-amber-500/15 px-3 py-2.5 text-[13px] font-semibold leading-[1.4] text-amber-800 dark:text-amber-200">
            No Polycard ID — this student can&apos;t tap in at the kiosk.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2.5">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem className="gap-1.5">
                <FormLabel className="text-xs font-semibold text-muted-foreground">First name</FormLabel>
                <FormControl>
                  <input {...field} autoComplete="given-name" className={INPUT_CLASS} />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem className="gap-1.5">
                <FormLabel className="text-xs font-semibold text-muted-foreground">Last name</FormLabel>
                <FormControl>
                  <input {...field} autoComplete="family-name" className={INPUT_CLASS} />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="work_email"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs font-semibold text-muted-foreground">Work email</FormLabel>
              <FormControl>
                <input
                  {...field}
                  type="email"
                  autoComplete="email"
                  placeholder="name@calpoly.edu"
                  className={INPUT_CLASS}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="polycard_id"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs font-semibold text-muted-foreground">Polycard ID</FormLabel>
              <FormControl>
                <input
                  {...field}
                  onChange={(event) => field.onChange(event.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="Tap card at kiosk or type the number"
                  className={cn(
                    INPUT_CLASS,
                    "font-mono",
                    missingCard && "border-[1.5px] border-amber-500",
                  )}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs font-semibold text-muted-foreground">Role</FormLabel>
              <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
                {STUDENT_ROLE_OPTIONS.map((option) => {
                  const on = field.value === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => field.onChange(option.value)}
                      className={cn(
                        "h-8 rounded-full text-xs font-bold transition-colors",
                        on
                          ? "bg-card text-accent shadow-[0_1px_3px_rgba(20,22,28,0.12)]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </FormItem>
          )}
        />

        {!isNew && schedule ? (
          <div className="flex flex-col gap-2 rounded-[14px] bg-muted/60 px-3.5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold">Weekly schedule</span>
              {isActive ? (
                <Link
                  href={`/admin/schedules?student=${studentId}`}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Edit schedule
                </Link>
              ) : null}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {SCHEDULE_WEEKDAYS.map((weekday) => {
                const dayBlocks = blocks
                  .filter((block) => block.day === weekday.value)
                  .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
                const on = dayBlocks.length > 0
                return (
                  <div
                    key={weekday.value}
                    className={cn(
                      "flex flex-col items-center gap-[3px] rounded-[10px] px-0.5 py-1.5",
                      on ? "bg-card text-accent" : "text-muted-foreground",
                    )}
                  >
                    <span className="text-[11px] font-bold">{formatDayShort(weekday.value)}</span>
                    {on ? (
                      dayBlocks.map((block) => (
                        <span
                          key={block.start_time}
                          className="text-center font-mono text-[10px] leading-[1.3]"
                        >
                          {compactTime(block.start_time)}–{compactTime(block.end_time)}
                        </span>
                      ))
                    ) : (
                      <span className="font-mono text-[10px] leading-[1.3]">—</span>
                    )}
                  </div>
                )
              })}
            </div>
            <span className="text-xs text-muted-foreground">
              {blocks.length > 0
                ? `${formatWeeklyHours(hours).replace("h", "")} hours a week${source ? ` · ${source}` : ""}`
                : `No shifts${schedule.termName ? ` for ${schedule.termName}` : " this term"}`}
            </span>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          {isNew ? (
            <button
              type="button"
              onClick={onCancel}
              className="h-[38px] rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted"
            >
              Cancel
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onToggleActive}
                className="h-[38px] rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted"
              >
                {isActive ? "Deactivate" : "Reactivate"}
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete student"
                className="flex size-[38px] items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
          <div className="flex-1" />
          <button
            type="submit"
            disabled={isSaving || (!isNew && !form.formState.isDirty)}
            className="h-[38px] rounded-full bg-primary px-[18px] text-[13px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : isNew ? "Add student" : "Save changes"}
          </button>
        </div>
      </form>
    </Form>
  )
}

export function StudentEditPanelEmpty() {
  return (
    <section className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-border bg-card px-6 py-12 text-center lg:sticky lg:top-6">
      <span className="text-sm font-semibold">Pick a student</span>
      <span className="text-[13px] text-muted-foreground">
        Click a row to edit their Polycard ID, role and details.
      </span>
    </section>
  )
}
