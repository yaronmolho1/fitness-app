import { cn } from '@/lib/utils'

type MesocycleStatus = 'planned' | 'active' | 'completed'

const statusStyles: Record<MesocycleStatus, string> = {
  planned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
}

const statusLabels: Record<MesocycleStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
}

export function StatusBadge({
  status,
  className,
}: {
  status: MesocycleStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  )
}
