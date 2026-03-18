import { cn } from '@/lib/utils'

type PageContainerProps = {
  variant?: 'narrow' | 'wide'
  className?: string
  children: React.ReactNode
}

export function PageContainer({
  variant = 'wide',
  className,
  children,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'px-4 sm:px-6 lg:px-8 py-6 mx-auto overflow-x-hidden',
        variant === 'narrow' ? 'max-w-lg' : 'max-w-4xl',
        className
      )}
    >
      {children}
    </div>
  )
}
