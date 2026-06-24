"use client"

import { Calendar, Upload } from "lucide-react"
import type { Term } from "@/lib/api/terms"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TermPageHeaderProps {
  title: string
  description: string
  sortedTerms: Term[]
  activeTermId: number | null
  onTermChange: (termId: number) => void
  showImport?: boolean
  onImportClick?: () => void
}

export function TermPageHeader({
  title,
  description,
  sortedTerms,
  activeTermId,
  onTermChange,
  showImport = false,
  onImportClick,
}: Readonly<TermPageHeaderProps>) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {showImport ? (
          <Button
            type="button"
            variant="outline"
            disabled={!activeTermId}
            onClick={onImportClick}
          >
            <Upload className="size-4" />
            Import schedule
          </Button>
        ) : null}
        <Calendar className="text-muted-foreground size-4" />
        <Select
          value={activeTermId ? String(activeTermId) : undefined}
          onValueChange={(value) => onTermChange(Number(value))}
        >
          <SelectTrigger className="w-[200px] border-border bg-input">
            <SelectValue placeholder="Select term" />
          </SelectTrigger>
          <SelectContent>
            {sortedTerms.map((term) => (
              <SelectItem key={term.id} value={String(term.id)}>
                {term.name}
                {term.is_active ? " (Active)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
