import type { StudentAssistant } from "@/components/admin/students/student-assistant-form"

export const MOCK_STUDENTS: StudentAssistant[] = [
  {
    id: 1,
    first_name: "Alex",
    last_name: "Chen",
    role: "Student Lead",
    polycard_id: 12345,
    is_active: true,
  },
  {
    id: 2,
    first_name: "Maya",
    last_name: "Rodriguez",
    role: "Student Assistant",
    polycard_id: 23456,
    is_active: true,
  },
  {
    id: 3,
    first_name: "James",
    last_name: "Wilson",
    role: "Student Assistant",
    polycard_id: 34567,
    is_active: false,
  },
  {
    id: 4,
    first_name: "Emily",
    last_name: "Park",
    role: "Student Lead",
    polycard_id: 45678,
    is_active: true,
  },
]

export function formatStudentName(student: Pick<StudentAssistant, "first_name" | "last_name">): string {
  return `${student.first_name} ${student.last_name}`
}
