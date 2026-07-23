"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { HourlyStaffingDateNav } from "@/components/admin/hourly-staffing/hourly-staffing-date-nav"
import { HourlyStaffingKpis } from "@/components/admin/hourly-staffing/hourly-staffing-kpis"
import { HourlyStaffingTimeline } from "@/components/admin/hourly-staffing/hourly-staffing-timeline"
import { SlackScheduleCard } from "@/components/admin/hourly-staffing/slack-schedule-card"
import { useShiftsForDate } from "@/hooks/use-today-shifts"
import { termsApi } from "@/lib/api/terms"
import { queryKeys } from "@/lib/query-keys"
import { buildHourlyStaffingView } from "@/lib/shifts/hourly-staffing"
import {
  addOrgDateDays,
  formatOrgDateString,
  formatWeekdayLabel,
} from "@/lib/shifts/hourly-staffing-dates"
import type { TodayShift } from "@/lib/shifts/today-shifts"

type LocationFilter = "all" | "in-person" | "remote"

const NOW_TICK_MS = 30_000

function filterShiftsByLocation(
  shifts: TodayShift[],
  locationFilter: LocationFilter,
): TodayShift[] {
  if (locationFilter === "all") return shifts
  if (locationFilter === "in-person") {
    return shifts.filter((shift) => !shift.isRemote)
  }
  return shifts.filter((shift) => shift.isRemote)
}

export function HourlyStaffingManager() {
  const [date, setDate] = useState(() => formatOrgDateString())
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all")
  const [now, setNow] = useState(() => new Date())

  const { shifts, isLoading, error, isToday } = useShiftsForDate({
    date,
    includeRemote: true,
  })

  useEffect(() => {
    if (!isToday) return
    const id = window.setInterval(() => setNow(new Date()), NOW_TICK_MS)
    return () => window.clearInterval(id)
  }, [isToday])

  useEffect(() => {
    setNow(new Date())
  }, [date])

  const { data: terms = [] } = useQuery({
    queryKey: queryKeys.terms.all,
    queryFn: termsApi.list,
  })

  const activeTerm = terms.find((term) => term.is_active)
  const remoteShiftsAllowed = activeTerm?.remote_shifts_allowed ?? false

  const filteredShifts = useMemo(
    () => filterShiftsByLocation(shifts, locationFilter),
    [shifts, locationFilter],
  )

  const view = useMemo(
    () => buildHourlyStaffingView(filteredShifts, date, { now }),
    [filteredShifts, date, now],
  )

  const dayKind = isToday
    ? "today"
    : date < formatOrgDateString(now)
      ? "past"
      : "future"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hourly Staffing</h1>
          <p className="text-sm text-muted-foreground">
            Who&apos;s scheduled and working each hour — {formatWeekdayLabel(date)}
          </p>
        </div>
        <HourlyStaffingDateNav
          date={date}
          onPrev={() => setDate((current) => addOrgDateDays(current, -1))}
          onNext={() => setDate((current) => addOrgDateDays(current, 1))}
          onToday={() => setDate(formatOrgDateString())}
        />
      </div>

      <HourlyStaffingKpis
        kpis={view.kpis}
        dayKind={dayKind}
        isLoading={isLoading}
      />

      {error ? (
        <Card className="border-border bg-card">
          <CardContent className="flex h-48 items-center justify-center text-sm text-destructive">
            Failed to load staffing data
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle>Who&apos;s working, by hour</CardTitle>
                <CardDescription>
                  Scheduled vs currently working, 8 AM – 4 PM
                </CardDescription>
              </div>
              {remoteShiftsAllowed ? (
                <ToggleGroup
                  type="single"
                  value={locationFilter}
                  onValueChange={(next) => {
                    if (next) setLocationFilter(next as LocationFilter)
                  }}
                  variant="outline"
                  size="sm"
                  className="shrink-0 justify-end"
                >
                  <ToggleGroupItem
                    value="all"
                    className="text-xs uppercase tracking-wider"
                  >
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="in-person"
                    className="text-xs uppercase tracking-wider"
                  >
                    In person
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="remote"
                    className="text-xs uppercase tracking-wider"
                  >
                    Remote
                  </ToggleGroupItem>
                </ToggleGroup>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm border border-dashed border-accent/50 bg-accent/15" />
                  Scheduled
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-accent" />
                  {isToday ? "Working now" : "Attended"}
                </span>
              </div>

              {isLoading ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Loading timeline...
                </div>
              ) : view.isWeekend && view.timelineRows.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  No shifts scheduled for weekends
                </div>
              ) : (
                <HourlyStaffingTimeline
                  rows={view.timelineRows}
                  axisTicks={view.axisTicks}
                  nowMarker={view.nowMarker}
                />
              )}
            </CardContent>
          </Card>

          <SlackScheduleCard
            slackText={view.slackText}
            slackCount={view.slackCount}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  )
}
