import { cn } from '@/lib/utils'

type SectionHeadingProps = {
  children: React.ReactNode
  className?: string
}

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <h2 className={cn('text-lg font-semibold tracking-tight', className)}>
      {children}
    </h2>
  )
}
