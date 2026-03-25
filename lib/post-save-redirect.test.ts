// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { handlePostSaveRedirect } from './post-save-redirect'

describe('handlePostSaveRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows toast and navigates to calendar for retroactive date', () => {
    handlePostSaveRedirect({
      date: '2026-03-20',
      today: '2026-03-25',
      push: mockPush,
    })

    expect(toast.success).toHaveBeenCalledWith('Workout logged for 20/Mar')
    expect(mockPush).toHaveBeenCalledWith('/calendar?month=2026-03')
  })

  it('does nothing for today flow (no date param)', () => {
    handlePostSaveRedirect({
      date: undefined,
      today: '2026-03-25',
      push: mockPush,
    })

    expect(toast.success).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does nothing when date equals today', () => {
    handlePostSaveRedirect({
      date: '2026-03-25',
      today: '2026-03-25',
      push: mockPush,
    })

    expect(toast.success).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('navigates to correct month for cross-month retroactive date', () => {
    handlePostSaveRedirect({
      date: '2026-02-28',
      today: '2026-03-05',
      push: mockPush,
    })

    expect(toast.success).toHaveBeenCalledWith('Workout logged for 28/Feb')
    expect(mockPush).toHaveBeenCalledWith('/calendar?month=2026-02')
  })
})
