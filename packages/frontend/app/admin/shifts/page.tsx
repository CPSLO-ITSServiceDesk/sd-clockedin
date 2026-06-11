import { ShiftsTable } from "@/components/admin/shifts-table"

export default function ShiftsPage() {
  return (
    <>
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shifts</h1>
            <p className="text-muted-foreground text-sm">
              View and manage employee shifts
            </p>
          </div>
        </div>
        <ShiftsTable />
      </div>
    </>
  )
}