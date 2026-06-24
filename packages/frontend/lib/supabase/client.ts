import { createBrowserClient } from "@supabase/ssr"
import { logAuthError } from "@/lib/auth/logger"

let browserClient: ReturnType<typeof createBrowserClient> | undefined

function warnIfMisconfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    logAuthError("Missing Supabase env vars", {
      hasUrl: Boolean(url),
      hasKey: Boolean(key),
      required: [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ],
    })
    return
  }

  if (
    key.includes("REPLACE_WITH") ||
    key.startsWith("sb_secret_") ||
    key === "your-anon-key"
  ) {
    logAuthError("Invalid NEXT_PUBLIC_SUPABASE_ANON_KEY", {
      hint: "Use the publishable/anon key from Supabase Dashboard → Settings → API. Do not use sb_secret_ keys in the frontend.",
    })
  }
}

export function createClient() {
  warnIfMisconfigured()

  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }

  return browserClient
}
