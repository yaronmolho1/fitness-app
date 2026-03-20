import { cn } from '@/lib/utils'

type SectionHeadingProps = React.ComponentProps<'h2'>

export function SectionHeading({ children, className, ...rest }: SectionHeadingProps) {
  return (
    <h2 className={cn('mt-8 mb-4 text-lg font-semibold tracking-tight', className)} {...rest}>
      {children}
    </h2>
  )
}
