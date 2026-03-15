import { MainNav } from '@/components/layout/main-nav'
import { TopHeader } from '@/components/layout/top-header'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="app-shell" className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <MainNav />

      {/* Mobile header + sheet nav */}
      <TopHeader />

      {/* Main content — top padding on mobile for fixed header */}
      <main className="flex-1 pt-14 md:pt-0">{children}</main>
    </div>
  )
}
