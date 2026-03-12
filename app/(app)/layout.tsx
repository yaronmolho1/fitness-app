export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="app-shell" className="flex min-h-dvh">
      {/* Nav shell placeholder — implemented in T012 */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
