"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Clock,
  LayoutDashboard,
  Calendar,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  BarChart2,
  ClipboardList,
  CalendarRange,
  Sparkles,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"
import { SetupTermWizard } from "@/components/admin/terms/setup-term-wizard"
import { useAdminSession } from "@/hooks/use-admin-session"

const navMain = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
]

const navManage = [
  { title: "Students", href: "/admin/students", icon: GraduationCap },
  { title: "Terms", href: "/admin/terms", icon: BookOpen },
  { title: "Schedules", href: "/admin/schedules", icon: Calendar },
  { title: "Timesheet Verification", href: "/admin/timesheet-verification", icon: Clock },
  { title: "Admin Access", href: "/admin/access", icon: ShieldCheck },
]

const navAnalytics = [
  { title: "Term Analytics", href: "/admin/analytics/term", icon: BarChart2 },
  { title: "Student Records", href: "/admin/studentrecords", icon: ClipboardList },
  { title: "Group Schedule", href: "/admin/analytics/group-schedule", icon: CalendarRange },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [setupOpen, setSetupOpen] = useState(false)
  const { displayName, email } = useAdminSession()

  return (
    <>
    <Sidebar collapsible="icon" variant="inset" className="bg-sidebar text-sidebar-foreground">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded bg-accent text-accent-foreground">
                  <Clock className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold tracking-tight text-sidebar-foreground">SD-CLOCKEDIN</span>
                  <span className="text-xs text-sidebar-foreground/80">Admin Panel</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-widest">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-widest">Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navManage.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-widest">Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navAnalytics.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Set up working term"
              className="bg-accent/10 text-accent hover:bg-accent/15 hover:text-accent"
              onClick={() => setSetupOpen(true)}
            >
              <Sparkles className="size-4" />
              <span>Set up working term</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser
          user={{
            name: displayName,
            email,
            avatar: "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
    <SetupTermWizard open={setupOpen} onOpenChange={setSetupOpen} />
    </>
  )
}
