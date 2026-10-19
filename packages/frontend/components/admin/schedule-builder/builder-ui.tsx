"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Panel({ className, children }: Readonly<{ className?: string; children: ReactNode }>) {
  return <section className={cn("rounded-[20px] border border-border bg-card", className)}>{children}</section>
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  mono = false,
}: Readonly<{
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (_value: T) => void
  mono?: boolean
}>) {
  return (
    <div className="inline-grid auto-cols-auto grid-flow-col gap-[3px] rounded-full bg-muted p-[3px]">
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-bold transition-colors",
              mono && "font-mono font-semibold",
              on
                ? "bg-card text-accent shadow-[0_1px_3px_rgba(20,22,28,0.12)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: Readonly<{ checked: boolean; onChange: (_checked: boolean) => void; label: string }>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(20,22,28,0.2)] transition-[left]",
          checked ? "left-[19px]" : "left-[3px]",
        )}
      />
    </button>
  )
}

export function StatCard({
  label,
  value,
  sub,
  tone,
}: Readonly<{ label: string; value: ReactNode; sub?: string; tone?: "good" | "warn" | "bad" }>) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card px-4 py-3.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[28px] font-bold tracking-[-0.02em]",
          tone === "good" && "text-accent",
          tone === "warn" && "text-amber-700 dark:text-amber-300",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </span>
      {sub ? <span className="truncate text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

/** Scheduled hours against the requested range: a band for the range, a bar for what's scheduled. */
export function HoursBar({
  hours,
  min,
  max,
  label,
}: Readonly<{ hours: number; min: number | null; max: number | null; label: string }>) {
  const scale = Math.max(20, (max ?? min ?? 0) + 4, hours)
  const out = (min != null && hours < min) || (max != null && hours > max)
  const pct = (value: number) => `${Math.min(100, (value / scale) * 100)}%`
  return (
    <div className="flex flex-col gap-[3px]" title={`Scheduled ${hours}h · requested ${label}`}>
      <div className="flex items-baseline justify-end gap-[5px] font-mono leading-none">
        <span className={cn("text-[13px]", out ? "font-bold text-amber-700 dark:text-amber-300" : "font-medium")}>
          {Number.isInteger(hours) ? hours : hours.toFixed(1)}
        </span>
        <span className="text-[11px] text-muted-foreground">/ {label}</span>
      </div>
      <div className="relative h-1 rounded-full bg-muted">
        {min != null || max != null ? (
          <div
            className="absolute inset-y-0 rounded-full bg-accent/25"
            style={{ left: pct(min ?? max ?? 0), width: pct((max ?? min ?? 0) - (min ?? max ?? 0) || 0.4) }}
          />
        ) : null}
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", out ? "bg-amber-500" : "bg-accent")}
          style={{ width: pct(hours) }}
        />
      </div>
    </div>
  )
}

export function Pill({ tone, children }: Readonly<{ tone: "good" | "warn" | "bad" | "muted"; children: ReactNode }>) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-3 py-[5px] text-xs font-bold",
        tone === "good" && "bg-accent/15 text-accent",
        tone === "warn" && "bg-amber-500/15 text-amber-800 dark:text-amber-200",
        tone === "bad" && "bg-destructive/15 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  )
}
