import { Suspense } from "react"
import { SchedulesManager } from "@/components/admin/schedules/schedules-manager"

function SchedulesManagerFallback() {
  return (
    <div className="text-muted-foreground flex min-h-[400px] items-center justify-center text-sm">
      Loading schedules...
    </div>
  )
}

export default function SchedulesPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <Suspense fallback={<SchedulesManagerFallback />}>
        <SchedulesManager />
      </Suspense>
    </div>
  )
}
