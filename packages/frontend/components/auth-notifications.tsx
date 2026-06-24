"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import {
  decodeAuthDetail,
  getAuthErrorMessage,
} from "@/lib/auth/errors"
import { logAuthError } from "@/lib/auth/logger"

function AuthNotificationsInner() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const authRequired = searchParams.get("authRequired")
    const authError = searchParams.get("authError")
    const authDetail = decodeAuthDetail(searchParams.get("authDetail"))
    const hasAuthMessage = Boolean(authRequired || authError)

    if (!hasAuthMessage) {
      return
    }

    if (authRequired) {
      toast.error("Lead login required.")
    }

    if (authError) {
      const message = getAuthErrorMessage(authError)

      logAuthError("Sign-in failed in browser", {
        authError,
        message,
        detail: authDetail,
      })

      toast.error(message, authDetail ? { description: authDetail } : undefined)
    }

    const url = new URL(globalThis.location.href)
    url.searchParams.delete("authRequired")
    url.searchParams.delete("authError")
    url.searchParams.delete("authDetail")
    globalThis.history.replaceState({}, "", `${url.pathname}${url.search}`)
  }, [searchParams])

  return null
}

export function AuthNotifications() {
  return (
    <>
      <Toaster />
      <Suspense fallback={null}>
        <AuthNotificationsInner />
      </Suspense>
    </>
  )
}
