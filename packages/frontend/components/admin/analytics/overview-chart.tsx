"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import type { DailyTrendPoint } from "@/lib/api/analytics"
import {
  Card,
  CardAction,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

const chartConfig = {
  punctual: {
    label: "Punctual",
    color: "var(--accent)",
  },
  late: {
    label: "Late",
    color: "var(--chart-4)",
  },
  absent: {
    label: "Absent",
    color: "var(--destructive)",
  },
} satisfies ChartConfig

interface OverviewChartProps {
  data: DailyTrendPoint[]
  isLoading?: boolean
  error?: Error | null
}

export function OverviewChart({
  data,
  isLoading = false,
  error = null,
}: OverviewChartProps) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("30d")

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d")
  }, [isMobile])

  const filteredData = React.useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    return data.slice(-days)
  }, [data, timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Attendance Trend</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Daily clock-in breakdown — punctual vs late vs absent
          </span>
          <span className="@[540px]/card:hidden">Clock-in breakdown</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[540px]/card:flex"
          >
            <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
            <ToggleGroupItem value="90d">90 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-32 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[540px]/card:hidden"
              size="sm"
              aria-label="Select time range"
            >
              <SelectValue placeholder="30 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="7d" className="rounded-lg">7 days</SelectItem>
              <SelectItem value="30d" className="rounded-lg">30 days</SelectItem>
              <SelectItem value="90d" className="rounded-lg">90 days</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            Loading chart...
          </div>
        ) : error ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-destructive">
            Failed to load chart data
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No shift data for this term yet
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillPunctual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-punctual)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-punctual)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillLate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-late)" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="var(--color-late)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillAbsent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-absent)" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="var(--color-absent)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) =>
                  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="punctual"
                type="monotone"
                fill="url(#fillPunctual)"
                stroke="var(--color-punctual)"
                strokeWidth={2}
              />
              <Area
                dataKey="late"
                type="monotone"
                fill="url(#fillLate)"
                stroke="var(--color-late)"
                strokeWidth={2}
              />
              <Area
                dataKey="absent"
                type="monotone"
                fill="url(#fillAbsent)"
                stroke="var(--color-absent)"
                strokeWidth={2}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
