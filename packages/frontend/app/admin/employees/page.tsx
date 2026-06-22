import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserPlus } from "lucide-react"

interface Employee {
  id: string
  firstName: string
  lastName: string
  role: string
  department: string
  status: "active" | "inactive" | "on-leave"
}

// Mock employee data
const mockEmployees: Employee[] = [
  {
    id: "1",
    firstName: "Alex",
    lastName: "Chen",
    role: "Software Engineer",
    department: "Engineering",
    status: "active",
  },
  {
    "id": "2",
    "firstName": "Sarah",
    "lastName": "Martinez",
    "role": "UI Designer",
    "department": "Design",
    "status": "active"
  },
  {
    "id": "3",
    "firstName": "James",
    "lastName": "Wilson",
    "role": "Operations Lead",
    "department": "Operations",
    "status": "active"
  },
  {
    "id": "4",
    "firstName": "Emily",
    "lastName": "Zhang",
    "role": "Backend Developer",
    "department": "Engineering",
    "status": "on-leave"
  },
  {
    "id": "5",
    "firstName": "Michael",
    "lastName": "Ross",
    "role": "Support Specialist",
    "department": "Support",
    "status": "inactive"
  }
]

const employeeStatusStyles: Record<Employee["status"], string> = {
  active: "bg-accent/20 text-accent",
  inactive: "bg-muted text-muted-foreground",
  "on-leave": "bg-yellow-500/20 text-yellow-500"
}

const employeeStatusLabels: Record<Employee["status"], string> = {
  active: "Active",
  inactive: "Inactive",
  "on-leave": "On Leave"
}

export default function EmployeesPage() {
  return (
    <>
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground text-sm">
            Manage your team members and their information
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Team Members ({mockEmployees.length})</h2>
          </div>
          <div>
            <button className="btn-primary">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Employee
            </button>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Employee Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground text-left uppercase tracking-wider text-xs">
                    Name
                  </TableHead>
                  <TableHead className="text-muted-foreground text-left uppercase tracking-wider text-xs">
                    Role
                  </TableHead>
                  <TableHead className="text-muted-foreground text-left uppercase tracking-wider text-xs">
                    Department
                  </TableHead>
                  <TableHead className="text-muted-foreground text-left uppercase tracking-wider text-xs w-[80px]">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockEmployees.map((employee) => (
                  <TableRow key={employee.id} className="border-border">
                    <TableCell className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.role}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.department}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={employeeStatusStyles[employee.status]}
                      >
                        {employeeStatusLabels[employee.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}