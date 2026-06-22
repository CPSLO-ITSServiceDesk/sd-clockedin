import type { DraftScheduleBlock } from "@/components/admin/schedules/schedule-types"
import { draftToApiBlockInput } from "@/lib/api/schedule-mappers"
import { scheduleBlocksApi, type ScheduleBlock } from "@/lib/api/scheduleBlocks"
import { schedulesApi, type Schedule } from "@/lib/api/schedules"

export async function saveStudentTermSchedule(
  studentId: number,
  termId: number,
  draftBlocks: DraftScheduleBlock[],
  existingSchedule: Schedule | null,
  existingBlocks: ScheduleBlock[],
): Promise<void> {
  if (draftBlocks.length === 0) {
    if (existingSchedule) {
      await Promise.all(
        existingBlocks.map((block) => scheduleBlocksApi.remove(block.id)),
      )
      await schedulesApi.remove(existingSchedule.id)
    }
    return
  }

  let scheduleId = existingSchedule?.id

  if (!scheduleId) {
    const created = await schedulesApi.create({
      student_assistant_id: studentId,
      academic_term_id: termId,
    })
    scheduleId = created.id
  }

  await Promise.all(
    existingBlocks.map((block) => scheduleBlocksApi.remove(block.id)),
  )

  await Promise.all(
    draftBlocks.map((block) =>
      scheduleBlocksApi.create(draftToApiBlockInput(block, scheduleId!)),
    ),
  )
}
