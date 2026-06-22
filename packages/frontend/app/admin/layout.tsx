"use client"

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/admin/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()

  const getBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean)

    if (pathname === "/admin") {
      return (
        <>
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </>
      )
    }

    return (
      <>
        <BreadcrumbItem>
          <BreadcrumbLink href="/admin">Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        {paths.slice(1).map((path, index) => {
          const isLast = index === paths.length - 2
          const href = "/" + paths.slice(0, index + 2).join("/")
          const title = path.charAt(0).toUpperCase() + path.slice(1)

          return (
            <div key={path} className="flex items-center gap-2">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{title}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          )
        })}
      </>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-x-hidden">
        <header className="flex h-auto sm:h-16 shrink-0 items-center gap-2 border-b px-3 sm:px-4 py-2 sm:py-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-x-hidden">
          <SidebarTrigger className="-ml-1 flex-shrink-0" />
          <Separator orientation="vertical" className="mr-2 h-4 hidden sm:block" />
          <Breadcrumb className="flex-1 min-w-0 overflow-x-hidden">
            <BreadcrumbList className="flex-wrap">
              {getBreadcrumbs()}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex shrink-0 items-center">
            <ThemeToggle />
          </div>
        </header>
        <div className="relative flex flex-1 flex-col gap-4 p-3 sm:p-4 md:gap-6 md:p-6 lg:p-8 overflow-x-hidden w-full max-w-full">
          <div className="w-full max-w-full overflow-x-hidden min-w-0">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
