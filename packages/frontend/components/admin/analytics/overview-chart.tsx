"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
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

function generateAttendanceData(days: number) {
  const data = []
  const today = new Date("2026-06-11")
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const onTime = isWeekend ? 0 : Math.floor(Math.random() * 4) + 5
    const late = isWeekend ? 0 : Math.floor(Math.random() * 3)
    data.push({
      date: d.toISOString().split("T")[0],
      onTime,
      late,
    })
  }
  return data
}

const allData = generateAttendanceData(90)

const chartConfig = {
  onTime: {
    label: "On Time",
    color: "var(--accent)",
  },
  late: {
    label: "Late / Absent",
    color: "var(--destructive)",
  },
} satisfies ChartConfig

export function OverviewChart() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("30d")

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d")
  }, [isMobile])

  const filteredData = React.useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    return allData.slice(-days)
  }, [timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Attendance Trend</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Daily clock-in breakdown — on time vs late/absent
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
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillOnTime" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-onTime)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-onTime)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillLate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-late)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-late)" stopOpacity={0.05} />
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
                new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <YAxis hide />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
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
              dataKey="onTime"
              type="monotone"
              fill="url(#fillOnTime)"
              stroke="var(--color-onTime)"
              strokeWidth={2}
            />
            <Area
              dataKey="late"
              type="monotone"
              fill="url(#fillLate)"
              stroke="var(--color-late)"
              strokeWidth={2}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
