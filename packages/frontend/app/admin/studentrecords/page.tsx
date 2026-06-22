import { Suspense } from "react"
import { StudentRecordsManager } from "@/components/admin/student-records/student-records-manager"

function StudentRecordsManagerFallback() {
  return (
    <div className="text-muted-foreground flex min-h-[400px] items-center justify-center text-sm">
      Loading student records...
    </div>
  )
}

export default function StudentRecordsPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <Suspense fallback={<StudentRecordsManagerFallback />}>
        <StudentRecordsManager />
      </Suspense>
    </div>
  )
}
