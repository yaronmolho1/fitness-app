'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Dumbbell,
  CalendarDays,
  TrendingUp,
  ListChecks,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Today', icon: LayoutDashboard },
  { href: '/exercises', label: 'Exercises', icon: Dumbbell },
  { href: '/mesocycles', label: 'Mesocycles', icon: Activity },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/progression', label: 'Progression', icon: TrendingUp },
  { href: '/routines', label: 'Routines', icon: ListChecks },
] as const

export function BottomBar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex md:hidden border-t bg-background z-50">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
            isActive(href)
              ? 'text-primary'
              : 'text-muted-foreground'
          )}
        >
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
