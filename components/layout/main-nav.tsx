'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { navItems } from './nav-items'

const STORAGE_KEY = 'sidebar-collapsed'

function useLocalStorageFlag(key: string) {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('storage', callback)
    return () => window.removeEventListener('storage', callback)
  }, [])
  const getSnapshot = useCallback(() => localStorage.getItem(key) === 'true', [key])
  const getServerSnapshot = useCallback(() => false, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function MainNav() {
  const pathname = usePathname()
  const router = useRouter()
  const storedCollapsed = useLocalStorageFlag(STORAGE_KEY)
  const [localCollapsed, setLocalCollapsed] = useState<boolean | null>(null)
  const collapsed = localCollapsed ?? storedCollapsed

  function toggleCollapsed() {
    const next = !collapsed
    setLocalCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const isCollapsed = collapsed

  return (
    <aside
      className={cn(
        'hidden md:flex md:flex-col border-r bg-background transition-[width] duration-200',
        isCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Toggle button */}
      <div className={cn('flex p-2', isCollapsed ? 'justify-center' : 'justify-end')}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col flex-1 gap-1 px-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={isCollapsed ? label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isCollapsed && 'justify-center px-0',
              isActive(href)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!isCollapsed && label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          className={cn(
            'w-full gap-3',
            isCollapsed ? 'justify-center px-0' : 'justify-start'
          )}
          onClick={handleLogout}
          title={isCollapsed ? 'Logout' : undefined}
          data-testid="sidebar-logout"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && 'Logout'}
        </Button>
      </div>
    </aside>
  )
}
