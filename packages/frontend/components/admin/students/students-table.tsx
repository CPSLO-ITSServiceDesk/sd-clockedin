"use client"

import { useState } from "react"
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
import { MOCK_STUDENTS, formatStudentName } from "@/components/admin/mock-students"
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
  type StudentAssistant,
  type StudentAssistantFormValues,
} from "@/components/admin/students/student-assistant-form"
import { StudentKpiCards } from "@/components/admin/students/student-kpi-cards"

const mockStudents = MOCK_STUDENTS

function toStudentFields(values: StudentAssistantFormValues) {
  const polycardId = values.polycard_id.trim()

  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    role: values.role,
    polycard_id: polycardId ? Number(polycardId) : null,
  }
}

export function StudentsTable() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentAssistant[]>(mockStudents)
  const [nextId, setNextId] = useState(mockStudents.length + 1)
  const [formOpen, setFormOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<StudentAssistant | null>(
    null,
  )
  const [deactivateTarget, setDeactivateTarget] =
    useState<StudentAssistant | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StudentAssistant | null>(
    null,
  )

  const handleAdd = (values: StudentAssistantFormValues) => {
    setStudents((current) => [
      {
        id: nextId,
        ...toStudentFields(values),
        is_active: true,
      },
      ...current,
    ])
    setNextId((current) => current + 1)
  }

  const handleEdit = (values: StudentAssistantFormValues) => {
    if (!editingStudent) return

    const editId = editingStudent.id

    setStudents((current) =>
      current.map((student) =>
        student.id === editId
          ? { ...student, ...toStudentFields(values) }
          : student,
      ),
    )
  }

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) {
      setEditingStudent(null)
    }
  }

  const handleToggleActive = (student: StudentAssistant) => {
    setStudents((current) =>
      current.map((entry) =>
        entry.id === student.id
          ? { ...entry, is_active: !entry.is_active }
          : entry,
      ),
    )
    setDeactivateTarget(null)
  }

  const handleDelete = (student: StudentAssistant) => {
    setStudents((current) => current.filter((entry) => entry.id !== student.id))
    setDeleteTarget(null)
  }

  const openCreateForm = () => {
    setEditingStudent(null)
    setFormOpen(true)
  }

  const openEditForm = (student: StudentAssistant) => {
    setEditingStudent(student)
    setFormOpen(true)
  }

  const openScheduleEditor = (student: StudentAssistant) => {
    router.push(`/admin/schedules?student=${student.id}`)
  }

  const activeCount = students.filter((student) => student.is_active).length
  const studentLeadCount = students.filter(
    (student) => student.role === "Student Lead",
  ).length
  const studentAssistantCount = students.filter(
    (student) => student.role === "Student Assistant",
  ).length

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
        total={students.length}
        studentLeads={studentLeadCount}
        combined={studentLeadCount + studentAssistantCount}
      />

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
            All Students
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                  Name
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
              {students.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground py-10 text-center"
                  >
                    No students yet. Add your first student assistant.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow
                    key={student.id}
                    className={`border-border ${student.is_active ? "" : "opacity-60"}`}
                  >
                    <TableCell className="font-medium">
                      {formatStudentName(student)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {student.polycard_id ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.role}
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
        </CardContent>
      </Card>

      <StudentAssistantForm
        key={editingStudent?.id ?? "new"}
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        student={editingStudent}
        existingStudents={students}
        onSubmit={editingStudent ? handleEdit : handleAdd}
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
