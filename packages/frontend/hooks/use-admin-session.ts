"use client"

import { useEffect, useState } from "react"
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

function getDisplayName(user: User | null): string {
  if (!user) {
    return "Admin"
  }

  const metadataName =
    typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata.name === "string"
        ? user.user_metadata.name
        : null

  if (metadataName?.trim()) {
    return metadataName.trim()
  }

  const emailLocalPart = user.email?.split("@")[0]
  if (emailLocalPart) {
    return emailLocalPart
  }

  return "Admin"
}

export function useAdminSession() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let subscription: { unsubscribe: () => void } | undefined

    try {
      const supabase = createClient()

      void supabase.auth.getUser().then((response) => {
        if (isMounted) {
          setUser(response.data.user)
          setLoading(false)
        }
      })

      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          setUser(session?.user ?? null)
          setLoading(false)
        },
      )

      subscription = authSubscription
    } catch {
      if (isMounted) {
        setLoading(false)
      }
    }

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  return {
    user,
    loading,
    email: user?.email ?? "",
    displayName: getDisplayName(user),
  }
}
