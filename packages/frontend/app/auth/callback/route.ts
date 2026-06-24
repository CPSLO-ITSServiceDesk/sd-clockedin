import { NextResponse } from "next/server"
import { authorizeAdminAccess } from "@/lib/auth/authorize-admin"
import {
  encodeAuthDetail,
  getAuthErrorMessage,
} from "@/lib/auth/errors"
import { logAuthError, logAuthInfo } from "@/lib/auth/logger"
import { createClient } from "@/lib/supabase/server"

function resolveRedirectPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/admin"
  }

  return next
}

function redirectWithAuthError(
  origin: string,
  errorCode: string,
  detail?: string,
): NextResponse {
  const url = new URL("/", origin)
  url.searchParams.set("authError", errorCode)
  if (detail) {
    url.searchParams.set("authDetail", encodeAuthDetail(detail))
  }

  logAuthError("Auth callback redirecting with error", {
    errorCode,
    message: getAuthErrorMessage(errorCode),
    detail,
  })

  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const oauthError = searchParams.get("error")
  const oauthErrorDescription = searchParams.get("error_description")
  const next = resolveRedirectPath(searchParams.get("next"))

  logAuthInfo("Auth callback received", {
    hasCode: Boolean(code),
    oauthError,
    oauthErrorDescription,
    next,
  })

  if (oauthError) {
    return redirectWithAuthError(
      origin,
      "microsoft_error",
      oauthErrorDescription ?? oauthError,
    )
  }

  if (!code) {
    return redirectWithAuthError(origin, "missing_code")
  }

  const supabase = await createClient()
  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError) {
    logAuthError("Session exchange failed", {
      message: sessionError.message,
      name: sessionError.name,
      status: sessionError.status,
    })

    const errorCode = sessionError.message.toLowerCase().includes("invalid api key")
      ? "invalid_api_key"
      : "callback_failed"

    return redirectWithAuthError(origin, errorCode, sessionError.message)
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    logAuthError("Failed to load authenticated user after callback", {
      userError,
    })
    await supabase.auth.signOut()
    return redirectWithAuthError(
      origin,
      "callback_failed",
      userError?.message ?? "No user returned from Supabase session",
    )
  }

  const email = user.email?.trim().toLowerCase()
  logAuthInfo("Authenticated Supabase user", {
    userId: user.id,
    email,
  })

  if (!email) {
    await supabase.auth.signOut()
    return redirectWithAuthError(origin, "missing_email")
  }

  if (!email.endsWith("@calpoly.edu")) {
    logAuthError("Rejected non-Cal Poly email", { email })
    await supabase.auth.signOut()
    return redirectWithAuthError(
      origin,
      "not_allowed_domain",
      `Signed in as ${email}`,
    )
  }

  let accessResponse
  try {
    accessResponse = await authorizeAdminAccess({
      email,
      name: user.user_metadata.full_name ?? user.user_metadata.name,
    })
  } catch (error) {
    logAuthError("Admin authorize API unreachable", { error })
    await supabase.auth.signOut()
    return redirectWithAuthError(
      origin,
      "admin_api_unreachable",
      error instanceof Error ? error.message : "Network request failed",
    )
  }

  if (accessResponse.message?.includes("Authorize endpoint not found")) {
    await supabase.auth.signOut()
    return redirectWithAuthError(
      origin,
      "admin_api_not_found",
      accessResponse.message,
    )
  }

  if (!accessResponse.allowed || !accessResponse.admin?.isactive) {
    logAuthError("Admin access denied", {
      email,
      allowed: accessResponse.allowed,
      isActive: accessResponse.admin?.isactive ?? null,
      message: accessResponse.message,
    })
    await supabase.auth.signOut()
    return redirectWithAuthError(
      origin,
      "not_allowed_admin",
      accessResponse.message ?? `No active admin record found for ${email}`,
    )
  }

  logAuthInfo("Auth callback succeeded", {
    email,
    adminId: accessResponse.admin.id,
    redirectTo: next,
  })

  return NextResponse.redirect(new URL(next, origin))
}
