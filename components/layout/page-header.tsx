import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  description?: string
  breadcrumb?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn(className)}>
      {breadcrumb && (
        <div data-slot="breadcrumb" className="mb-2">
          {breadcrumb}
        </div>
      )}
      <div
        data-slot="header-row"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div data-slot="title-block" className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div data-slot="actions" className="shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
