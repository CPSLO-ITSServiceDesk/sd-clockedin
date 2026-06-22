"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type StudentRole = "Student Lead" | "Student Assistant"

export interface StudentAssistant {
  id: number
  first_name: string
  last_name: string
  role: StudentRole
  polycard_id: number | null
  work_email: string | null
  is_active: boolean
}

export const STUDENT_ROLE_OPTIONS: { value: StudentRole; label: string }[] = [
  { value: "Student Lead", label: "Student Lead" },
  { value: "Student Assistant", label: "Student Assistant" },
]

const studentRoleSchema = z.enum(["Student Lead", "Student Assistant"])

const studentAssistantFormSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(100, "First name must be 100 characters or fewer"),
  last_name: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(100, "Last name must be 100 characters or fewer"),
  role: studentRoleSchema,
  polycard_id: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d+$/.test(value),
      "Polycard ID must be a whole number",
    )
    .refine(
      (value) =>
        value === "" ||
        (Number(value) > 0 && Number(value) <= Number.MAX_SAFE_INTEGER),
      "Polycard ID must be a positive number",
    ),
  work_email: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "Enter a valid email address",
    ),
})

export type StudentAssistantFormValues = z.infer<typeof studentAssistantFormSchema>

const emptyValues: StudentAssistantFormValues = {
  first_name: "",
  last_name: "",
  role: "Student Assistant",
  polycard_id: "",
  work_email: "",
}

function valuesFromStudent(student: StudentAssistant): StudentAssistantFormValues {
  return {
    first_name: student.first_name,
    last_name: student.last_name,
    role: student.role,
    polycard_id:
      student.polycard_id != null ? String(student.polycard_id) : "",
    work_email: student.work_email ?? "",
  }
}

interface StudentAssistantFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student?: StudentAssistant | null
  existingStudents?: Pick<StudentAssistant, "id" | "polycard_id">[]
  onSubmit: (values: StudentAssistantFormValues) => void
}

export function StudentAssistantForm({
  open,
  onOpenChange,
  student,
  existingStudents = [],
  onSubmit,
}: StudentAssistantFormProps) {
  const isEditing = Boolean(student)

  const form = useForm<StudentAssistantFormValues>({
    resolver: zodResolver(studentAssistantFormSchema),
    defaultValues: emptyValues,
    mode: "onTouched",
  })

  useEffect(() => {
    if (!open) return

    form.reset(student ? valuesFromStudent(student) : emptyValues)
    form.clearErrors()
  }, [open, student, form])

  const handleSubmit = form.handleSubmit((values) => {
    if (values.polycard_id) {
      const polycardId = Number(values.polycard_id)
      const duplicate = existingStudents.some(
        (existingStudent) =>
          existingStudent.polycard_id === polycardId &&
          existingStudent.id !== student?.id,
      )

      if (duplicate) {
        form.setError("polycard_id", {
          type: "manual",
          message: "This Polycard ID is already assigned to another student",
        })
        return
      }
    }

    onSubmit(values)
    onOpenChange(false)
  })

  const isSubmitting = form.formState.isSubmitting

  const submitLabel = isSubmitting
    ? "Saving..."
    : isEditing
      ? "Save changes"
      : "Add student"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Student" : "Add Student"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this student assistant's details."
              : "Add a new student assistant to the roster."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="given-name"
                        placeholder="Alex"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="family-name"
                        placeholder="Chen"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="work_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="email"
                      placeholder="name@calpoly.edu"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="polycard_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Polycard ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      placeholder="Optional"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger id="role" className="w-full">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STUDENT_ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
