const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"

type ApiSuccess<T> = { success: true; data: T }
type ApiError = { success: false; error?: string }

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = "ApiRequestError"
  }
}

export interface ScheduleImportBlock {
  day: string
  start_time: string
  end_time: string
}

export interface ScheduleImportStudentPreview {
  workEmail: string
  member: string
  action: "create" | "match"
  studentId?: number
  blockCount: number
  blocks: ScheduleImportBlock[]
}

export interface ScheduleImportSummary {
  studentsCreated: number
  studentsMatched: number
  schedulesUpdated: number
  totalBlocks: number
  skippedRows: number
}

export interface ScheduleImportResult {
  dryRun: boolean
  termId: number
  termName: string
  summary: ScheduleImportSummary
  students: ScheduleImportStudentPreview[]
  warnings: string[]
}

export async function importSchedules(
  file: File,
  termId: number,
  dryRun: boolean,
): Promise<ScheduleImportResult> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("academic_term_id", String(termId))
  formData.append("dry_run", String(dryRun))

  const res = await fetch(`${API_BASE}/import/schedules`, {
    method: "POST",
    body: formData,
  })

  const body = (await res.json()) as ApiSuccess<ScheduleImportResult> | ApiError

  if (!res.ok || !("success" in body) || !body.success) {
    const message =
      "error" in body && body.error
        ? body.error
        : `Request failed (${res.status})`
    throw new ApiRequestError(message, res.status)
  }

  return body.data
}
