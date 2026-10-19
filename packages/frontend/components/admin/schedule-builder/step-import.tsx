"use client"

import { useRef, useState } from "react"
import { ArrowRight, FileSpreadsheet, Upload } from "lucide-react"

import { AvailabilityPainter } from "@/components/admin/schedule-builder/availability-painter"
import { Panel, StatCard } from "@/components/admin/schedule-builder/builder-ui"
import type { BuilderContext } from "@/components/admin/schedule-builder/schedule-builder"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  AvailabilityColumn,
  DraftPerson,
  PersonGroup,
  UnmatchedResponse,
} from "@/lib/api/schedule-drafts"
import { GROUP_LABEL, GROUP_ORDER, availableHours, hoursLabel } from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

type Source = "forms" | "manual"

const FIELD_LABEL: Record<string, string> = {
  email: "Work email (matches the roster)",
  name: "Name (fallback match)",
  monday: "Monday availability",
  tuesday: "Tuesday availability",
  wednesday: "Wednesday availability",
  thursday: "Thursday availability",
  friday: "Friday availability",
  min_hours: "Minimum hours per week",
  max_hours: "Maximum hours per week",
  ideal_hours: "Ideal hours per week",
  notes: "Notes",
}

const NUMBER_INPUT =
  "h-9 w-[70px] rounded-[10px] border border-border bg-card px-2.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

function parseHoursInput(value: string): number | null {
  if (value.trim() === "") return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function StepImport(context: Readonly<BuilderContext>) {
  const { draft, people, nameOf, edit, log, goTo, runImport, busy, students } = context
  const [source, setSource] = useState<Source>("forms")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [columns, setColumns] = useState<AvailabilityColumn[] | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const responded = people.filter((person) => person.responded)
  const missing = people.filter(
    (person) => !person.responded && students.get(person.student_assistant_id)?.is_active,
  )
  const totalAvailable = people.reduce((sum, person) => sum + availableHours(person), 0)
  const withNotes = people.filter((person) => person.notes.trim() || person.import_warnings.length > 0)
  const selected = people.find((person) => person.student_assistant_id === selectedId) ?? null

  const updatePerson = (studentId: number, update: (person: DraftPerson) => DraftPerson) =>
    edit((current) => ({
      ...current,
      people: current.people.map((person) =>
        person.student_assistant_id === studentId ? update(person) : person,
      ),
    }))

  const upload = async (file: File) => {
    const result = await runImport(file)
    if (result) setColumns(result.columns)
  }

  const matchResponse = (response: UnmatchedResponse, studentId: number) => {
    edit((current) => ({
      ...current,
      unmatched: current.unmatched.filter((row) => row.key !== response.key),
      people: current.people.map((person) =>
        person.student_assistant_id === studentId
          ? {
              ...person,
              responded: true,
              min_hours: response.min_hours,
              ideal_hours: response.ideal_hours,
              max_hours: response.max_hours,
              notes: response.notes,
              availability: response.availability,
              import_warnings: response.import_warnings,
            }
          : person,
      ),
    }))
    log(`Matched form response "${response.name}" to ${nameOf(studentId)}`)
  }

  const dismissResponse = (response: UnmatchedResponse) => {
    edit((current) => ({ ...current, unmatched: current.unmatched.filter((row) => row.key !== response.key) }))
    log(`Skipped form response "${response.name}"`)
  }

  const enterByHand = (studentId: number) => {
    setSource("manual")
    setSelectedId(studentId)
  }

  const manualOrder = GROUP_ORDER.flatMap((group) => people.filter((person) => person.group === group))
  const nextPerson = () => {
    const index = manualOrder.findIndex((person) => person.student_assistant_id === selectedId)
    const next = manualOrder[index + 1] ?? manualOrder[0]
    setSelectedId(next?.student_assistant_id ?? null)
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold">Where availability comes from</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["forms", "Forms export", "Upload the .csv or .xlsx your availability form saves responses to."],
                ["manual", "Enter by hand", "Paint each person's hours. Good for late responses and new hires."],
              ] as const
            ).map(([value, label, sub]) => (
              <button
                key={value}
                type="button"
                aria-pressed={source === value}
                onClick={() => setSource(value)}
                className={cn(
                  "flex flex-col gap-1 rounded-2xl border bg-card px-3.5 py-3 text-left",
                  source === value ? "border-accent ring-1 ring-accent" : "border-border hover:bg-muted/50",
                )}
              >
                <span className="text-sm font-bold">{label}</span>
                <span className="text-xs leading-[1.4] text-muted-foreground">{sub}</span>
              </button>
            ))}
          </div>
        </div>

        {source === "forms" ? (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                const file = event.dataTransfer.files[0]
                if (file) void upload(file)
              }}
              disabled={busy === "import"}
              className={cn(
                "flex flex-col items-center gap-2.5 rounded-[20px] border-2 border-dashed bg-card px-6 py-7 text-center transition-colors",
                dragging ? "border-accent bg-accent/5" : "border-accent/30 hover:border-accent/60",
              )}
            >
              <span className="flex size-12 items-center justify-center rounded-[14px] bg-accent/10 text-accent">
                <Upload className="size-6" />
              </span>
              <span className="text-[15px] font-bold">
                {busy === "import" ? "Reading responses..." : draft.source_filename ? "Upload a newer export" : "Upload the availability responses"}
              </span>
              <span className="text-[13px] leading-[1.45] text-muted-foreground">
                Drop a Microsoft Forms .csv or .xlsx export. Re-uploading updates everyone&apos;s
                availability and keeps the shifts you&apos;ve already reviewed.
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) void upload(file)
              }}
            />

            {draft.source_filename ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
                <span className="flex size-9 items-center justify-center rounded-[10px] bg-accent/15 text-accent">
                  <FileSpreadsheet className="size-[18px]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold">{draft.source_filename}</span>
                  <span className="text-xs text-muted-foreground">
                    {responded.length} matched · {draft.unmatched.length} to match
                  </span>
                </span>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">Imported</span>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Responded" value={responded.length} sub={`of ${people.length} on the roster`} />
              <StatCard
                label="Groups"
                value={GROUP_ORDER.map((group) => people.filter((person) => person.group === group).length).join(" · ")}
                sub="leads · students · trainees"
              />
              <StatCard label="Available hours" value={hoursLabel(totalAvailable)} sub="across everyone" />
              <StatCard label="Notes to read" value={withNotes.length} sub="shown in Guidelines" />
            </div>

            {missing.length > 0 ? (
              <Panel className="flex flex-col gap-2 px-3.5 py-3">
                <span className="text-[13px] font-bold">
                  {missing.length} haven&apos;t filled out the form
                </span>
                <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">
                  {missing.map((person) => (
                    <div key={person.student_assistant_id} className="flex items-center gap-2.5">
                      <span className="flex-1 truncate text-[13px] font-semibold">
                        {nameOf(person.student_assistant_id)}
                      </span>
                      {availableHours(person) > 0 ? (
                        <span className="text-[11px] font-bold text-accent">Entered by hand</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => enterByHand(person.student_assistant_id)}
                        className="h-7 rounded-full border border-accent/30 bg-accent/10 px-3 text-xs font-bold text-accent hover:bg-accent/20"
                      >
                        {availableHours(person) > 0 ? "Edit" : "Enter by hand"}
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}
          </>
        ) : (
          <Panel className="flex max-h-[640px] flex-col overflow-y-auto p-2.5">
            {GROUP_ORDER.map((group) => {
              const members = people.filter((person) => person.group === group)
              if (members.length === 0) return null
              return (
                <div key={group} className="flex flex-col">
                  <span className="px-2 pt-2 pb-0.5 text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                    {GROUP_LABEL[group]}
                  </span>
                  {members.map((person) => {
                    const on = person.student_assistant_id === selected?.student_assistant_id
                    const hours = availableHours(person)
                    return (
                      <button
                        key={person.student_assistant_id}
                        type="button"
                        onClick={() => setSelectedId(person.student_assistant_id)}
                        className={cn(
                          "flex h-[34px] items-center gap-2.5 rounded-[9px] px-2 text-left",
                          on ? "bg-accent/10" : "hover:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            hours > 0 ? "bg-[var(--status-online)]" : "bg-border",
                          )}
                        />
                        <span className={cn("flex-1 truncate text-[13px] font-semibold", on && "text-accent")}>
                          {nameOf(person.student_assistant_id)}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {hours > 0 ? hoursLabel(hours) : "—"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </Panel>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        {source === "manual" ? (
          selected ? (
            <PersonEditor
              key={selected.student_assistant_id}
              person={selected}
              name={nameOf(selected.student_assistant_id)}
              context={context}
              onChange={(update) => updatePerson(selected.student_assistant_id, update)}
              onNext={nextPerson}
            />
          ) : (
            <Panel className="flex flex-col items-center gap-1 px-6 py-14 text-center">
              <span className="text-sm font-semibold">Pick someone on the left</span>
              <span className="text-[13px] text-muted-foreground">
                Paint their availability, requested hours and any notes.
              </span>
            </Panel>
          )
        ) : (
          <>
            <Panel className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-[18px] py-3.5">
                <span className="text-[15px] font-bold">What we read</span>
                <span className="text-xs text-muted-foreground">
                  Columns are found by their question text
                </span>
              </div>
              {columns ? (
                columns.map((column) => (
                  <div
                    key={column.field}
                    className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)_70px] items-center gap-3 border-b border-border/60 px-[18px] py-2.5 last:border-0"
                  >
                    <span className="truncate font-mono text-xs text-muted-foreground" title={column.header}>
                      {column.header}
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{FIELD_LABEL[column.field] ?? column.field}</span>
                    <span className="justify-self-end rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                      {column.filled}
                    </span>
                  </div>
                ))
              ) : (
                <p className="px-[18px] py-6 text-[13px] text-muted-foreground">
                  {draft.source_filename
                    ? `Last import: ${draft.source_filename}. Upload again to see which columns were read.`
                    : "Upload an export to see which columns were read and how many responses filled each one."}
                </p>
              )}
            </Panel>

            {draft.unmatched.length > 0 ? (
              <Panel className="overflow-hidden border-amber-500/40">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500/15 px-[18px] py-3.5 text-amber-800 dark:text-amber-200">
                  <span className="text-[15px] font-bold">
                    {draft.unmatched.length} {draft.unmatched.length === 1 ? "response doesn't" : "responses don't"} match the roster
                  </span>
                  <span className="text-xs">Match by work email so shifts reach the right student</span>
                </div>
                {draft.unmatched.map((response) => (
                  <UnmatchedRow
                    key={response.key}
                    response={response}
                    candidates={people.filter((person) => !person.responded)}
                    nameOf={nameOf}
                    onMatch={(studentId) => matchResponse(response, studentId)}
                    onDismiss={() => dismissResponse(response)}
                  />
                ))}
              </Panel>
            ) : null}
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3.5">
          <span className="text-xs text-muted-foreground">
            {missing.length > 0
              ? `${missing.length} without availability will be left off the draft`
              : "Everyone has availability"}
          </span>
          <button
            type="button"
            onClick={() => goTo(2)}
            className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Continue to guidelines
            <ArrowRight className="size-[15px]" strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>
  )
}

function UnmatchedRow({
  response,
  candidates,
  nameOf,
  onMatch,
  onDismiss,
}: Readonly<{
  response: UnmatchedResponse
  candidates: DraftPerson[]
  nameOf: (_id: number) => string
  onMatch: (_studentId: number) => void
  onDismiss: () => void
}>) {
  return (
    <div className="grid items-center gap-3 border-t border-amber-500/20 px-[18px] py-2.5 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold">{response.name || "No name"}</span>
        <span className="truncate text-xs text-muted-foreground">{response.email || "No email"} · not on the roster</span>
      </span>
      <Select onValueChange={(value) => onMatch(Number(value))}>
        <SelectTrigger className="h-[30px] w-full rounded-full bg-card text-xs">
          <SelectValue placeholder="Match to a student" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((person) => (
            <SelectItem key={person.student_assistant_id} value={String(person.student_assistant_id)}>
              {nameOf(person.student_assistant_id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={onDismiss}
        className="h-[30px] justify-self-end rounded-full border border-border bg-card px-3 text-xs font-bold hover:bg-muted"
      >
        Skip
      </button>
    </div>
  )
}

function PersonEditor({
  person,
  name,
  context,
  onChange,
  onNext,
}: Readonly<{
  person: DraftPerson
  name: string
  context: BuilderContext
  onChange: (_update: (_person: DraftPerson) => DraftPerson) => void
  onNext: () => void
}>) {
  const { draft, log } = context
  const hours = availableHours(person)
  return (
    <Panel className="flex flex-col gap-3 px-[18px] py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[17px] font-bold">{name}</span>
          <span className="text-xs text-muted-foreground">
            <b className="text-foreground">{hoursLabel(hours)} available</b> each week
            {person.responded ? " · from the form" : ""}
          </span>
        </div>
        <Select
          value={person.group}
          onValueChange={(value) => onChange((current) => ({ ...current, group: value as PersonGroup }))}
        >
          <SelectTrigger className="h-8 w-[130px] rounded-full bg-card text-xs font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="trainee">Trainee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {person.import_warnings.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <span className="font-bold">Couldn&apos;t read from the form, so paint these by hand:</span>
          {person.import_warnings.map((warning) => (
            <span key={warning}>“{warning}”</span>
          ))}
        </div>
      ) : null}

      <AvailabilityPainter
        person={person}
        rules={draft.rules}
        onChange={onChange}
        onStrokeEnd={() => log(`Edited ${name}'s availability`)}
      />

      <div className="grid gap-3.5 pt-1 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold">Hours they want per week</span>
          <div className="flex items-center gap-1.5">
            {(
              [
                ["min_hours", "Min"],
                ["ideal_hours", "Ideal"],
                ["max_hours", "Max"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="flex flex-col gap-0.5">
                <input
                  type="number"
                  min={0}
                  aria-label={`${label} hours`}
                  value={person[field] ?? ""}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, [field]: parseHoursInput(event.target.value) }))
                  }
                  className={NUMBER_INPUT}
                />
                <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold">
            Notes <span className="font-medium text-muted-foreground">(optional)</span>
          </span>
          <input
            value={person.notes}
            onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))}
            placeholder="e.g. Prefers mornings, no Fridays after midterms"
            className="h-9 rounded-[10px] border border-border bg-card px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onNext}
          className="h-[38px] rounded-full bg-primary px-[18px] text-[13px] font-bold text-primary-foreground hover:bg-primary/90"
        >
          Next person
        </button>
      </div>
    </Panel>
  )
}
