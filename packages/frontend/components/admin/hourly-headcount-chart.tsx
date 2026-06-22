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
import { useTodayShifts } from "@/hooks/use-today-shifts"
import { computeHourlyHeadcount } from "@/lib/shifts/dashboard-stats"
import { getTodayDay } from "@/lib/shifts/today-shifts"

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

export function HourlyHeadcountChart() {
  const { data: shifts = [], isLoading, error } = useTodayShifts()
  const chartData = computeHourlyHeadcount(shifts, new Date())
  const todayDay = getTodayDay()

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
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <Bar dataKey="expected" fill="var(--color-expected)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="actual" fill="var(--color-actual)" radius={[3, 3, 0, 0]} />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Hourly Workforce</CardTitle>
        <CardDescription>
          Scheduled vs working headcount during each hour (8 AM – 4 PM)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {chartContent}
      </CardContent>
    </Card>
  )
}
