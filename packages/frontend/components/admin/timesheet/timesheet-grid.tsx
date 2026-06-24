"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import type { ScheduleBlock } from "@/lib/api/scheduleBlocks"
import type { TimeEntry } from "@/lib/api/time-entries"
import { cn } from "@/lib/utils"
import { TimesheetDayShiftsDialog } from "./timesheet-day-shifts-dialog"

interface TimesheetGridProps {
  year: number
  month: number // 0-11
  hoursData: Record<string, number> // YYYY-MM-DD => hours
  studentId: number
  timeEntries: TimeEntry[]
  scheduleBlocks: ScheduleBlock[]
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function key(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function TimesheetGrid({
  year,
  month,
  hoursData,
  studentId,
  timeEntries,
  scheduleBlocks,
}: Readonly<TimesheetGridProps>) {
  const today = new Date()
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    const grouped: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      grouped.push(cells.slice(i, i + 7))
    }
    return grouped
  }, [year, month])

  const weekTotal = (week: (number | null)[]) =>
    week.reduce<number>((sum, day) => {
      if (day === null) return sum
      return sum + (hoursData[key(year, month, day)] ?? 0)
    }, 0)

  const totalHours = useMemo(
    () =>
      Object.entries(hoursData).reduce((sum, [k, v]) => {
        return k.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
          ? sum + v
          : sum
      }, 0),
    [hoursData, year, month],
  )

  return (
    <>
      <div className="flex flex-col gap-4">
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-0">
            <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
              Click a day to view shifts worked.
            </p>
            <div className="grid grid-cols-[repeat(7,1fr)_minmax(80px,0.8fr)] border-b border-border">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  {wd}
                </div>
              ))}
              <div className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-widest text-accent">
                Total
              </div>
            </div>

            {weeks.map((week, wi) => (
              <div
                key={`week-${year}-${month}-${wi}`}
                className="grid grid-cols-[repeat(7,1fr)_minmax(80px,0.8fr)] border-b border-border last:border-b-0"
              >
                {week.map((day, di) => {
                  if (day === null) {
                    return (
                      <div
                        key={`pad-${wi}-${di}`}
                        className="min-h-[84px] border-r border-border bg-muted/20"
                      />
                    )
                  }
                  const k = key(year, month, day)
                  const value = hoursData[k]
                  const isToday =
                    year === today.getFullYear() &&
                    month === today.getMonth() &&
                    day === today.getDate()
                  const isSelected = selectedDateKey === k

                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelectedDateKey(k)}
                      className={cn(
                        "min-h-[84px] border-r border-border p-2 text-left transition-colors hover:bg-accent/5",
                        isToday && "bg-accent/5",
                        isSelected && "ring-1 ring-inset ring-accent/40 bg-accent/10",
                      )}
                    >
                      <span
                        className={cn(
                          "font-mono text-xs text-muted-foreground",
                          isToday && "text-accent",
                        )}
                      >
                        {String(month + 1).padStart(2, "0")}-
                        {String(day).padStart(2, "0")}
                      </span>
                      {value !== undefined && value > 0 && (
                        <span className="mt-2 block font-mono text-xl font-bold tabular-nums">
                          {value.toFixed(1)}
                        </span>
                      )}
                    </button>
                  )
                })}
                <div className="flex min-h-[84px] items-center justify-center border-border bg-muted/10 p-2">
                  <span className="font-mono text-xl font-bold tabular-nums text-accent">
                    {weekTotal(week).toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex items-baseline justify-between gap-4 px-1">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Total hours
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {totalHours.toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      <TimesheetDayShiftsDialog
        open={selectedDateKey !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDateKey(null)
        }}
        dateKey={selectedDateKey}
        studentId={studentId}
        timeEntries={timeEntries}
        scheduleBlocks={scheduleBlocks}
      />
    </>
  )
}
