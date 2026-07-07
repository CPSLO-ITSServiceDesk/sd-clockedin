import { LiveClock } from "@/components/live-clock"
import { ClockedInTable } from "@/components/clocked-in-table"
import { ExpectedArrivalsTable } from "@/components/expected-arrivals-table"

export default function DisplayPage() {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            SD-ClockedIn
          </h1>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Live assistants working
          </p>
        </div>
        <LiveClock variant="display" />
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6">
        <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
          <ClockedInTable showActions={false} variant="display" />
          <ExpectedArrivalsTable showActions={false} variant="display" />
        </section>
      </main>
    </div>
  )
}
