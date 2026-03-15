'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { navItems } from './nav-items'

export function SidebarNav({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  async function handleLogout() {
    onOpenChange(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Fitness Tracker</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col flex-1 p-4 h-[calc(100%-65px)]">
          <div className="flex flex-col flex-1 gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(href)
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t pt-4 mt-auto">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={handleLogout}
              data-testid="sheet-logout"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
