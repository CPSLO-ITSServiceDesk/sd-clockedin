const AUTH_LOG_PREFIX = "[sd-clockin/auth]"

export function logAuthError(message: string, details?: unknown) {
  if (details !== undefined) {
    console.error(AUTH_LOG_PREFIX, message, details)
    return
  }

  console.error(AUTH_LOG_PREFIX, message)
}

export function logAuthInfo(message: string, details?: unknown) {
  if (details !== undefined) {
    console.info(AUTH_LOG_PREFIX, message, details)
    return
  }

  console.info(AUTH_LOG_PREFIX, message)
}
