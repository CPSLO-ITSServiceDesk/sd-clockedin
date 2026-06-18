"use client"

import { useState } from "react"
import {
  CalendarPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react"
import {
  TermForm,
  toTermOffDays,
  type TermFormValues,
} from "@/components/admin/terms/term-form"
import {
  countOffDays,
  formatTermDate,
  summarizeOffDays,
  type AcademicTerm,
} from "@/components/admin/terms/term-types"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const mockTerms: AcademicTerm[] = [
  {
    id: 1,
    name: "Fall 2025",
    start_date: "2025-08-25",
    end_date: "2025-12-12",
    is_active: true,
    off_days: {
      vacations: [
        { date: "2025-11-27", label: "Thanksgiving" },
        { date: "2025-11-28", label: "Day after Thanksgiving" },
      ],
      special_schedules: [
        {
          date: "2025-10-13",
          swap_to_day: "friday",
          label: "Columbus Day follows Friday schedule",
        },
      ],
    },
  },
  {
    id: 2,
    name: "Spring 2026",
    start_date: "2026-01-20",
    end_date: "2026-05-15",
    is_active: false,
    off_days: {
      vacations: [{ date: "2026-03-16", label: "Spring break week start" }],
      special_schedules: [],
    },
  },
]

function toTermFields(values: TermFormValues) {
  return {
    name: values.name.trim(),
    start_date: values.start_date,
    end_date: values.end_date,
    off_days: toTermOffDays(values),
  }
}

export function TermsTable() {
  const [terms, setTerms] = useState<AcademicTerm[]>(mockTerms)
  const [nextId, setNextId] = useState(mockTerms.length + 1)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<AcademicTerm | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<AcademicTerm | null>(null)

  const handleAdd = (values: TermFormValues) => {
    setTerms((current) => [
      {
        id: nextId,
        ...toTermFields(values),
        is_active: true,
      },
      ...current,
    ])
    setNextId((current) => current + 1)
  }

  const handleEdit = (values: TermFormValues) => {
    if (!editingTerm) return

    const editId = editingTerm.id

    setTerms((current) =>
      current.map((term) =>
        term.id === editId
          ? { ...term, ...toTermFields(values) }
          : term,
      ),
    )
  }

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) {
      setEditingTerm(null)
    }
  }

  const handleToggleActive = (term: AcademicTerm) => {
    setTerms((current) =>
      current.map((entry) =>
        entry.id === term.id
          ? { ...entry, is_active: !entry.is_active }
          : entry,
      ),
    )
    setDeactivateTarget(null)
  }

  const handleDelete = (term: AcademicTerm) => {
    setTerms((current) => current.filter((entry) => entry.id !== term.id))
    setDeleteTarget(null)
  }

  const openCreateForm = () => {
    setEditingTerm(null)
    setFormOpen(true)
  }

  const openEditForm = (term: AcademicTerm) => {
    setEditingTerm(term)
    setFormOpen(true)
  }

  const activeCount = terms.filter((term) => term.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Terms</h1>
          <p className="text-muted-foreground text-sm">
            Manage academic terms · {activeCount} active
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <CalendarPlus className="size-4" />
          Add Term
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
            All Terms
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
                  Dates
                </TableHead>
                <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                  Exceptions
                </TableHead>
                <TableHead className="text-muted-foreground uppercase tracking-wider text-xs">
                  Status
                </TableHead>
                <TableHead className="w-[52px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground py-10 text-center"
                  >
                    No terms yet. Add your first academic term.
                  </TableCell>
                </TableRow>
              ) : (
                terms.map((term) => (
                  <TableRow
                    key={term.id}
                    className={`border-border ${term.is_active ? "" : "opacity-60"}`}
                  >
                    <TableCell className="font-medium">{term.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatTermDate(term.start_date)} –{" "}
                      {formatTermDate(term.end_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <div>{summarizeOffDays(term.off_days)}</div>
                      {countOffDays(term.off_days) > 0 ? (
                        <div className="text-muted-foreground/80 text-xs">
                          {term.off_days?.vacations.length ?? 0} off ·{" "}
                          {term.off_days?.special_schedules.length ?? 0} overrides
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          term.is_active
                            ? "bg-accent/20 text-accent"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {term.is_active ? "Active" : "Inactive"}
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
                          <DropdownMenuItem onClick={() => openEditForm(term)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {term.is_active ? (
                            <DropdownMenuItem
                              onClick={() => setDeactivateTarget(term)}
                            >
                              <UserX className="size-4" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(term)}
                            >
                              <UserCheck className="size-4" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(term)}
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

      <TermForm
        key={editingTerm?.id ?? "new"}
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        term={editingTerm}
        existingTerms={terms}
        onSubmit={editingTerm ? handleEdit : handleAdd}
      />

      <AlertDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null)
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate term?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget
                ? `${deactivateTarget.name} will be marked inactive. You can reactivate it later.`
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
            <AlertDialogTitle>Delete term?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.name} will be permanently removed. This action cannot be undone.`
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
