"use client"

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

const chartData = [
  { department: "Engineering", present: 4, absent: 1, onLeave: 1 },
  { department: "Design", present: 2, absent: 0, onLeave: 1 },
  { department: "Operations", present: 3, absent: 1, onLeave: 0 },
  { department: "Support", present: 2, absent: 1, onLeave: 0 },
]

const chartConfig = {
  present: {
    label: "Present",
    color: "var(--accent)",
  },
  absent: {
    label: "Absent",
    color: "var(--destructive)",
  },
  onLeave: {
    label: "On Leave",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

export function DepartmentChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance by Department</CardTitle>
        <CardDescription>Today's headcount breakdown per department</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="department"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <YAxis hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar dataKey="present" fill="var(--color-present)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="absent" fill="var(--color-absent)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="onLeave" fill="var(--color-onLeave)" radius={[3, 3, 0, 0]} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
