"use client"

import { Fragment, useCallback, useMemo, useRef, useState } from "react"
import { Clock } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { GRID_START_HOUR } from "@/components/admin/schedules/schedule-types"
import { timeToMinutes } from "@/components/admin/schedules/schedule-utils"
import { countWorkingDuringHour } from "@/lib/shifts/dashboard-stats"
import {
  formatActualShift,
  formatStartTimeHeader,
  formatTimeRange,
  normalizeTimeKey,
} from "@/lib/format-time"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import { WorkModeBadge } from "@/components/admin/work-mode-badge"
import {
  formatShiftName,
  formatShiftStatusLabel,
  getShiftInitials,
  getShiftStatusBadgeClassName,
  getTodayDay,
  type TodayShift,
} from "@/lib/shifts/today-shifts"

type LocationFilter = "all" | "in-person" | "remote"

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

export function ShiftsTable() {
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all")
  const { shifts, isLoading, error, refetch } = useTodayShiftList({
    includeRemote: true,
  })
  const filteredShifts = useMemo(
    () => filterShiftsByLocation(shifts, locationFilter),
    [shifts, locationFilter],
  )
  const shiftGroups = groupShiftsByStartTime(filteredShifts)
  const groupRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const currentGroupIndex = findCurrentGroupIndex(shiftGroups)

  const scrollToNow = useCallback(() => {
    const group = shiftGroups[currentGroupIndex]
    if (!group) return

    groupRefs.current[group.startTime]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }, [shiftGroups, currentGroupIndex])

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
            All Shifts Today
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-sm text-muted-foreground">Loading shifts...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
            All Shifts Today
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-destructive">Error loading shifts: {error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (shiftGroups.length === 0) {
    const todayDay = getTodayDay()
    const isWeekend = !todayDay
    const hasShiftsButFilteredOut =
      shifts.length > 0 && locationFilter !== "all"

    return (
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
            All Shifts Today
          </CardTitle>
          <LocationFilterToggle
            value={locationFilter}
            onValueChange={setLocationFilter}
          />
        </CardHeader>
        <CardContent className="px-6 py-6">
          <div className="flex flex-col items-center justify-center py-8">
            {hasShiftsButFilteredOut ? (
              <p className="text-sm text-muted-foreground">
                No {locationFilter === "in-person" ? "in-person" : "remote"} shifts
                scheduled for today.
              </p>
            ) : isWeekend ? (
              <p className="text-sm text-muted-foreground">No shifts scheduled for weekends.</p>
            ) : (
              <p className="text-sm text-muted-foreground">No shifts scheduled for today.</p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const COLUMN_COUNT = 6

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
            All Shifts Today
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Grouped by clock-in hour. Remote staff are expected to work but do not clock in here.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <LocationFilterToggle
            value={locationFilter}
            onValueChange={setLocationFilter}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={scrollToNow}
            className="uppercase tracking-wider text-xs"
          >
            <Clock className="h-3.5 w-3.5" />
            Go to Now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Name
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Role
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Location
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Expected Shift
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                Actual Shift
              </TableHead>
              <TableHead className="text-muted-foreground uppercase tracking-wider text-xs text-right">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shiftGroups.map((group, groupIndex) => {
              const scheduledCount = group.shifts.length
              const hour = Number.parseInt(group.startTime.split(":")[0] ?? "", 10)
              const onShiftCount = Number.isNaN(hour)
                ? 0
                : countWorkingDuringHour(filteredShifts, hour)

              return (
              <Fragment key={group.startTime}>
                <TableRow
                  ref={(element) => {
                    groupRefs.current[group.startTime] = element
                  }}
                  className={cn(
                    "border-border hover:bg-transparent scroll-mt-24 bg-muted/25",
                    groupIndex > 0 && "border-t-2",
                  )}
                >
                  <TableCell
                    colSpan={COLUMN_COUNT}
                    className={cn("py-4", groupIndex > 0 && "pt-8")}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold uppercase tracking-wide text-foreground whitespace-nowrap">
                        {formatStartTimeHeader(group.startTime)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="rounded-sm px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider shadow-none"
                        >
                          {scheduledCount} expected
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-sm px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider shadow-none border-accent/30 text-accent"
                        >
                          {onShiftCount} on shift
                        </Badge>
                      </div>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  </TableCell>
                </TableRow>
                {group.shifts.map((shift, shiftIndex) => (
                  <TableRow
                    key={`${shift.scheduleBlockId}-${shift.studentAssistantId}`}
                    className={cn(
                      "border-border",
                      shiftIndex === group.shifts.length - 1 && groupIndex < shiftGroups.length - 1 && "border-b-0",
                    )}
                  >
                    <TableCell className="font-medium text-card-foreground">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-secondary text-xs font-bold text-secondary-foreground">
                          {getShiftInitials(shift)}
                        </div>
                        {formatShiftName(shift)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {shift.role}
                    </TableCell>
                    <TableCell>
                      <WorkModeBadge mode={shift.isRemote ? "remote" : "in-person"} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTimeRange(shift.startTime, shift.endTime)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {shift.isRemote && !shift.clockInActual ? (
                        <span className="text-muted-foreground">Not required</span>
                      ) : (
                        formatActualShift(shift.clockInActual, shift.clockOutActual)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          shift.status === "incoming" || shift.status === "expected"
                            ? "outline"
                            : "secondary"
                        }
                        className={getShiftStatusBadgeClassName(shift.status)}
                      >
                        {formatShiftStatusLabel(shift.status, {
                          isRemote: shift.isRemote,
                        })}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function LocationFilterToggle({
  value,
  onValueChange,
}: {
  value: LocationFilter
  onValueChange: (value: LocationFilter) => void
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as LocationFilter)
      }}
      variant="outline"
      size="sm"
      className="justify-end"
    >
      <ToggleGroupItem value="all" className="text-xs uppercase tracking-wider">
        All
      </ToggleGroupItem>
      <ToggleGroupItem value="in-person" className="text-xs uppercase tracking-wider">
        In person
      </ToggleGroupItem>
      <ToggleGroupItem value="remote" className="text-xs uppercase tracking-wider">
        Remote
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

function findCurrentGroupIndex(
  groups: { startTime: string }[],
  now: Date = new Date(),
): number {
  if (groups.length === 0) return -1

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  let bestIndex = 0

  for (let i = 0; i < groups.length; i++) {
    const groupMinutes = timeToMinutes(groups[i].startTime)
    if (Number.isNaN(groupMinutes)) continue

    if (groupMinutes <= nowMinutes) {
      bestIndex = i
    } else {
      break
    }
  }

  return bestIndex
}

function groupShiftsByStartTime(
  shifts: TodayShift[],
): { startTime: string; shifts: TodayShift[] }[] {
  const gridStartMinutes = GRID_START_HOUR * 60

  const sorted = [...shifts]
    .filter((shift) => timeToMinutes(shift.startTime) >= gridStartMinutes)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

  const groups = new Map<string, TodayShift[]>()
  for (const shift of sorted) {
    const startTimeKey = normalizeTimeKey(shift.startTime)
    const group = groups.get(startTimeKey) ?? []
    group.push(shift)
    groups.set(startTimeKey, group)
  }

  return Array.from(groups.entries()).map(([startTime, groupShifts]) => ({
    startTime,
    shifts: [...groupShifts].sort((a, b) =>
      a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" }),
    ),
  }))
}
