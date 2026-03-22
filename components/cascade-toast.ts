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

// Fire aggregate toast after batch cascade completes
export function fireBatchCascadeToast(scope: CascadeScope, summary: CascadeSummary, exerciseCount: number) {
  const exerciseLabel = `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`

  if (scope === 'this-only') {
    toast.success(`${exerciseLabel} updated`)
    return
  }

  if (summary.skipped > 0) {
    toast.warning(`${exerciseLabel} updated across ${summary.updated} template${summary.updated !== 1 ? 's' : ''}, ${summary.skipped} skipped`)
    return
  }

  const n = summary.updated
  toast.success(`${exerciseLabel} updated across ${n} template${n !== 1 ? 's' : ''}`)
}
