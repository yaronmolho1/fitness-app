// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLogAsPlanned } from './use-log-as-planned'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

describe('useLogAsPlanned', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with showButton=true when not already saved', () => {
    const { result } = renderHook(() => useLogAsPlanned({ saved: false }))
    expect(result.current.showButton).toBe(true)
  })

  it('starts with showButton=false when already saved', () => {
    const { result } = renderHook(() => useLogAsPlanned({ saved: true }))
    expect(result.current.showButton).toBe(false)
  })

  it('hides button after markModified is called', () => {
    const { result } = renderHook(() => useLogAsPlanned({ saved: false }))
    act(() => result.current.markModified())
    expect(result.current.showButton).toBe(false)
  })

  it('stays hidden once modified — never returns to true', () => {
    const { result } = renderHook(() => useLogAsPlanned({ saved: false }))
    act(() => result.current.markModified())
    expect(result.current.showButton).toBe(false)
    // Even if we do nothing else, still false
    expect(result.current.showButton).toBe(false)
  })

  it('handleLogAsPlanned scrolls to default selector', () => {
    const scrollIntoViewMock = vi.fn()
    const el = { scrollIntoView: scrollIntoViewMock } as unknown as HTMLElement
    vi.spyOn(document, 'querySelector').mockReturnValue(el)

    const { result } = renderHook(() => useLogAsPlanned({ saved: false }))
    act(() => result.current.handleLogAsPlanned())

    expect(document.querySelector).toHaveBeenCalledWith('[data-testid="rating-notes-section"]')
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })

  it('handleLogAsPlanned scrolls to custom selector', () => {
    const scrollIntoViewMock = vi.fn()
    const el = { scrollIntoView: scrollIntoViewMock } as unknown as HTMLElement
    vi.spyOn(document, 'querySelector').mockReturnValue(el)

    const { result } = renderHook(() =>
      useLogAsPlanned({ saved: false, scrollSelector: '[data-testid="feeling-notes-section"]' })
    )
    act(() => result.current.handleLogAsPlanned())

    expect(document.querySelector).toHaveBeenCalledWith('[data-testid="feeling-notes-section"]')
  })

  it('handleLogAsPlanned shows toast', async () => {
    const { toast } = await import('sonner')
    const el = { scrollIntoView: vi.fn() } as unknown as HTMLElement
    vi.spyOn(document, 'querySelector').mockReturnValue(el)

    const { result } = renderHook(() => useLogAsPlanned({ saved: false }))
    act(() => result.current.handleLogAsPlanned())

    expect(toast.info).toHaveBeenCalledWith('Review and save when ready.')
  })

  it('handleLogAsPlanned works when target section not found', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(null)
    const { result } = renderHook(() => useLogAsPlanned({ saved: false }))
    expect(() => act(() => result.current.handleLogAsPlanned())).not.toThrow()
  })
})
