"use client"

import type React from "react"
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
import type { WeekdayPattern } from "@/lib/api/analytics"

const chartConfig = {
  late: {
    label: "Late",
    color: "var(--chart-4)",
  },
  absent: {
    label: "Absent",
    color: "var(--destructive)",
  },
} satisfies ChartConfig

const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
}

interface TermWeekdayChartProps {
  data: WeekdayPattern[]
  isLoading: boolean
  error: Error | null
}

export function TermWeekdayChart({ data, isLoading, error }: TermWeekdayChartProps) {
  const chartData = data.map((pattern) => ({
    ...pattern,
    label: DAY_LABELS[pattern.day] ?? pattern.day,
  }))

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
  } else if (chartData.every((point) => point.total === 0)) {
    chartContent = (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No weekday shift data yet
      </div>
    )
  } else {
    chartContent = (
      <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
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
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="late" stackId="issues" fill="var(--color-late)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="absent" stackId="issues" fill="var(--color-absent)" radius={[4, 4, 0, 0]} />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    )
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Issues by Weekday</CardTitle>
        <CardDescription>Late and absent shifts grouped by day of week</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">{chartContent}</CardContent>
    </Card>
  )
}
