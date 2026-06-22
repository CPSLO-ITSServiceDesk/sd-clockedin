"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScheduleImportPanel } from "@/components/admin/schedules/schedule-import-panel"

interface ScheduleImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  termId: number
  termName: string
}

export function ScheduleImportDialog({
  open,
  onOpenChange,
  termId,
  termName,
}: ScheduleImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import schedule</DialogTitle>
          <DialogDescription>
            Upload a When I Work export (.xlsx or .csv). Only{" "}
            <span className="text-foreground font-medium">Service Desk</span>{" "}
            shifts are imported; date-specific rows become recurring Mon–Fri
            blocks for{" "}
            <span className="text-foreground font-medium">{termName}</span>.
          </DialogDescription>
        </DialogHeader>

        <ScheduleImportPanel
          key={`${termId}-${open}`}
          termId={termId}
          termName={termName}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
