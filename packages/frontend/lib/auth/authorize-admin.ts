import type { Admin } from "@/lib/api/admins"
import { logAuthError, logAuthInfo } from "@/lib/auth/logger"

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"

export interface AdminAuthorizeResult {
  allowed: boolean
  admin?: Admin
  message?: string
}

export async function authorizeAdminAccess(data: {
  email?: string
  name?: string
}): Promise<AdminAuthorizeResult> {
  const url = `${API_BASE}/admins/authorize`

  logAuthInfo("Calling admin authorize API", { url, email: data.email })

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
    })
  } catch (error) {
    logAuthError("Admin authorize API request failed", { url, error })
    throw error
  }

  const rawBody = await response.text()
  let payload: AdminAuthorizeResult = { allowed: false }

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as AdminAuthorizeResult
    } catch (error) {
      logAuthError("Admin authorize API returned non-JSON body", {
        url,
        status: response.status,
        rawBody: rawBody.slice(0, 300),
        error,
      })
    }
  }

  if (!response.ok) {
    logAuthError("Admin authorize API error response", {
      url,
      status: response.status,
      statusText: response.statusText,
      payload,
      rawBody: rawBody.slice(0, 300),
    })

    if (response.status === 404) {
      return {
        allowed: false,
        message: `Authorize endpoint not found at ${url}`,
      }
    }

    return {
      allowed: false,
      message:
        payload.message ??
        `Authorization failed (${response.status} ${response.statusText})`,
    }
  }

  logAuthInfo("Admin authorize API success", {
    email: data.email,
    allowed: payload.allowed,
    adminId: payload.admin?.id,
  })

  return payload
}
