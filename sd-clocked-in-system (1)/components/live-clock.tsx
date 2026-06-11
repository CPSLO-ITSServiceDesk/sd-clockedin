"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ClockModal } from "@/components/clock-modal"

export function LiveClock() {
  const [time, setTime] = useState<Date | null>(null)
  const [modalMode, setModalMode] = useState<"in" | "out" | null>(null)

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

  const hours = time.getHours().toString().padStart(2, "0")
  const minutes = time.getMinutes().toString().padStart(2, "0")
  const seconds = time.getSeconds().toString().padStart(2, "0")

  const dateStr = time.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <>
      <div className="text-center">
        <div className="font-mono text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight text-foreground">
          <span>{hours}</span>
          <span className="text-accent animate-pulse">:</span>
          <span>{minutes}</span>
          <span className="text-accent animate-pulse">:</span>
          <span className="text-muted-foreground">{seconds}</span>
        </div>
        <div className="mt-4 text-muted-foreground uppercase tracking-[0.3em] text-sm">
          {dateStr}
        </div>

        {/* Clock In/Out Section */}
        <div className="mt-8 flex justify-center gap-3">
          <Button
            onClick={() => setModalMode("in")}
            className="bg-accent text-accent-foreground hover:bg-accent/90 font-mono uppercase tracking-wider text-sm px-8 py-2"
          >
            Clock In
          </Button>
          <Button
            onClick={() => setModalMode("out")}
            variant="outline"
            className="border-border hover:bg-secondary font-mono uppercase tracking-wider text-sm px-8 py-2"
          >
            Clock Out
          </Button>
        </div>
      </div>

      <ClockModal
        open={modalMode !== null}
        mode={modalMode ?? "in"}
        onClose={() => setModalMode(null)}
      />
    </>
  )
}
