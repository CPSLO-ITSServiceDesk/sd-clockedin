"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import {
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react"
import { formatStudentName } from "@/components/admin/mock-students"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  StudentAssistantForm,
  type StudentAssistantFormValues,
} from "@/components/admin/students/student-assistant-form"
import { StudentKpiCards } from "@/components/admin/students/student-kpi-cards"
import { studentAssistantsApi, type StudentAssistant as ApiStudent } from "@/lib/api/student-assistants"
import { queryKeys } from "@/lib/query-keys"

const mapRoleToBackend = (_role: StudentAssistantFormValues["role"]) => {
  // The DB only has one possible position value
  return "student lead, student assistant"
}

function toStudentFields(values: StudentAssistantFormValues) {
  const polycardId = values.polycard_id.trim()
  const workEmail = values.work_email.trim()
  const result: Record<string, unknown> = {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    position: mapRoleToBackend(values.role),
    work_email: workEmail === "" ? null : workEmail,
  }
  if (polycardId !== "") {
    result.polycard_id = Number(polycardId)
  }
  return result
}

// Convert API student (with position) to form shape (with role)
function apiStudentToForm(student: ApiStudent): StudentAssistantFormValues {
  return {
    first_name: student.first_name ?? "",
    last_name: student.last_name ?? "",
    role: "Student Assistant",
    polycard_id: student.polycard_id != null ? String(student.polycard_id) : "",
    work_email: student.work_email ?? "",
  }
}

export function StudentsTable() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: apiStudents = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.students.all,
    queryFn: studentAssistantsApi.list,
  })
  const [formOpen, setFormOpen] = useState(false)
  // Editing state: store the id of the student being edited and the form values
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null)
  const [editingFormValues, setEditingFormValues] = useState<StudentAssistantFormValues | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<ApiStudent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiStudent | null>(null)

  const invalidateStudents = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.students.all })

  const invalidateStudentRelatedData = async () => {
    await Promise.all([
      invalidateStudents(),
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.all }),
    ])
  }

  const handleAdd = async (values: StudentAssistantFormValues) => {
    try {
      await studentAssistantsApi.create(toStudentFields(values))
      await invalidateStudents()
    } catch (err) {
      console.error("Create student failed:", err)
    }
  }

  const handleEdit = async (values: StudentAssistantFormValues) => {
    if (editingStudentId === null) return
    try {
      await studentAssistantsApi.update(editingStudentId, toStudentFields(values))
      await invalidateStudents()
    } catch (err) {
      console.error("Update student failed:", err)
    }
  }

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) {
      setEditingStudentId(null)
      setEditingFormValues(null)
    }
  }

  const handleToggleActive = async (student: ApiStudent) => {
    try {
      await studentAssistantsApi.update(student.id, { is_active: !student.is_active })
      await invalidateStudents()
    } catch (err) {
      console.error("Toggle student active failed:", err)
    }
    setDeactivateTarget(null)
  }

  const handleDelete = async (student: ApiStudent) => {
    try {
      await studentAssistantsApi.remove(student.id)
      await invalidateStudentRelatedData()
    } catch (err) {
      console.error("Delete student failed:", err)
    }
  }

  const openCreateForm = () => {
    setEditingStudentId(null)
    setEditingFormValues(null)
    setFormOpen(true)
  }

  const openEditForm = (student: ApiStudent) => {
    setEditingStudentId(student.id)
    setEditingFormValues(apiStudentToForm(student))
    setFormOpen(true)
  }

  const openScheduleEditor = (student: ApiStudent) => {
    router.push(`/admin/schedules?student=${student.id}`)
  }

  // For KPI cards: we cannot differentiate leads vs assistants, so we set leads = 0
  const activeCount = apiStudents.filter((s) => s.is_active).length
  const studentLeadCount = 0
  const studentAssistantCount = activeCount
  const combined = activeCount

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground text-sm">
            Manage student assistant records · {activeCount} active
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <UserPlus className="size-4" />
          Add Student
        </Button>
      </div>

      <StudentKpiCards
        total={apiStudents.length}
        studentLeads={studentLeadCount}
        combined={combined}
      />

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
            All Students
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              Loading students...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                    Name
                  </TableHead>
                  <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                    Email
                  </TableHead>
                  <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                    Polycard ID
                  </TableHead>
                  <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                    Role
                  </TableHead>
                  <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                    Status
                  </TableHead>
                  <TableHead className="w-[52px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiStudents.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground py-10 text-center"
                    >
                      No students yet. Add your first student assistant.
                    </TableCell>
                  </TableRow>
                ) : (
                  apiStudents.map((student) => (
                    <TableRow
                      key={student.id}
                      className={`border-border ${student.is_active ? "" : "opacity-60"}`}
                    >
                      <TableCell className="font-medium">
                        {formatStudentName(student)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {student.work_email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {student.polycard_id ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {/* Since we cannot distinguish lead vs assistant, show a generic label */}
                        Student
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            student.is_active
                              ? "bg-accent/20 text-accent"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {student.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => openEditForm(student)}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openScheduleEditor(student)}
                            >
                              <CalendarClock className="size-4" />
                              Edit schedule
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {student.is_active ? (
                              <DropdownMenuItem
                                onClick={() => setDeactivateTarget(student)}
                              >
                                <UserX className="size-4" />
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleToggleActive(student)}
                              >
                                <UserCheck className="size-4" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(student)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StudentAssistantForm
        key={editingFormValues ? editingFormValues.first_name + editingFormValues.last_name : "new"}
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        student={editingFormValues ?? undefined}
        existingStudents={apiStudents.map(s => ({ id: s.id, polycard_id: s.polycard_id }))}
        onSubmit={editingFormValues ? handleEdit : handleAdd}
      />

      <AlertDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null)
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate student?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget
                ? `${formatStudentName(deactivateTarget)} will be marked inactive. You can reactivate them later.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivateTarget) {
                  handleToggleActive(deactivateTarget)
                }
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${formatStudentName(deleteTarget)} will be permanently removed. This action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  handleDelete(deleteTarget)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}