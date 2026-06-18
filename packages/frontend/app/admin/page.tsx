import { KpiCards } from "@/components/admin/kpi-cards"
import { ShiftsTable } from "@/components/admin/shifts/shifts-table"

export default function AdminDashboard() {
  // Mock KPI data
  const kpiData = {
    late: 1,
    absent: 1,
    expected: 4,
  }

  return (
    <>
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Overview of today's shift activity
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground uppercase tracking-wider">Today</p>
            <p className="text-lg font-mono font-medium">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
        <KpiCards
          late={kpiData.late}
          absent={kpiData.absent}
          expected={kpiData.expected}
        />
        <ShiftsTable />
      </div>
    </>
  )
}