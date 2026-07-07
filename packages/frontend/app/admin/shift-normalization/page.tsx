import { Suspense } from "react"
import { ShiftNormalizationManager } from "@/components/admin/shift-normalization/shift-normalization-manager"

function ShiftNormalizationFallback() {
  return (
    <div className="text-muted-foreground flex min-h-[400px] items-center justify-center text-sm">
      Loading shift normalization...
    </div>
  )
}

export default function ShiftNormalizationPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <Suspense fallback={<ShiftNormalizationFallback />}>
        <ShiftNormalizationManager />
      </Suspense>
    </div>
  )
}
