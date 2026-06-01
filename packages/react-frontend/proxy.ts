import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionSecret } from "@/lib/auth/config"
import { ADMIN_SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session"

export async function proxy(request: NextRequest) {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/?authRequired=1", request.url))
  }

  try {
    const payload = await verifySessionToken(sessionToken, getSessionSecret())
    if (!payload || !payload.roles.includes("admin")) {
      return NextResponse.redirect(new URL("/?authRequired=1", request.url))
    }

    return NextResponse.next()
  } catch (error) {
    console.error("Admin session validation failed:", error)
    return NextResponse.redirect(new URL("/?authError=session_invalid", request.url))
  }
}

export const config = {
  matcher: ["/admin/:path*"],
}
