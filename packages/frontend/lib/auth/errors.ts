export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  auth_config: "Microsoft auth is not configured correctly.",
  microsoft_error: "Microsoft sign-in was cancelled or failed.",
  invalid_state: "Sign-in session expired. Please try again.",
  missing_code: "Microsoft did not return an authorization code.",
  missing_email: "Microsoft login did not return an email address.",
  not_allowed_domain: "Only @calpoly.edu accounts can sign in.",
  not_allowed_admin: "This account is not in the admin access list.",
  admin_api_unreachable: "Admin access service is unreachable.",
  admin_api_not_found:
    "Admin authorize endpoint was not found. Check NEXT_PUBLIC_API_URL and restart the backend.",
  invalid_api_key:
    "Supabase anon key is invalid. Use the publishable key from Supabase Dashboard → Settings → API.",
  callback_failed: "Sign-in failed. Please try again.",
  session_invalid: "Your session expired. Please sign in again.",
}

export function getAuthErrorMessage(code: string | null): string {
  if (!code) {
    return "Authentication failed."
  }

  return AUTH_ERROR_MESSAGES[code] ?? "Authentication failed."
}

export function encodeAuthDetail(message: string): string {
  return encodeURIComponent(message.slice(0, 300))
}

export function decodeAuthDetail(detail: string | null): string | undefined {
  if (!detail) {
    return undefined
  }

  try {
    return decodeURIComponent(detail)
  } catch {
    return detail
  }
}
