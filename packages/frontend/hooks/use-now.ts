"use client"

import { useSyncExternalStore } from "react"

interface NowStore {
  snapshot: Date
  subscribe: Parameters<typeof useSyncExternalStore>[0]
}

const stores = new Map<number, NowStore>()

function getStore(tickMs: number): NowStore {
  let store = stores.get(tickMs)
  if (!store) {
    const created: NowStore = {
      snapshot: new Date(),
      subscribe: (onChange) => {
        created.snapshot = new Date()
        const interval = setInterval(() => {
          created.snapshot = new Date()
          onChange()
        }, tickMs)
        return () => clearInterval(interval)
      },
    }
    stores.set(tickMs, created)
    store = created
  }
  return store
}

/**
 * Current time, re-rendering every `tickMs`.
 * Null during SSR/hydration so server and client markup match.
 */
export function useNow(tickMs: number): Date | null {
  const store = getStore(tickMs)
  return useSyncExternalStore(
    store.subscribe,
    () => store.snapshot,
    () => null,
  )
}
