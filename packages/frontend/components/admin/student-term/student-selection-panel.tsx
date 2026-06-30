"use client"

import { ChevronLeft, Search, Star } from "lucide-react"
import { formatStudentName } from "@/components/admin/mock-students"
import type { RoleFilter } from "@/hooks/use-student-selection"
import type { ScheduleStudent } from "@/lib/api/schedule-mappers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Max scroll height for the student list in sidebar layout. */
export const STUDENT_PICKER_LIST_MAX_HEIGHT = 560

/** Shared split-pane height: list max + header, search, and filters. */
export const STUDENT_RECORDS_SPLIT_HEIGHT = "h-[calc(560px+11rem)]"

/** Side-by-side student picker and main content on large screens. */
export const STUDENT_TERM_PAGE_GRID =
  "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]"

interface StudentSelectionPanelProps {
  disabled?: boolean
  emptyMessage?: string
  layout?: "sidebar" | "stacked"
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** Stretch to fill a fixed-height split pane (student records). */
  fillHeight?: boolean
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  roleFilter: RoleFilter
  onRoleFilterChange: (filter: RoleFilter) => void
  filteredStudents: ScheduleStudent[]
  selectedStudentId: number | null
  onSelectStudent: (student: ScheduleStudent) => void
  showIndicator?: (student: ScheduleStudent) => boolean
  indicatorTitle?: string
}

const ROLE_FILTERS = [
  ["all", "All"],
  ["lead", "Lead"],
  ["assistant", "Assistant"],
] as const

function RoleFilterToggle({
  roleFilter,
  onRoleFilterChange,
  className,
  stretch = false,
}: {
  roleFilter: RoleFilter
  onRoleFilterChange: (filter: RoleFilter) => void
  className?: string
  stretch?: boolean
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border bg-muted/40 p-[3px]",
        className,
      )}
    >
      {ROLE_FILTERS.map(([filter, label]) => (
        <Button
          key={filter}
          type="button"
          size="sm"
          variant={roleFilter === filter ? "default" : "ghost"}
          className={cn(
            "h-7 px-3 text-xs",
            stretch && "flex-1",
            roleFilter !== filter && "text-muted-foreground",
          )}
          onClick={() => onRoleFilterChange(filter)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

function StudentSearchInput({
  searchQuery,
  onSearchQueryChange,
  className,
}: {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        placeholder="Search students..."
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        className="border-border bg-input h-9 w-full pl-9 text-sm"
      />
    </div>
  )
}

function StudentSelectButton({
  student,
  isSelected,
  hasIndicator,
  indicatorTitle,
  onSelect,
  compact = false,
}: {
  student: ScheduleStudent
  isSelected: boolean
  hasIndicator: boolean
  indicatorTitle: string
  onSelect: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border text-left transition-colors",
        compact ? "px-3 py-2" : "rounded-sm px-2 py-2",
        isSelected
          ? "border-accent/30 bg-accent/10"
          : "border-transparent hover:border-border hover:bg-muted/40",
        compact && !isSelected && "border-border/60 bg-background/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{formatStudentName(student)}</p>
          <p className="text-muted-foreground truncate text-[11px]">
            {student.role === "Student Lead" ? "Lead" : "Asst."}
            {student.polycard_id ? ` · ${student.polycard_id}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {student.role === "Student Lead" ? (
            <Star className="size-3 text-yellow-500" />
          ) : null}
          {hasIndicator ? (
            <span
              className="size-2 rounded-full bg-accent ring-2 ring-accent/20"
              title={indicatorTitle}
            />
          ) : null}
        </div>
      </div>
    </button>
  )
}

function StudentList({
  filteredStudents,
  selectedStudentId,
  onSelectStudent,
  showIndicator,
  indicatorTitle,
  compact = false,
  className,
}: {
  filteredStudents: ScheduleStudent[]
  selectedStudentId: number | null
  onSelectStudent: (student: ScheduleStudent) => void
  showIndicator?: (student: ScheduleStudent) => boolean
  indicatorTitle: string
  compact?: boolean
  className?: string
}) {
  if (filteredStudents.length === 0) {
    return (
      <div className="text-muted-foreground py-10 text-center text-sm">
        No students found
      </div>
    )
  }

  return (
    <div className={className}>
      {filteredStudents.map((student) => (
        <StudentSelectButton
          key={student.id}
          student={student}
          isSelected={selectedStudentId === student.id}
          hasIndicator={showIndicator?.(student) ?? false}
          indicatorTitle={indicatorTitle}
          onSelect={() => onSelectStudent(student)}
          compact={compact}
        />
      ))}
    </div>
  )
}

function StackedStudentSelectionPanel({
  disabled,
  emptyMessage,
  searchQuery,
  onSearchQueryChange,
  roleFilter,
  onRoleFilterChange,
  filteredStudents,
  selectedStudentId,
  onSelectStudent,
  showIndicator,
  indicatorTitle,
}: StudentSelectionPanelProps) {
  return (
    <Card className="bg-card border-border min-w-0">
      <CardHeader className="border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <StudentSearchInput
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            className="flex-1"
          />
          <div className="flex flex-wrap items-center gap-3">
            <RoleFilterToggle
              roleFilter={roleFilter}
              onRoleFilterChange={onRoleFilterChange}
            />
            <p className="text-muted-foreground text-xs uppercase tracking-wider">
              {filteredStudents.length} students
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-4 sm:px-6">
        {disabled ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {emptyMessage}
          </div>
        ) : (
          <StudentList
            filteredStudents={filteredStudents}
            selectedStudentId={selectedStudentId}
            onSelectStudent={onSelectStudent}
            showIndicator={showIndicator}
            indicatorTitle={indicatorTitle ?? "Has activity"}
            compact
            className="grid max-h-[220px] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          />
        )}
      </CardContent>
    </Card>
  )
}

function SidebarStudentSelectionPanel({
  disabled,
  emptyMessage,
  onCollapsedChange,
  fillHeight = false,
  searchQuery,
  onSearchQueryChange,
  roleFilter,
  onRoleFilterChange,
  filteredStudents,
  selectedStudentId,
  onSelectStudent,
  showIndicator,
  indicatorTitle,
}: StudentSelectionPanelProps) {
  return (
    <Card
      className={cn(
        "bg-card border-border min-w-0",
        fillHeight ? "flex h-full min-h-0 flex-col" : "h-fit",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3">
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">
          Students
        </CardTitle>
        {onCollapsedChange ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            onClick={() => onCollapsedChange(true)}
            aria-label="Hide student list"
          >
            <ChevronLeft className="size-4" />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(
          "space-y-2.5 px-4 pb-4 pt-0",
          fillHeight && "flex min-h-0 flex-1 flex-col",
        )}
      >
        {disabled ? (
          <div className="text-muted-foreground py-10 text-center text-sm">
            {emptyMessage}
          </div>
        ) : (
          <>
            <StudentSearchInput
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
            />

            <RoleFilterToggle
              roleFilter={roleFilter}
              onRoleFilterChange={onRoleFilterChange}
              className="w-full"
              stretch
            />

            <p className="text-muted-foreground text-[11px] uppercase tracking-wider">
              {filteredStudents.length} students
            </p>

            <StudentList
              filteredStudents={filteredStudents}
              selectedStudentId={selectedStudentId}
              onSelectStudent={onSelectStudent}
              showIndicator={showIndicator}
              indicatorTitle={indicatorTitle ?? "Has activity"}
              className={cn(
                "space-y-0.5 overflow-y-auto pr-0.5",
                fillHeight ? "min-h-0 flex-1" : "max-h-[560px]",
              )}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function StudentSelectionPanel({
  layout = "sidebar",
  ...props
}: Readonly<StudentSelectionPanelProps>) {
  if (layout === "stacked") {
    return <StackedStudentSelectionPanel {...props} layout={layout} />
  }

  return <SidebarStudentSelectionPanel {...props} layout={layout} />
}
