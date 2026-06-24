import { NextResponse } from "next/server"
import { authorizeAdminAccess } from "@/lib/auth/authorize-admin"
import {
  encodeAuthDetail,
  getAuthErrorMessage,
} from "@/lib/auth/errors"
import { logAuthError, logAuthInfo } from "@/lib/auth/logger"
import {
  createRouteHandlerClient,
  getRequestOrigin,
  redirectWithCookies,
} from "@/lib/supabase/route-handler"

function resolveRedirectPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/admin"
  }

  return next
}

function buildAuthErrorUrl(
  origin: string,
  errorCode: string,
  detail?: string,
): URL {
  const url = new URL("/", origin)
  url.searchParams.set("authError", errorCode)
  if (detail) {
    url.searchParams.set("authDetail", encodeAuthDetail(detail))
  }
  return url
}

function finishAuthRedirect(
  cookieCarrier: NextResponse,
  url: URL,
  logContext?: {
    errorCode: string
    detail?: string
  },
): NextResponse {
  if (logContext) {
    logAuthError("Auth callback redirecting with error", {
      errorCode: logContext.errorCode,
      message: getAuthErrorMessage(logContext.errorCode),
      detail: logContext.detail,
    })
  }

  return redirectWithCookies(url, cookieCarrier)
}

export async function GET(request: Request) {
  const origin = getRequestOrigin(request)
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const oauthError = searchParams.get("error")
  const oauthErrorDescription = searchParams.get("error_description")
  const next = resolveRedirectPath(searchParams.get("next"))

  logAuthInfo("Auth callback received", {
    hasCode: Boolean(code),
    oauthError,
    oauthErrorDescription,
    next,
    origin,
  })

  if (oauthError) {
    return NextResponse.redirect(
      buildAuthErrorUrl(
        origin,
        "microsoft_error",
        oauthErrorDescription ?? oauthError,
      ),
    )
  }

  if (!code) {
    return NextResponse.redirect(buildAuthErrorUrl(origin, "missing_code"))
  }

  const cookieCarrier = NextResponse.next()
  const supabase = await createRouteHandlerClient(cookieCarrier)
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

    return finishAuthRedirect(
      cookieCarrier,
      buildAuthErrorUrl(origin, errorCode, sessionError.message),
      { errorCode, detail: sessionError.message },
    )
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
    return finishAuthRedirect(
      cookieCarrier,
      buildAuthErrorUrl(
        origin,
        "callback_failed",
        userError?.message ?? "No user returned from Supabase session",
      ),
      {
        errorCode: "callback_failed",
        detail: userError?.message ?? "No user returned from Supabase session",
      },
    )
  }

  const email = user.email?.trim().toLowerCase()
  logAuthInfo("Authenticated Supabase user", {
    userId: user.id,
    email,
  })

  if (!email) {
    await supabase.auth.signOut()
    return finishAuthRedirect(
      cookieCarrier,
      buildAuthErrorUrl(origin, "missing_email"),
      { errorCode: "missing_email" },
    )
  }

  if (!email.endsWith("@calpoly.edu")) {
    logAuthError("Rejected non-Cal Poly email", { email })
    await supabase.auth.signOut()
    return finishAuthRedirect(
      cookieCarrier,
      buildAuthErrorUrl(origin, "not_allowed_domain", `Signed in as ${email}`),
      { errorCode: "not_allowed_domain", detail: `Signed in as ${email}` },
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
    return finishAuthRedirect(
      cookieCarrier,
      buildAuthErrorUrl(
        origin,
        "admin_api_unreachable",
        error instanceof Error ? error.message : "Network request failed",
      ),
      {
        errorCode: "admin_api_unreachable",
        detail:
          error instanceof Error ? error.message : "Network request failed",
      },
    )
  }

  if (accessResponse.message?.includes("Authorize endpoint not found")) {
    await supabase.auth.signOut()
    return finishAuthRedirect(
      cookieCarrier,
      buildAuthErrorUrl(
        origin,
        "admin_api_not_found",
        accessResponse.message,
      ),
      {
        errorCode: "admin_api_not_found",
        detail: accessResponse.message,
      },
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
    return finishAuthRedirect(
      cookieCarrier,
      buildAuthErrorUrl(
        origin,
        "not_allowed_admin",
        accessResponse.message ?? `No active admin record found for ${email}`,
      ),
      {
        errorCode: "not_allowed_admin",
        detail:
          accessResponse.message ?? `No active admin record found for ${email}`,
      },
    )
  }

  logAuthInfo("Auth callback succeeded", {
    email,
    adminId: accessResponse.admin.id,
    redirectTo: next,
  })

  return redirectWithCookies(new URL(next, origin), cookieCarrier)
}
