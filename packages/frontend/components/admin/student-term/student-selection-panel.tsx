"use client"

import { Search, Star } from "lucide-react"
import { formatStudentName } from "@/components/admin/mock-students"
import type { RoleFilter } from "@/hooks/use-student-selection"
import type { ScheduleStudent } from "@/lib/api/schedule-mappers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Fixed-width sidebar so the main content gets most of the horizontal space. */
export const STUDENT_TERM_PAGE_GRID =
  "grid min-h-[620px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]"

interface StudentSelectionPanelProps {
  disabled?: boolean
  emptyMessage?: string
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

export function StudentSelectionPanel({
  disabled = false,
  emptyMessage = "Select a term to continue.",
  searchQuery,
  onSearchQueryChange,
  roleFilter,
  onRoleFilterChange,
  filteredStudents,
  selectedStudentId,
  onSelectStudent,
  showIndicator,
  indicatorTitle = "Has activity",
}: Readonly<StudentSelectionPanelProps>) {
  return (
    <Card className="bg-card border-border h-fit min-w-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">
          Students
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 px-4 pb-4 pt-0">
        {disabled ? (
          <div className="text-muted-foreground py-10 text-center text-sm">
            {emptyMessage}
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                className="border-border bg-input h-8 pl-9 text-sm"
              />
            </div>

            <div className="inline-flex w-full rounded-lg border border-border bg-muted/40 p-[3px]">
              {(
                [
                  ["all", "All"],
                  ["lead", "Lead"],
                  ["assistant", "Assistant"],
                ] as const
              ).map(([filter, label]) => (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={roleFilter === filter ? "default" : "ghost"}
                  className={cn(
                    "h-7 flex-1 px-2 text-xs",
                    roleFilter !== filter && "text-muted-foreground",
                  )}
                  onClick={() => onRoleFilterChange(filter)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <p className="text-muted-foreground text-[11px] uppercase tracking-wider">
              {filteredStudents.length} students
            </p>

            <div className="max-h-[560px] space-y-0.5 overflow-y-auto pr-0.5">
              {filteredStudents.length === 0 ? (
                <div className="text-muted-foreground py-10 text-center text-sm">
                  No students found
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedStudentId === student.id
                  const hasIndicator = showIndicator?.(student) ?? false

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => onSelectStudent(student)}
                      className={cn(
                        "w-full rounded-sm border px-2 py-2 text-left transition-colors",
                        isSelected
                          ? "border-accent/30 bg-accent/10"
                          : "border-transparent hover:border-border hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {formatStudentName(student)}
                          </p>
                          <p className="text-muted-foreground truncate text-[11px]">
                            {student.role === "Student Lead" ? "Lead" : "Asst."}
                            {student.polycard_id
                              ? ` · ${student.polycard_id}`
                              : ""}
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
                })
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
