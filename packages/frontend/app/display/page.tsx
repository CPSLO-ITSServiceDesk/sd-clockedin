import { LiveClock } from "@/components/live-clock"
import { ClockedInTable } from "@/components/clocked-in-table"
import { ExpectedArrivalsTable } from "@/components/expected-arrivals-table"

export default function DisplayPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex justify-end">
          <LiveClock variant="compact" />
        </div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ClockedInTable showActions={false} />
          <ExpectedArrivalsTable showActions={false} />
        </section>
      </main>
    </div>
  )
}
