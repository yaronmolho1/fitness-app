import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'

type MesocycleStatus = 'planned' | 'active' | 'completed'

const statusConfig: Record<MesocycleStatus, { label: string; variant: BadgeProps['variant']; className?: string }> = {
  planned: { label: 'Planned', variant: 'outline' },
  active: { label: 'Active', variant: 'default' },
  completed: { label: 'Completed', variant: 'secondary', className: 'opacity-70' },
}

export function StatusBadge({
  status,
  className,
}: {
  status: MesocycleStatus
  className?: string
}) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}
