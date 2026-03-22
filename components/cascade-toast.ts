import { toast } from 'sonner'
import type { CascadeScope, CascadeSummary } from '@/lib/templates/cascade-types'

// Fire appropriate toast after cascade operation completes
export function fireCascadeToast(scope: CascadeScope, summary: CascadeSummary) {
  if (scope === 'this-only') {
    toast.success('Template updated')
    return
  }

  if (summary.skipped > 0) {
    toast.warning(`${summary.updated} updated, ${summary.skipped} skipped — has logs`)
    return
  }

  const n = summary.updated
  toast.success(`${n} template${n !== 1 ? 's' : ''} updated`)
}
