"use client"

import Link from "next/link"
import type { StudentLeaderboardEntry } from "@/lib/api/analytics"
import type { StudentAssistant } from "@/lib/api/student-assistants"
import { formatStudentName } from "@/components/admin/mock-students"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface TermLateLeaderboardProps {
  entries: StudentLeaderboardEntry[]
  students: StudentAssistant[]
  isLoading: boolean
}

export function TermLateLeaderboard({
  entries,
  students,
  isLoading,
}: TermLateLeaderboardProps) {
  const studentMap = new Map(students.map((student) => [student.id, student]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most Late Shifts</CardTitle>
        <CardDescription>Top students by late shift count this term</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No late shifts recorded yet</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => {
              const student = studentMap.get(entry.studentAssistantId)
              const name = student
                ? formatStudentName({
                    first_name: student.first_name ?? "",
                    last_name: student.last_name ?? "",
                  })
                : `Student #${entry.studentAssistantId}`

              return (
                <div
                  key={entry.studentAssistantId}
                  className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-muted-foreground w-5 text-xs font-medium">
                      {index + 1}
                    </span>
                    <Link
                      href={`/admin/studentrecords?student=${entry.studentAssistantId}&tab=analytics`}
                      className="truncate text-sm font-medium hover:text-accent"
                    >
                      {name}
                    </Link>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{entry.late}</span> late
                    {entry.absent > 0 ? ` · ${entry.absent} absent` : ""}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
