import type { DraftScheduleBlock } from "@/components/admin/schedules/schedule-types"
import { draftToApiBlockInput } from "@/lib/api/schedule-mappers"
import { scheduleBlocksApi, type ScheduleBlock } from "@/lib/api/scheduleBlocks"
import { schedulesApi, type Schedule } from "@/lib/api/schedules"

export type ScheduleDateOverrides = {
  startDate: string | null
  endDate: string | null
}

export async function saveStudentTermSchedule(
  studentId: number,
  termId: number,
  draftBlocks: DraftScheduleBlock[],
  existingSchedule: Schedule | null,
  existingBlocks: ScheduleBlock[],
  dateOverrides: ScheduleDateOverrides = { startDate: null, endDate: null },
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

  const schedulePayload = {
    start_date: dateOverrides.startDate,
    end_date: dateOverrides.endDate,
  }

  let scheduleId = existingSchedule?.id

  if (!scheduleId) {
    const created = await schedulesApi.create({
      student_assistant_id: studentId,
      academic_term_id: termId,
      ...schedulePayload,
    })
    scheduleId = created.id
  } else {
    await schedulesApi.update(scheduleId, schedulePayload)
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
