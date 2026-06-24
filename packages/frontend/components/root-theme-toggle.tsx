'use client'

import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'

/** Shared theme toggle for routes without their own header control. */
export function RootThemeToggle() {
  const pathname = usePathname()

  if (pathname === '/' || pathname.startsWith('/admin')) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <ThemeToggle />
    </div>
  )
}
