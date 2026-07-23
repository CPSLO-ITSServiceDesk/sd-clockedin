"use client"

import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  formatOrgDateString,
  formatShortDateLabel,
} from "@/lib/shifts/hourly-staffing-dates"

interface HourlyStaffingDateNavProps {
  date: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function HourlyStaffingDateNav({
  date,
  onPrev,
  onNext,
  onToday,
}: HourlyStaffingDateNavProps) {
  const isToday = date === formatOrgDateString()

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9"
        onClick={onPrev}
        aria-label="Previous day"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="flex h-9 min-w-[150px] items-center justify-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-medium">
        <Calendar className="size-3.5 text-accent" />
        <span>{formatShortDateLabel(date)}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9"
        onClick={onNext}
        aria-label="Next day"
      >
        <ChevronRight className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={onToday}
        disabled={isToday}
      >
        Today
      </Button>
    </div>
  )
}
