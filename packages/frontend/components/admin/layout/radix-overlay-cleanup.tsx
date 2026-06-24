"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { releaseRadixOverlayLock } from "@/lib/release-radix-overlay-lock"

/** Prevent Radix dropdown/dialog stacks from leaving the admin shell unclickable. */
export function RadixOverlayCleanup() {
  const pathname = usePathname()

  useEffect(() => {
    releaseRadixOverlayLock()
  }, [pathname])

  return null
}
