'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { Files, FolderOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { ChatLegalMark } from '@/components/mark'
import { SignOutControl } from '@/components/sign-out-control'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'

/**
 * Left nav. Matters and Work are placeholders.
 * Adapted from dcolley/tourbillon@7a8595b apps/web/components/dashboard-sidebar.tsx
 * without the company switcher — personal Consumer accounts only.
 */

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/matters', label: 'Matters', icon: FolderOpen },
  { href: '/work', label: 'Work', icon: Files },
]

function isActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarCookieSync() {
  const { setOpen } = useSidebar()

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]+)/)
    if (match) setOpen(match[1] === 'true')
  }, [setOpen])

  return null
}

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <>
      <SidebarCookieSync />
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/" />}
                className="data-[slot=sidebar-menu-button]:!p-1.5"
              >
                <ChatLegalMark />
                <span className="font-serif text-base font-semibold tracking-tight">ChatLegal</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const active = isActive(item.href, pathname)
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton render={<Link href={item.href} />} isActive={active} tooltip={item.label}>
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center">
            <UserButton />
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-xs font-medium">Personal account</p>
              <SignOutControl />
            </div>
            <ThemeToggle />
          </div>
          <SidebarSeparator />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </>
  )
}
