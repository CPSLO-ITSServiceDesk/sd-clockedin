"use client"

import { useState, type ReactNode } from "react"
import { Sparkles } from "lucide-react"

import { Panel, Switch } from "@/components/admin/schedule-builder/builder-ui"
import type { BuilderContext } from "@/components/admin/schedule-builder/schedule-builder"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DraftPerson, DraftRules } from "@/lib/api/schedule-drafts"
import { assignedHours, availableHours, slotTimeLabel } from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

const VALUE_INPUT =
  "h-8 w-16 rounded-[10px] border border-border bg-muted/40 px-2 font-mono text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** Desk open/close options on the hour, 7 AM – 9 PM, as slot indexes. */
const HOUR_SLOTS = Array.from({ length: 15 }, (_, index) => (7 + index) * 2)

function NumberField({
  value,
  onChange,
  step = 1,
  label,
}: Readonly<{ value: number; onChange: (_value: number) => void; step?: number; label: string }>) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      aria-label={label}
      value={value}
      onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next) && next >= 0) onChange(next)
      }}
      className={VALUE_INPUT}
    />
  )
}

function RuleRow({
  title,
  why,
  enabled,
  onToggle,
  children,
}: Readonly<{
  title: string
  why: string
  enabled?: boolean
  onToggle?: (_enabled: boolean) => void
  children?: ReactNode
}>) {
  return (
    <div
      className={cn(
        "grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border-b border-border/60 px-5 py-3 last:border-0 md:grid-cols-[44px_minmax(0,1fr)_auto]",
        enabled === false && "opacity-55",
      )}
    >
      {onToggle ? <Switch checked={Boolean(enabled)} onChange={onToggle} label={title} /> : <span />}
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs text-muted-foreground">{why}</span>
      </div>
      <div className="col-start-2 flex items-center gap-1.5 md:col-start-3 md:justify-self-end">{children}</div>
    </div>
  )
}

export function StepGuidelines(context: Readonly<BuilderContext>) {
  const { draft, people, nameOf, edit, goTo, runGenerate, busy } = context
  const [confirmOpen, setConfirmOpen] = useState(false)
  const rules = draft.rules

  const setRules = (patch: (current: DraftRules) => DraftRules) =>
    edit((current) => ({ ...current, rules: patch(current.rules) }))
  const updatePerson = (studentId: number, patch: Partial<DraftPerson>) =>
    edit((current) => ({
      ...current,
      people: current.people.map((person) =>
        person.student_assistant_id === studentId ? { ...person, ...patch } : person,
      ),
    }))

  const hasShifts = people.some((person) => assignedHours(person) > 0)
  const withNotes = people.filter((person) => person.notes.trim() || person.import_warnings.length > 0)
  const scheduled = people.filter((person) => availableHours(person) > 0)

  const generate = async () => {
    setConfirmOpen(false)
    if (await runGenerate()) goTo(3)
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border/60 px-5 py-4">
          <Sparkles className="size-[18px] text-accent" />
          <div className="flex flex-col">
            <span className="text-[15px] font-bold">Desk rules</span>
            <span className="text-xs text-muted-foreground">
              The draft follows these. Turn off any you don&apos;t need this term.
            </span>
          </div>
        </div>

        <RuleRow title="Desk hours" why="Mon–Fri. Shifts are only placed inside these hours.">
          <Select
            value={String(rules.desk_start_slot)}
            onValueChange={(value) => setRules((current) => ({ ...current, desk_start_slot: Number(value) }))}
          >
            <SelectTrigger className="h-8 w-[104px] rounded-[10px] font-mono text-[13px]" aria-label="Desk opens">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOUR_SLOTS.filter((slot) => slot < rules.desk_end_slot).map((slot) => (
                <SelectItem key={slot} value={String(slot)}>
                  {slotTimeLabel(slot)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">–</span>
          <Select
            value={String(rules.desk_end_slot)}
            onValueChange={(value) => setRules((current) => ({ ...current, desk_end_slot: Number(value) }))}
          >
            <SelectTrigger className="h-8 w-[104px] rounded-[10px] font-mono text-[13px]" aria-label="Desk closes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOUR_SLOTS.filter((slot) => slot > rules.desk_start_slot).map((slot) => (
                <SelectItem key={slot} value={String(slot)}>
                  {slotTimeLabel(slot)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </RuleRow>

        <RuleRow
          title="Minimum on desk"
          why="Hours with fewer people show amber in the review counts."
          enabled={rules.min_on_desk.enabled}
          onToggle={(enabled) => setRules((current) => ({ ...current, min_on_desk: { ...current.min_on_desk, enabled } }))}
        >
          <NumberField
            label="Minimum people on desk"
            value={rules.min_on_desk.value}
            onChange={(value) => setRules((current) => ({ ...current, min_on_desk: { ...current.min_on_desk, value } }))}
          />
          <span className="text-xs text-muted-foreground">people</span>
        </RuleRow>

        <RuleRow
          title="A lead every hour"
          why="Leads are placed first so every half hour has one."
          enabled={rules.lead_every_slot.enabled}
          onToggle={(enabled) => setRules((current) => ({ ...current, lead_every_slot: { enabled } }))}
        >
          <span className="rounded-[10px] border border-border bg-muted/40 px-3 py-1.5 font-mono text-[13px] font-semibold">
            ≥ 1 lead
          </span>
        </RuleRow>

        <RuleRow
          title="Shift length"
          why="Avoids orphan half hours and very long stretches."
          enabled={rules.shift_length.enabled}
          onToggle={(enabled) => setRules((current) => ({ ...current, shift_length: { ...current.shift_length, enabled } }))}
        >
          <NumberField
            label="Shortest shift in hours"
            step={0.5}
            value={rules.shift_length.min_hours}
            onChange={(min_hours) =>
              setRules((current) => ({
                ...current,
                shift_length: { ...current.shift_length, min_hours, max_hours: Math.max(min_hours, current.shift_length.max_hours) },
              }))
            }
          />
          <span className="text-muted-foreground">–</span>
          <NumberField
            label="Longest shift in hours"
            step={0.5}
            value={rules.shift_length.max_hours}
            onChange={(max_hours) =>
              setRules((current) => ({
                ...current,
                shift_length: { ...current.shift_length, max_hours: Math.max(max_hours, current.shift_length.min_hours) },
              }))
            }
          />
          <span className="text-xs text-muted-foreground">h</span>
        </RuleRow>

        <RuleRow
          title="Stay inside requested hours"
          why="Never schedules more than someone's maximum from the form."
          enabled={rules.within_requested.enabled}
          onToggle={(enabled) => setRules((current) => ({ ...current, within_requested: { enabled } }))}
        >
          <span className="rounded-[10px] border border-border bg-muted/40 px-3 py-1.5 font-mono text-[13px] font-semibold">
            min – max
          </span>
        </RuleRow>

        <RuleRow
          title="Weekly hour budget"
          why="Stops adding hours once the desk total reaches this."
          enabled={rules.weekly_budget.enabled}
          onToggle={(enabled) => setRules((current) => ({ ...current, weekly_budget: { ...current.weekly_budget, enabled } }))}
        >
          <NumberField
            label="Weekly hour budget"
            value={rules.weekly_budget.hours}
            onChange={(hours) => setRules((current) => ({ ...current, weekly_budget: { ...current.weekly_budget, hours } }))}
          />
          <span className="text-xs text-muted-foreground">h</span>
        </RuleRow>

        <RuleRow
          title="Trainees with a lead"
          why="Flags training hours that don't overlap a lead in review."
          enabled={rules.trainee_with_lead.enabled}
          onToggle={(enabled) => setRules((current) => ({ ...current, trainee_with_lead: { enabled } }))}
        />
      </Panel>

      <div className="flex flex-col gap-3.5">
        <Panel className="overflow-hidden">
          <div className="flex flex-col gap-0.5 border-b border-border/60 px-5 py-4">
            <span className="text-[15px] font-bold">From the notes column</span>
            <span className="text-xs text-muted-foreground">
              {withNotes.length > 0
                ? `${withNotes.length} people left notes. Adjust their hours here if a note changes them.`
                : "Nobody left notes."}
            </span>
          </div>
          <div className="flex max-h-[560px] flex-col overflow-y-auto">
            {withNotes.map((person) => (
              <div key={person.student_assistant_id} className="flex flex-col gap-1.5 border-b border-border/60 px-5 py-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold">{nameOf(person.student_assistant_id)}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="number"
                      min={0}
                      aria-label="Minimum hours"
                      value={person.min_hours ?? ""}
                      onChange={(event) =>
                        updatePerson(person.student_assistant_id, {
                          min_hours: event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                      className="h-7 w-12 rounded-lg border border-border bg-card px-1.5 font-mono text-xs"
                    />
                    –
                    <input
                      type="number"
                      min={0}
                      aria-label="Maximum hours"
                      value={person.max_hours ?? ""}
                      onChange={(event) =>
                        updatePerson(person.student_assistant_id, {
                          max_hours: event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                      className="h-7 w-12 rounded-lg border border-border bg-card px-1.5 font-mono text-xs"
                    />
                    h
                  </span>
                </div>
                {person.notes.trim() ? (
                  <span className="text-xs leading-[1.4] text-muted-foreground italic">“{person.notes.trim()}”</span>
                ) : null}
                {person.import_warnings.map((warning) => (
                  <span key={warning} className="text-xs leading-[1.4] text-amber-700 dark:text-amber-300">
                    Unread from the form · {warning}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Panel>

        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => goTo(1)} className="text-[13px] font-semibold text-accent hover:underline">
            Back
          </button>
          <div className="flex items-center gap-2">
            {hasShifts ? (
              <button
                type="button"
                onClick={() => goTo(3)}
                className="h-10 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-muted"
              >
                Keep current draft
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy === "generate" || scheduled.length === 0}
              onClick={() => (hasShifts ? setConfirmOpen(true) : void generate())}
              className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Sparkles className="size-[15px]" />
              {busy === "generate" ? "Generating..." : hasShifts ? "Regenerate draft" : "Generate draft"}
            </button>
          </div>
        </div>
        <span className="text-right text-xs text-muted-foreground">
          {scheduled.length} of {people.length} people have availability · requested{" "}
          {people.reduce((sum, person) => sum + (person.min_hours ?? 0), 0)}–
          {people.reduce((sum, person) => sum + (person.max_hours ?? 0), 0)}h a week in total
        </span>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate the draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces every shift in the draft, including ones you painted by hand. Published
              schedules don&apos;t change until you publish again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void generate()}>Regenerate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
