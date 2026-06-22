"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import {
  checkSystemHealth,
  type SystemHealthStatus,
} from "@/lib/api/health"

const REFETCH_INTERVAL_MS = 30_000

const statusConfig: Record<
  SystemHealthStatus,
  { label: string; dotClass: string; textClass: string; pulse: boolean }
> = {
  checking: {
    label: "CHECKING",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
    pulse: false,
  },
  operational: {
    label: "OPERATIONAL",
    dotClass: "bg-status-online",
    textClass: "text-status-online",
    pulse: true,
  },
  degraded: {
    label: "DEGRADED",
    dotClass: "bg-yellow-500",
    textClass: "text-yellow-500",
    pulse: false,
  },
  offline: {
    label: "OFFLINE",
    dotClass: "bg-destructive",
    textClass: "text-destructive",
    pulse: false,
  },
}

export function SystemStatus() {
  const [status, setStatus] = useState<SystemHealthStatus>("checking")
  const [frontendOk, setFrontendOk] = useState(false)
  const [backendOk, setBackendOk] = useState(false)

  useEffect(() => {
    let active = true

    async function runCheck() {
      const health = await checkSystemHealth()
      if (!active) return

      setStatus(health.status)
      setFrontendOk(health.frontend)
      setBackendOk(health.backend)
    }

    void runCheck()
    const intervalId = globalThis.setInterval(() => {
      void runCheck()
    }, REFETCH_INTERVAL_MS)

    return () => {
      active = false
      globalThis.clearInterval(intervalId)
    }
  }, [])

  const config = statusConfig[status]

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="uppercase tracking-wider">System Status:</span>
      <span className={cn("flex items-center gap-2", config.textClass)}>
        <span className="relative flex h-2 w-2">
          {config.pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                config.dotClass,
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              config.dotClass,
            )}
          />
        </span>
        <span>{config.label}</span>
      </span>
      {status !== "checking" && (
        <>
          <span className="text-border hidden sm:inline">|</span>
          <span className="uppercase tracking-wider">
            Frontend {frontendOk ? "online" : "offline"}
          </span>
          <span className="text-border">|</span>
          <span className="uppercase tracking-wider">
            Backend {backendOk ? "online" : "offline"}
          </span>
        </>
      )}
    </div>
  )
}
