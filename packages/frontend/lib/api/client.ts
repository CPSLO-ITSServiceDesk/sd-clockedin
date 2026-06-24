import { createClient } from "@/lib/supabase/client"

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"

type ApiSuccess<T> = { success: true; data: T }
type ApiError = { success: false; error?: string; errors?: unknown[] }

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = "ApiRequestError"
  }
}

async function getAccessToken(): Promise<string | undefined> {
  if (typeof window === "undefined") {
    return undefined
  }

  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.access_token
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const accessToken = await getAccessToken()

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
    ...init,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const body = (await res.json()) as ApiSuccess<T> | ApiError

  if (!res.ok || !("success" in body) || !body.success) {
    const message =
      "error" in body && body.error
        ? body.error
        : `Request failed (${res.status})`
    throw new ApiRequestError(message, res.status)
  }

  return body.data
}