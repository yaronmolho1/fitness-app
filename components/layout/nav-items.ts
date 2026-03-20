import {
  LayoutDashboard,
  Dumbbell,
  Activity,
  CalendarDays,
  TrendingUp,
  ListChecks,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Today', icon: LayoutDashboard },
  { href: '/exercises', label: 'Exercises', icon: Dumbbell },
  { href: '/mesocycles', label: 'Mesocycles', icon: Activity },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/progression', label: 'Progression', icon: TrendingUp },
  { href: '/routines', label: 'Routines', icon: ListChecks },
]
