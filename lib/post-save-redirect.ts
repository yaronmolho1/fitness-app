import { toast } from 'sonner'
import { formatDateToast } from '@/lib/date-format'

type PostSaveRedirectOptions = {
  date: string | undefined
  today: string
  push: (url: string) => void
}

// After workout save: retroactive dates get toast + calendar redirect, today's flow unchanged
export function handlePostSaveRedirect({ date, today, push }: PostSaveRedirectOptions) {
  if (!date || date === today) return

  const month = date.slice(0, 7) // YYYY-MM
  toast.success(`Workout logged for ${formatDateToast(date)}`)
  push(`/calendar?month=${month}`)
}
