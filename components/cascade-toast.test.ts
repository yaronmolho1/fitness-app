// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'
import { fireCascadeToast, fireBatchCascadeToast } from './cascade-toast'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

describe('fireCascadeToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fires success toast for this-only', () => {
    fireCascadeToast('this-only', { updated: 0, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })
    expect(toast.success).toHaveBeenCalledWith('Template updated')
  })

  it('fires warning toast when skipped > 0', () => {
    fireCascadeToast('all-phases', { updated: 2, skipped: 1, skippedCompleted: 0, skippedNoMatch: 0 })
    expect(toast.warning).toHaveBeenCalledWith('2 updated, 1 skipped — has logs')
  })

  it('fires success with count for multi-template', () => {
    fireCascadeToast('this-and-future', { updated: 3, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })
    expect(toast.success).toHaveBeenCalledWith('3 templates updated')
  })

  it('fires singular for 1 template', () => {
    fireCascadeToast('this-and-future', { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })
    expect(toast.success).toHaveBeenCalledWith('1 template updated')
  })
})

describe('fireBatchCascadeToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fires aggregate success toast for batch results', () => {
    fireBatchCascadeToast('all-phases', {
      updated: 4,
      skipped: 0,
      skippedCompleted: 0,
      skippedNoMatch: 0,
    }, 3)
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('3 exercises')
    )
  })

  it('includes skipped info in warning toast', () => {
    fireBatchCascadeToast('this-and-future', {
      updated: 2,
      skipped: 1,
      skippedCompleted: 0,
      skippedNoMatch: 0,
    }, 2)
    expect(toast.warning).toHaveBeenCalled()
  })

  it('fires simple success for this-only scope', () => {
    fireBatchCascadeToast('this-only', {
      updated: 0,
      skipped: 0,
      skippedCompleted: 0,
      skippedNoMatch: 0,
    }, 3)
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('3 exercises')
    )
  })
})
