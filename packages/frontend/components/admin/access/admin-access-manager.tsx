"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Ban,
  CheckCircle2,
  Edit,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserCog,
} from "lucide-react"
import {
  adminsApi,
  getAdminDisplayName,
  getAdminInitials,
  isAdminActive,
  type Admin,
} from "@/lib/api/admins"
import { queryKeys } from "@/lib/query-keys"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AdminFormValues = {
  email: string
  first_name: string
  last_name: string
}

function AdminFormDialog({
  open,
  onOpenChange,
  editingAdmin,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingAdmin: Admin | null
  onSubmit: (values: AdminFormValues) => Promise<void>
}) {
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail(editingAdmin?.email ?? "")
    setFirstName(editingAdmin?.first_name ?? "")
    setLastName(editingAdmin?.last_name ?? "")
    setError("")
  }, [editingAdmin, open])

  const handleSave = async () => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("A valid email is required.")
      return
    }

    setIsSaving(true)
    setError("")

    try {
      await onSubmit({
        email: normalizedEmail,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      })
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save admin.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            {editingAdmin ? "Edit Admin" : "Add Admin"}
          </DialogTitle>
          <DialogDescription>
            {editingAdmin
              ? "Update this admin account."
              : "Grant dashboard access by adding an email address."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@example.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-first-name">First name</Label>
              <Input
                id="admin-first-name"
                placeholder="Optional"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-last-name">Last name</Label>
              <Input
                id="admin-last-name"
                placeholder="Optional"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : editingAdmin ? "Save Changes" : "Add Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatLastLogin(value: string | null): string {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Never"
  return date.toLocaleString()
}

export function AdminAccessManager() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null)
  const [actionError, setActionError] = useState("")

  const { data: admins = [], isLoading, error } = useQuery({
    queryKey: queryKeys.admins.all,
    queryFn: adminsApi.list,
  })

  const invalidateAdmins = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admins.all })

  const createMutation = useMutation({
    mutationFn: (values: AdminFormValues) =>
      adminsApi.create({
        email: values.email,
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        isactive: true,
      }),
    onSuccess: invalidateAdmins,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: number
      values: AdminFormValues
    }) =>
      adminsApi.update(id, {
        email: values.email,
        first_name: values.first_name || null,
        last_name: values.last_name || null,
      }),
    onSuccess: invalidateAdmins,
  })

  const toggleStatusMutation = useMutation({
    mutationFn: (admin: Admin) =>
      adminsApi.update(admin.id, {
        isactive: !isAdminActive(admin),
      }),
    onSuccess: invalidateAdmins,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminsApi.remove(id),
    onSuccess: invalidateAdmins,
  })

  const filteredAdmins = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return admins
      .filter((admin) => {
        if (!query) return true

        const displayName = getAdminDisplayName(admin).toLowerCase()
        const email = admin.email?.toLowerCase() ?? ""

        return displayName.includes(query) || email.includes(query)
      })
      .sort((a, b) => {
        const byName = getAdminDisplayName(a).localeCompare(getAdminDisplayName(b))
        if (byName !== 0) return byName
        return (a.email ?? "").localeCompare(b.email ?? "")
      })
  }, [admins, searchQuery])

  const handleCreate = async (values: AdminFormValues) => {
    setActionError("")
    await createMutation.mutateAsync(values)
  }

  const handleUpdate = async (values: AdminFormValues) => {
    if (!editingAdmin) return
    setActionError("")
    await updateMutation.mutateAsync({ id: editingAdmin.id, values })
  }

  const handleToggleStatus = async (admin: Admin) => {
    setActionError("")
    try {
      await toggleStatusMutation.mutateAsync(admin)
    } catch (toggleError) {
      setActionError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update admin status.",
      )
    }
  }

  const handleDelete = async () => {
    if (!deletingAdmin) return

    setActionError("")
    try {
      await deleteMutation.mutateAsync(deletingAdmin.id)
      setDeletingAdmin(null)
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete admin.",
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Access</h1>
          <p className="text-muted-foreground text-sm">
            Manage who can sign in to the admin dashboard. Access is granted by
            email and verified at sign-in.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingAdmin(null)
            setIsFormOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Admin
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Admin users</CardTitle>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name or email..."
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {actionError ? (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}

          {error ? (
            <div className="py-10 text-center text-destructive">
              {error instanceof Error ? error.message : "Failed to load admins."}
            </div>
          ) : isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              Loading admins...
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              {admins.length === 0
                ? "No admins yet. Add an email address to grant access."
                : "No admins match your search."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="w-[64px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map((admin) => {
                  const active = isAdminActive(admin)

                  return (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs font-semibold">
                              {getAdminInitials(admin)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="truncate font-medium">
                            {getAdminDisplayName(admin)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {admin.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={active ? "default" : "secondary"}>
                          {active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatLastLogin(admin.last_login)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="ml-auto"
                              aria-label={`Actions for ${admin.email ?? "admin"}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingAdmin(admin)
                                setIsFormOpen(true)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(admin)}
                            >
                              {active ? (
                                <>
                                  <Ban className="mr-2 h-4 w-4" />
                                  Disable
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Enable
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletingAdmin(admin)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AdminFormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) setEditingAdmin(null)
        }}
        editingAdmin={editingAdmin}
        onSubmit={editingAdmin ? handleUpdate : handleCreate}
      />

      <AlertDialog
        open={!!deletingAdmin}
        onOpenChange={(open) => !open && setDeletingAdmin(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete admin</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{" "}
              <strong>{deletingAdmin?.email ?? "this admin"}</strong> from admin
              access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
