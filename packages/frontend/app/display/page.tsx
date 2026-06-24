import { LiveClock } from "@/components/live-clock"
import { ClockedInTable } from "@/components/clocked-in-table"
import { ExpectedArrivalsTable } from "@/components/expected-arrivals-table"

export default function DisplayPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent">
              <svg
                className="h-5 w-5 text-accent-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                SD-ClockedIn
              </h1>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Live shift board
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="py-8 md:py-12">
          <LiveClock />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ClockedInTable showActions={false} />
          <ExpectedArrivalsTable showActions={false} />
        </section>
      </main>
    </div>
  )
}
