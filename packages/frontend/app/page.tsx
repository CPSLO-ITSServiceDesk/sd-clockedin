import { LiveClock } from "@/components/live-clock"
import { ClockedInTable } from "@/components/clocked-in-table"
import { ExpectedArrivalsTable } from "@/components/expected-arrivals-table"
import { LeadLogin } from "@/components/lead-login"
import { AuthNotifications } from "@/components/auth-notifications"
import { SystemStatus } from "@/components/system-status"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <AuthNotifications />
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-accent rounded-sm flex items-center justify-center">
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  ClockIn v2
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LeadLogin />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Live Clock Section */}
        <section className="py-12 md:py-16">
          <LiveClock />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ClockedInTable />
          <ExpectedArrivalsTable />
        </section>

        {/* Footer Info */}
        <footer className="border-t border-border pt-6 pb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <SystemStatus />
            <div className="flex items-center gap-4">
              <span>v2.0.0</span>
              <span className="text-border">|</span>
              <span>SD-ClockedIn</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
