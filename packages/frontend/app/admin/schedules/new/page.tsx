import { Suspense } from "react"
import { ScheduleBuilder } from "@/components/admin/schedule-builder/schedule-builder"

function ScheduleBuilderFallback() {
  return (
    <div className="text-muted-foreground flex min-h-[400px] items-center justify-center text-sm">
      Loading schedule builder...
    </div>
  )
}

export default function NewSchedulePage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <Suspense fallback={<ScheduleBuilderFallback />}>
        <ScheduleBuilder />
      </Suspense>
    </div>
  )
}
