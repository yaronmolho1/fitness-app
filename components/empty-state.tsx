import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  message: string
  description?: string
  icon?: LucideIcon
  action?: {
    label: string
    href: string
  }
}

export function EmptyState({ message, description, icon: Icon, action }: EmptyStateProps) {
  return (
    <div className="py-12 text-center text-muted-foreground">
      {Icon && (
        <div data-testid="empty-state-icon" className="mb-3 flex justify-center">
          <Icon className="h-10 w-10 opacity-40" />
        </div>
      )}
      <p className="text-lg font-medium">{message}</p>
      {description && <p className="mt-1">{description}</p>}
      {action && (
        <div className="mt-4">
          <Button asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
