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
import type { LateByTimeSlot } from "@/lib/api/analytics"
import { formatStartTimeHeader } from "@/lib/format-time"

const chartConfig = {
  lateCount: {
    label: "Late shifts",
    color: "var(--destructive)",
  },
} satisfies ChartConfig

interface TermLateBySlotChartProps {
  data: LateByTimeSlot[]
  isLoading: boolean
  error: Error | null
}

export function TermLateBySlotChart({
  data,
  isLoading,
  error,
}: TermLateBySlotChartProps) {
  const chartData = data.map((slot) => ({
    ...slot,
    label: formatStartTimeHeader(slot.startTime),
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
  } else if (chartData.length === 0) {
    chartContent = (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No scheduled in-person shifts to analyze
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
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const payload = item.payload as LateByTimeSlot & { label: string }
                  const rate = Math.round(payload.lateRate * 100)
                  return (
                    <span>
                      {value} late · {payload.totalShifts} total ({rate}%)
                    </span>
                  )
                }}
              />
            }
          />
          <Bar
            dataKey="lateCount"
            fill="var(--color-lateCount)"
            radius={[4, 4, 0, 0]}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    )
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Late Shifts by Start Time</CardTitle>
        <CardDescription>
          Which scheduled start times have the most late clock-ins
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">{chartContent}</CardContent>
    </Card>
  )
}
