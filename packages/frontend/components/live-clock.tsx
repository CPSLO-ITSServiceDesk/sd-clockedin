"use client"

import { useState, useEffect } from "react"
import { ClockModal } from "@/components/clock-modal"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatLiveClockParts } from "@/lib/format-time"

type LiveClockVariant = "hero" | "compact" | "display"

export function LiveClock({
  variant = "hero",
}: Readonly<{ variant?: LiveClockVariant }>) {
  const isCompact = variant === "compact"
  const isDisplay = variant === "display"
  const isHero = variant === "hero"
  const [time, setTime] = useState<Date | null>(null)
  const [modalMode, setModalMode] = useState<"in" | "out" | null>(null)

  useEffect(() => {
    setTime(new Date())
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const alignClass = isHero ? "text-center" : "text-right"

  const timeClass = cn(
    "font-mono font-semibold tracking-tight text-foreground tabular-nums",
    isCompact && "text-xl md:text-2xl",
    isDisplay && "text-2xl md:text-3xl",
    isHero && "text-7xl font-bold md:text-8xl lg:text-9xl",
  )

  const periodClass = cn(
    "text-muted-foreground",
    isCompact && "ml-1.5 text-sm",
    isDisplay && "ml-2 text-base",
    isHero && "ml-3 text-4xl md:text-5xl lg:text-6xl",
  )

  const dateClass = cn(
    "text-muted-foreground uppercase",
    isCompact && "mt-0.5 text-[10px] tracking-wider",
    isDisplay && "mt-0.5 text-[11px] tracking-wider",
    isHero && "mt-4 text-sm tracking-[0.3em]",
  )

  if (!time) {
    return (
      <div className={alignClass}>
        <div className={timeClass}>--:--:--</div>
        <div className={dateClass}>Loading...</div>
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
    <>
      <div className={alignClass}>
        <div className={timeClass}>
          <span>{hours}</span>
          <span className={cn("text-accent", isHero && "animate-pulse")}>:</span>
          <span>{minutes}</span>
          <span className={cn("text-accent", isHero && "animate-pulse")}>:</span>
          <span className="text-muted-foreground">{seconds}</span>
          <span className={periodClass}>{period}</span>
        </div>
        <div className={dateClass}>{dateStr}</div>

        {isHero && (
          <div className="mt-8 flex justify-center gap-3">
            <Button
              onClick={() => setModalMode("in")}
              className="bg-accent px-8 py-2 text-sm uppercase tracking-wider text-accent-foreground hover:bg-accent/90"
            >
              Clock In
            </Button>
            <Button
              onClick={() => setModalMode("out")}
              variant="outline"
              className="border-border px-8 py-2 text-sm uppercase tracking-wider hover:bg-secondary"
            >
              Clock Out
            </Button>
          </div>
        )}
      </div>

      {isHero && (
        <ClockModal
          open={modalMode !== null}
          mode={modalMode ?? "in"}
          onClose={() => setModalMode(null)}
        />
      )}
    </>
  )
}
