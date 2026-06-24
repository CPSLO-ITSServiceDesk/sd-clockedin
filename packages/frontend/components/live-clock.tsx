"use client"

import { useState, useEffect } from "react"
import { formatLiveClockParts } from "@/lib/format-time"

export function LiveClock() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!time) {
    return (
      <div className="text-center">
        <div className="font-mono text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight text-foreground">
          --:--:--
        </div>
        <div className="mt-4 text-muted-foreground uppercase tracking-[0.3em] text-sm">
          Loading...
        </div>
      </div>
    )
  }

  const { hours, minutes, seconds, period } = formatLiveClockParts(time)

  const dateStr = time.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="text-center">
      <div className="font-mono text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight text-foreground">
        <span>{hours}</span>
        <span className="text-accent animate-pulse">:</span>
        <span>{minutes}</span>
        <span className="text-accent animate-pulse">:</span>
        <span className="text-muted-foreground">{seconds}</span>
        <span className="ml-3 text-4xl md:text-5xl lg:text-6xl text-muted-foreground">
          {period}
        </span>
      </div>
      <div className="mt-4 text-muted-foreground uppercase tracking-[0.3em] text-sm">
        {dateStr}
      </div>
    </div>
  )
}
