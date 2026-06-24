import { Suspense } from "react"
import { TimesheetVerification } from "@/components/admin/timesheet/timesheet-verification"

function TimesheetVerificationFallback() {
  return (
    <div className="text-muted-foreground flex min-h-[400px] items-center justify-center text-sm">
      Loading timesheet verification...
    </div>
  )
}

export default function TimesheetVerificationPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <Suspense fallback={<TimesheetVerificationFallback />}>
        <TimesheetVerification />
      </Suspense>
    </div>
  )
}
