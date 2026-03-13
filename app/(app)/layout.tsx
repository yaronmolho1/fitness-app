import { Sidebar } from '@/components/sidebar'
import { BottomBar } from '@/components/bottom-bar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="app-shell" className="flex min-h-dvh">
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomBar />
    </div>
  )
}
