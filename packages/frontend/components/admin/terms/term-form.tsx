"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import { DatePickerField } from "@/components/admin/terms/date-picker-field"
import {
  createClientId,
  ISO_DATE_PATTERN,
  parseTermOffDays,
  ACADEMIC_CALENDAR_URL,
  WEEKDAY_OPTIONS,
  type AcademicTerm,
  type TermOffDays,
  type Weekday,
} from "@/components/admin/terms/term-types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const vacationEntrySchema = z.object({
  clientId: z.string(),
  date: z
    .string()
    .regex(ISO_DATE_PATTERN, "Vacation date is required"),
  label: z
    .string()
    .trim()
    .max(200, "Label must be 200 characters or fewer"),
})

const specialScheduleEntrySchema = z.object({
  clientId: z.string(),
  date: z
    .string()
    .regex(ISO_DATE_PATTERN, "Schedule date is required"),
  swap_to_day: z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]),
  label: z
    .string()
    .trim()
    .max(200, "Label must be 200 characters or fewer"),
})

const termFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Term name is required")
      .max(100, "Term name must be 100 characters or fewer"),
    start_date: z
      .string()
      .regex(ISO_DATE_PATTERN, "Start date is required"),
    end_date: z.string().regex(ISO_DATE_PATTERN, "End date is required"),
    vacations: z.array(vacationEntrySchema),
    special_schedules: z.array(specialScheduleEntrySchema),
  })
  .superRefine((values, context) => {
    if (values.start_date && values.end_date && values.end_date < values.start_date) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after the start date",
        path: ["end_date"],
      })
    }

    const termStart = values.start_date
    const termEnd = values.end_date
    const hasValidRange =
      ISO_DATE_PATTERN.test(termStart) &&
      ISO_DATE_PATTERN.test(termEnd) &&
      termEnd >= termStart

    if (!hasValidRange) return

    const validateDateInRange = (
      date: string,
      path: (string | number)[],
      label: string,
    ) => {
      if (!date) return

      if (date < termStart || date > termEnd) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must fall within the term dates`,
          path,
        })
      }
    }

    const seenVacationDates = new Set<string>()
    values.vacations.forEach((vacation, index) => {
      validateDateInRange(vacation.date, ["vacations", index, "date"], "Vacation date")

      if (!vacation.date || seenVacationDates.has(vacation.date)) {
        if (vacation.date && seenVacationDates.has(vacation.date)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "This vacation date is already listed",
            path: ["vacations", index, "date"],
          })
        }
        return
      }

      seenVacationDates.add(vacation.date)
    })

    const seenSpecialDates = new Set<string>()
    values.special_schedules.forEach((schedule, index) => {
      validateDateInRange(
        schedule.date,
        ["special_schedules", index, "date"],
        "Special schedule date",
      )

      if (!schedule.date || seenSpecialDates.has(schedule.date)) {
        if (schedule.date && seenSpecialDates.has(schedule.date)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "This special schedule date is already listed",
            path: ["special_schedules", index, "date"],
          })
        }
        return
      }

      seenSpecialDates.add(schedule.date)

      if (schedule.date && seenVacationDates.has(schedule.date)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "This date is already marked as a vacation day",
          path: ["special_schedules", index, "date"],
        })
      }
    })
  })

export type TermFormValues = z.infer<typeof termFormSchema>

const emptyValues: TermFormValues = {
  name: "",
  start_date: "",
  end_date: "",
  vacations: [],
  special_schedules: [],
}

function valuesFromTerm(term: AcademicTerm): TermFormValues {
  const offDays = parseTermOffDays(term.off_days)

  return {
    name: term.name,
    start_date: term.start_date,
    end_date: term.end_date,
    vacations: offDays.vacations.map((vacation) => ({
      clientId: createClientId(),
      date: vacation.date,
      label: vacation.label ?? "",
    })),
    special_schedules: offDays.special_schedules.map((schedule) => ({
      clientId: createClientId(),
      date: schedule.date,
      swap_to_day: schedule.swap_to_day,
      label: schedule.label ?? "",
    })),
  }
}

export function toTermOffDays(values: TermFormValues): TermOffDays {
  return {
    vacations: values.vacations.map((vacation) => ({
      date: vacation.date,
      ...(vacation.label.trim() ? { label: vacation.label.trim() } : {}),
    })),
    special_schedules: values.special_schedules.map((schedule) => ({
      date: schedule.date,
      swap_to_day: schedule.swap_to_day,
      ...(schedule.label.trim() ? { label: schedule.label.trim() } : {}),
    })),
  }
}

interface TermFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  term?: AcademicTerm | null
  existingTerms?: Pick<AcademicTerm, "id" | "name">[]
  onSubmit: (values: TermFormValues) => void
}

export function TermForm({
  open,
  onOpenChange,
  term,
  existingTerms = [],
  onSubmit,
}: TermFormProps) {
  const isEditing = Boolean(term)

  const form = useForm<TermFormValues>({
    resolver: zodResolver(termFormSchema),
    defaultValues: emptyValues,
    mode: "onTouched",
  })

  const {
    fields: vacationFields,
    append: appendVacation,
    remove: removeVacation,
  } = useFieldArray({
    control: form.control,
    name: "vacations",
    keyName: "fieldId",
  })

  const {
    fields: specialScheduleFields,
    append: appendSpecialSchedule,
    remove: removeSpecialSchedule,
  } = useFieldArray({
    control: form.control,
    name: "special_schedules",
    keyName: "fieldId",
  })

  useEffect(() => {
    if (!open) return

    form.reset(term ? valuesFromTerm(term) : emptyValues)
    form.clearErrors()
  }, [open, term, form])

  const handleSubmit = form.handleSubmit((values) => {
    const normalizedName = values.name.trim()
    const duplicate = existingTerms.some(
      (existingTerm) =>
        existingTerm.name.trim().toLowerCase() === normalizedName.toLowerCase() &&
        existingTerm.id !== term?.id,
    )

    if (duplicate) {
      form.setError("name", {
        type: "manual",
        message: "A term with this name already exists",
      })
      return
    }

    onSubmit(values)
    onOpenChange(false)
  })

  const startDate = form.watch("start_date")
  const endDate = form.watch("end_date")
  const termRange = {
    fromDate: startDate ? new Date(`${startDate}T00:00:00`) : undefined,
    toDate: endDate ? new Date(`${endDate}T00:00:00`) : undefined,
  }

  const isSubmitting = form.formState.isSubmitting

  const submitLabel = isSubmitting
    ? "Saving..."
    : isEditing
      ? "Save changes"
      : "Add term"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border flex h-[min(92vh,880px)] max-h-[92vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-5 pr-14 text-left">
          <DialogTitle>{isEditing ? "Edit Term" : "Add Term"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update term dates, vacation days, and special schedules."
              : "Create an academic term with its calendar and schedule exceptions."}{" "}
            Find official dates on the{" "}
            <a
              href={ACADEMIC_CALENDAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline-offset-4 hover:underline"
            >
              Cal Poly academic calendar
            </a>
            .
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-8">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Term name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Fall 2026"
                            autoComplete="off"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start date</FormLabel>
                          <FormControl>
                            <DatePickerField
                              value={field.value}
                              onChange={field.onChange}
                              toDate={termRange.toDate}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End date</FormLabel>
                          <FormControl>
                            <DatePickerField
                              value={field.value}
                              onChange={field.onChange}
                              fromDate={termRange.fromDate}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium">Vacation & time off</h3>
                      <p className="text-muted-foreground text-sm">
                        Days when students are not expected to work.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 self-start"
                      onClick={() =>
                        appendVacation({
                          clientId: createClientId(),
                          date: "",
                          label: "",
                        })
                      }
                    >
                      <Plus className="size-4" />
                      Add day
                    </Button>
                  </div>

                  {vacationFields.length === 0 ? (
                    <p className="text-muted-foreground rounded-md border border-dashed px-4 py-8 text-center text-sm">
                      No vacation or time off days added yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {vacationFields.map((field, index) => (
                        <div
                          key={field.clientId}
                          className="grid gap-4 rounded-lg border p-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto] md:items-end"
                        >
                          <FormField
                            control={form.control}
                            name={`vacations.${index}.date`}
                            render={({ field: dateField }) => (
                              <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl>
                                  <DatePickerField
                                    value={dateField.value}
                                    onChange={dateField.onChange}
                                    fromDate={termRange.fromDate}
                                    toDate={termRange.toDate}
                                    disabled={
                                      !termRange.fromDate || !termRange.toDate
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`vacations.${index}.label`}
                            render={({ field: labelField }) => (
                              <FormItem>
                                <FormLabel>Label</FormLabel>
                                <FormControl>
                                  <Input
                                    {...labelField}
                                    placeholder="Spring break"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end md:justify-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              onClick={() => removeVacation(index)}
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Remove vacation day</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!startDate || !endDate ? (
                    <FormDescription>
                      Set the term start and end dates before adding vacation days.
                    </FormDescription>
                  ) : null}
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium">Special schedules</h3>
                      <p className="text-muted-foreground text-sm">
                        Override a specific date to follow another weekday&apos;s
                        schedule.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 self-start"
                      onClick={() =>
                        appendSpecialSchedule({
                          clientId: createClientId(),
                          date: "",
                          swap_to_day: "monday" as Weekday,
                          label: "",
                        })
                      }
                    >
                      <Plus className="size-4" />
                      Add override
                    </Button>
                  </div>

                  {specialScheduleFields.length === 0 ? (
                    <p className="text-muted-foreground rounded-md border border-dashed px-4 py-8 text-center text-sm">
                      No special schedule overrides added yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {specialScheduleFields.map((field, index) => (
                        <div
                          key={field.clientId}
                          className="space-y-4 rounded-lg border p-4"
                        >
                          <div className="grid gap-4 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`special_schedules.${index}.date`}
                            render={({ field: dateField }) => (
                              <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl>
                                  <DatePickerField
                                    value={dateField.value}
                                    onChange={dateField.onChange}
                                    fromDate={termRange.fromDate}
                                    toDate={termRange.toDate}
                                    disabled={
                                      !termRange.fromDate || !termRange.toDate
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`special_schedules.${index}.swap_to_day`}
                            render={({ field: swapField }) => (
                              <FormItem>
                                <FormLabel>Use schedule from</FormLabel>
                                <Select
                                  onValueChange={swapField.onChange}
                                  value={swapField.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select a weekday" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {WEEKDAY_OPTIONS.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          </div>
                          <FormField
                            control={form.control}
                            name={`special_schedules.${index}.label`}
                            render={({ field: labelField }) => (
                              <FormItem>
                                <FormLabel>Notes</FormLabel>
                                <FormControl>
                                  <Input
                                    {...labelField}
                                    placeholder="Monday follows Friday schedule"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end border-t pt-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              onClick={() => removeSpecialSchedule(index)}
                            >
                              <Trash2 className="size-4" />
                              Remove override
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>

            <DialogFooter className="bg-background shrink-0 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
