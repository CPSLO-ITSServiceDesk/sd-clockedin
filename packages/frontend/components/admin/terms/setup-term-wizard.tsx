"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { DatePickerField } from "@/components/admin/terms/date-picker-field"
import { ScheduleImportPanel } from "@/components/admin/schedules/schedule-import-panel"
import {
  ACADEMIC_CALENDAR_URL,
  ISO_DATE_PATTERN,
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { termsApi } from "@/lib/api/terms"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: 1, label: "Add term" },
  { id: 2, label: "Import schedules" },
  { id: 3, label: "Done" },
] as const

const setupTermSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Term name is required")
      .max(100, "Term name must be 100 characters or fewer"),
    start_date: z.string().regex(ISO_DATE_PATTERN, "Start date is required"),
    end_date: z.string().regex(ISO_DATE_PATTERN, "End date is required"),
  })
  .superRefine((values, context) => {
    if (values.start_date && values.end_date && values.end_date < values.start_date) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after the start date",
        path: ["end_date"],
      })
    }
  })

type SetupTermValues = z.infer<typeof setupTermSchema>

interface CreatedTerm {
  id: number
  name: string
}

interface SetupTermWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function StepIndicator({ currentStep }: Readonly<{ currentStep: number }>) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((step, index) => {
        const isComplete = currentStep > step.id
        const isCurrent = currentStep === step.id

        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                isComplete && "border-accent bg-accent text-accent-foreground",
                isCurrent && "border-accent text-accent",
                !isComplete && !isCurrent && "border-border text-muted-foreground",
              )}
            >
              {isComplete ? <CheckCircle2 className="size-3.5" /> : step.id}
            </div>
            <span
              className={cn(
                "hidden truncate text-xs uppercase tracking-wider sm:inline",
                isCurrent ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 ? (
              <div className="bg-border hidden h-px flex-1 sm:block" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export function SetupTermWizard({ open, onOpenChange }: SetupTermWizardProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [createdTerm, setCreatedTerm] = useState<CreatedTerm | null>(null)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const form = useForm<SetupTermValues>({
    resolver: zodResolver(setupTermSchema),
    defaultValues: {
      name: "",
      start_date: "",
      end_date: "",
    },
    mode: "onTouched",
  })

  const startDate = form.watch("start_date")
  const endDate = form.watch("end_date")
  const termRange = {
    fromDate: startDate ? new Date(`${startDate}T00:00:00`) : undefined,
    toDate: endDate ? new Date(`${endDate}T00:00:00`) : undefined,
  }

  const resetWizard = () => {
    setStep(1)
    setCreatedTerm(null)
    setImportSummary(null)
    setSubmitError(null)
    setCreating(false)
    form.reset()
    form.clearErrors()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetWizard()
    onOpenChange(nextOpen)
  }

  const handleCreateTerm = form.handleSubmit(async (values) => {
    setCreating(true)
    setSubmitError(null)

    try {
      const term = await termsApi.create({
        name: values.name.trim(),
        start_date: values.start_date,
        end_date: values.end_date,
        is_active: true,
        off_days: { vacations: [], special_schedules: [] },
      })

      await queryClient.invalidateQueries({ queryKey: queryKeys.terms.all })

      setCreatedTerm({
        id: term.id,
        name: term.name ?? values.name.trim(),
      })
      setStep(2)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create term")
    } finally {
      setCreating(false)
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-4 border-b px-6 py-5 pr-14 text-left">
          <div className="space-y-1">
            <DialogTitle>Set up a working term</DialogTitle>
            <DialogDescription>
              Create a term, import your team&apos;s schedules, and start tracking
              shifts.
            </DialogDescription>
          </div>
          <StepIndicator currentStep={step} />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {step === 1 ? (
            <Form {...form}>
              <form id="setup-term-form" onSubmit={handleCreateTerm} className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Name your term and set its date range. Official dates are on the{" "}
                  <a
                    href={ACADEMIC_CALENDAR_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    Cal Poly academic calendar
                  </a>
                  .
                </p>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Term name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Fall 2026" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
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

                {submitError ? (
                  <p className="text-sm text-destructive">{submitError}</p>
                ) : null}
              </form>
            </Form>
          ) : null}

          {step === 2 && createdTerm ? (
            <ScheduleImportPanel
              key={createdTerm.id}
              termId={createdTerm.id}
              termName={createdTerm.name}
              onImportSuccess={(message) => {
                setImportSummary(message)
                setStep(3)
              }}
            />
          ) : null}

          {step === 3 && createdTerm ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/10">
                <CheckCircle2 className="size-7 text-accent" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">You&apos;re all set</h3>
                <p className="text-muted-foreground text-sm">
                  <span className="text-foreground font-medium">{createdTerm.name}</span>{" "}
                  is ready to use.
                  {importSummary
                    ? ` ${importSummary}`
                    : " You can import schedules anytime from the Schedules page."}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button type="button" variant="outline" asChild>
                  <Link href="/admin/schedules">View schedules</Link>
                </Button>
                <Button type="button" asChild>
                  <Link href="/admin">Go to dashboard</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {step === 1 ? (
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" form="setup-term-form" disabled={creating}>
              {creating ? "Creating..." : "Continue"}
            </Button>
          </DialogFooter>
        ) : null}

        {step === 2 ? (
          <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(3)}>
              Skip for now
            </Button>
          </DialogFooter>
        ) : null}

        {step === 3 ? (
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
