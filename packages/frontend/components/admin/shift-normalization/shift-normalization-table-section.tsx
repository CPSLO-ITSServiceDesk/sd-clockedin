"use client"

import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface ShiftNormalizationTableSectionProps {
  title: string
  description?: string
  children: ReactNode
  collapsible?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function SectionHeader({
  title,
  description,
  collapsible,
  open,
}: Readonly<{
  title: string
  description?: string
  collapsible?: boolean
  open?: boolean
}>) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-card-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {collapsible ? (
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      ) : null}
    </div>
  )
}

export function ShiftNormalizationTableSection({
  title,
  description,
  children,
  collapsible = false,
  open,
  onOpenChange,
}: Readonly<ShiftNormalizationTableSectionProps>) {
  const header = (
    <SectionHeader
      title={title}
      description={description}
      collapsible={collapsible}
      open={open}
    />
  )

  const table = <div className="overflow-x-auto">{children}</div>

  if (collapsible) {
    return (
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center border-b border-border px-6 py-4 text-left transition-colors hover:bg-secondary/40"
            >
              {header}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>{table}</CollapsibleContent>
        </div>
      </Collapsible>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="border-b border-border px-6 py-4">{header}</div>
      {table}
    </div>
  )
}

export const normalizationTableHeadClassName =
  "text-muted-foreground h-10 px-6 text-xs font-medium uppercase tracking-wider first:pl-6 last:pr-6"

export const normalizationTableCellClassName =
  "px-6 py-3 text-sm first:pl-6 last:pr-6"
