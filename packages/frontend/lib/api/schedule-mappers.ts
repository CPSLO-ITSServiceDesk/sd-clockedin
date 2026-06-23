import type { DraftScheduleBlock } from "@/components/admin/schedules/schedule-types"
import type { StudentRole } from "@/components/admin/students/student-assistant-form"
import { normalizeTimeKey } from "@/lib/format-time"
import type { StudentAssistant as ApiStudent } from "@/lib/api/student-assistants"
import type { ScheduleBlock as ApiScheduleBlock } from "@/lib/api/scheduleBlocks"

export interface ScheduleStudent {
  id: number
  first_name: string
  last_name: string
  role: StudentRole
  polycard_id: number | null
  is_active: boolean
}

export function apiStudentToScheduleStudent(
  student: ApiStudent,
): ScheduleStudent {
  return {
    id: student.id,
    first_name: student.first_name ?? "",
    last_name: student.last_name ?? "",
    role: "Student Assistant",
    polycard_id: student.polycard_id,
    is_active: student.is_active ?? false,
  }
}

export function apiBlockToDraft(
  block: ApiScheduleBlock,
): DraftScheduleBlock | null {
  if (!block.days || !block.start_time || !block.end_time) {
    return null
  }

  return {
    day: block.days,
    start_time: normalizeTimeKey(block.start_time),
    end_time: normalizeTimeKey(block.end_time),
    is_remote: block.is_remote ?? false,
  }
}

export function draftToApiBlockInput(
  block: DraftScheduleBlock,
  scheduleId: number,
) {
  return {
    schedule_id: scheduleId,
    days: block.day,
    start_time: block.start_time,
    end_time: block.end_time,
    is_remote: block.is_remote ?? false,
  }
}
