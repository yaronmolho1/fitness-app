import Link from 'next/link'
import { formatDateBanner } from '@/lib/date-format'

export function RetroactiveDateBanner({
  date,
  today,
}: {
  date?: string
  today: string
}) {
  if (!date || date === today) return null

  return (
    <div
      data-testid="retroactive-banner"
      className="rounded-lg bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-400"
    >
      <div className="flex items-center justify-between gap-3">
        <span>Logging for {formatDateBanner(date)}</span>
        <Link
          href="/calendar"
          className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-300"
        >
          Back to Calendar
        </Link>
      </div>
    </div>
  )
}
