"use client"

import { useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
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
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (isMounted) {
        setUser(currentUser)
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  return {
    user,
    loading,
    email: user?.email ?? "",
    displayName: getDisplayName(user),
  }
}
