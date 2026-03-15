'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarNav } from './sidebar-nav'

export function TopHeader() {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b bg-background px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSheetOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <span className="text-sm font-semibold">Fitness Tracker</span>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label="Logout"
          data-testid="header-logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <SidebarNav open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}
