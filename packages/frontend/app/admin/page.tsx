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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview of today&apos;s shift activity
          </p>
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