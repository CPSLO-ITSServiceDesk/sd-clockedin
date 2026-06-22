import type { StudentRole } from "@/components/admin/students/student-assistant-form"
import { formatStudentName } from "@/components/admin/mock-students"
import type { StudentAssistant as ApiStudent } from "@/lib/api/student-assistants"
import { formatStudentRole } from "@/lib/api/student-assistants"

const ROLE_SORT_ORDER: Record<StudentRole, number> = {
  "Student Lead": 0,
  "Student Assistant": 1,
}

export function getStudentInitials(
  student: Pick<ApiStudent, "first_name" | "last_name">,
): string {
  return [student.first_name, student.last_name]
    .filter(Boolean)
    .map((part) => part?.[0]?.toUpperCase() ?? "")
    .join("")
}

export function getStudentRole(student: ApiStudent): StudentRole {
  const formatted = formatStudentRole(student.position)
  return formatted === "Student Lead" ? "Student Lead" : "Student Assistant"
}

export function compareStudentsByRoleThenName(
  a: ApiStudent,
  b: ApiStudent,
): number {
  const roleDiff =
    ROLE_SORT_ORDER[getStudentRole(a)] - ROLE_SORT_ORDER[getStudentRole(b)]
  if (roleDiff !== 0) return roleDiff

  return formatStudentName({
    first_name: a.first_name ?? "",
    last_name: a.last_name ?? "",
  }).localeCompare(
    formatStudentName({
      first_name: b.first_name ?? "",
      last_name: b.last_name ?? "",
    }),
  )
}
