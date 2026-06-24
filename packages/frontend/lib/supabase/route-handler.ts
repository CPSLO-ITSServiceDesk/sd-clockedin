import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return new URL(request.url).origin
}

export async function createRouteHandlerClient(response: NextResponse) {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // Route handlers can set cookies; Server Components cannot.
            }
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )
}

export function redirectWithCookies(
  url: URL,
  cookieSource: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(url)

  cookieSource.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie)
  })

  return redirect
}
