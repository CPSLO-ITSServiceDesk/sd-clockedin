import { z } from "zod"

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

export const studentAssistantFormSchema = z.object({
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

export const emptyStudentFormValues: StudentAssistantFormValues = {
  first_name: "",
  last_name: "",
  role: "Student Assistant",
  polycard_id: "",
  work_email: "",
}
