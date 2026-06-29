"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { useTodayShiftList } from "@/hooks/use-today-shifts"
import {
  computeHourlyHeadcount,
  hasRemoteShifts,
} from "@/lib/shifts/dashboard-stats"
import { getTodayDay, type TodayShift } from "@/lib/shifts/today-shifts"
import { termsApi } from "@/lib/api/terms"
import { queryKeys } from "@/lib/query-keys"

type LocationFilter = "all" | "in-person" | "remote"

const chartConfig = {
  expected: {
    label: "Scheduled",
    color: "var(--muted-foreground)",
  },
  actual: {
    label: "Working",
    color: "var(--accent)",
  },
} satisfies ChartConfig

const splitChartConfig = {
  expectedInPerson: {
    label: "In person (scheduled)",
    color: "var(--muted-foreground)",
  },
  expectedRemote: {
    label: "Remote (scheduled)",
    color: "hsl(199 65% 58%)",
  },
  actualInPerson: {
    label: "In person (working)",
    color: "var(--accent)",
  },
  actualRemote: {
    label: "Remote (working)",
    color: "hsl(199 89% 48%)",
  },
} satisfies ChartConfig

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

export function HourlyHeadcountChart() {
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all")
  const { shifts, isLoading, error } = useTodayShiftList({ includeRemote: true })
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
  const showWorkModeSplit =
    locationFilter === "all" && hasRemoteShifts(shifts)

  const chartData = computeHourlyHeadcount(filteredShifts, new Date())
  const todayDay = getTodayDay()
  const chartConfigToUse = showWorkModeSplit ? splitChartConfig : chartConfig
  const hasChartData = chartData.some(
    (point) => point.expected > 0 || point.actual > 0,
  )

  let chartContent: React.ReactNode

  if (isLoading) {
    chartContent = (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Loading chart...
      </div>
    )
  } else if (error) {
    chartContent = (
      <div className="flex h-[220px] items-center justify-center text-sm text-destructive">
        Failed to load chart data
      </div>
    )
  } else if (todayDay === null) {
    chartContent = (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No shifts scheduled for weekends
      </div>
    )
  } else if (!hasChartData) {
    chartContent = (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {locationFilter === "remote"
          ? "No remote shifts scheduled for today."
          : locationFilter === "in-person"
            ? "No in-person shifts scheduled for today."
            : "No shifts scheduled for today."}
      </div>
    )
  } else {
    chartContent = (
      <ChartContainer config={chartConfigToUse} className="aspect-auto h-[220px] w-full">
        <BarChart data={chartData} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11 }}
            width={28}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          {showWorkModeSplit ? (
            <>
              <Bar
                dataKey="expectedInPerson"
                stackId="scheduled"
                fill="var(--color-expectedInPerson)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="expectedRemote"
                stackId="scheduled"
                fill="var(--color-expectedRemote)"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="actualInPerson"
                stackId="working"
                fill="var(--color-actualInPerson)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="actualRemote"
                stackId="working"
                fill="var(--color-actualRemote)"
                radius={[3, 3, 0, 0]}
              />
            </>
          ) : (
            <>
              <Bar dataKey="expected" fill="var(--color-expected)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" fill="var(--color-actual)" radius={[3, 3, 0, 0]} />
            </>
          )}
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div className="space-y-1">
          <CardTitle>Hourly Workforce</CardTitle>
          <CardDescription>
            {locationFilter === "remote"
              ? "Scheduled vs working remote headcount (8 AM – 4 PM). Remote staff count as working during their shift without clock-in."
              : showWorkModeSplit
                ? "Scheduled vs working headcount by location (8 AM – 4 PM)."
                : "Scheduled vs working headcount during each hour (8 AM – 4 PM)"}
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
        ) : null}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {chartContent}
      </CardContent>
    </Card>
  )
}
