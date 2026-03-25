// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { SummaryPreview } from './summary-preview'
import type { SubjectiveState } from './subjective-state-form'

afterEach(cleanup)

const defaultState: SubjectiveState = {
  fatigue: 3,
  soreness: 2,
  sleepQuality: 4,
  currentInjuries: '',
  notes: '',
}

const mockMarkdown = `# Coaching Summary

## Athlete Profile
- Age: 30
- Weight: 85kg

## Current Plan
Active mesocycle: Hypertrophy Block`

function mockFetchSuccess(markdown: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ markdown }),
  })
}

function mockFetchError(status: number, message: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
  })
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new Error('Network error'))
}

describe('SummaryPreview', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchSuccess(mockMarkdown))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders generate button', () => {
      render(<SummaryPreview subjectiveState={defaultState} />)
      expect(screen.getByRole('button', { name: /generate summary/i })).toBeInTheDocument()
    })

    it('does not show preview or copy button initially', () => {
      render(<SummaryPreview subjectiveState={defaultState} />)
      expect(screen.queryByTestId('summary-preview')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('disables button and shows loading text while fetching', async () => {
      // Never-resolving fetch to keep loading state
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
      const user = userEvent.setup()
      render(<SummaryPreview subjectiveState={defaultState} />)

      await user.click(screen.getByRole('button', { name: /generate summary/i }))

      const button = screen.getByRole('button', { name: /generating/i })
      expect(button).toBeDisabled()
    })
  })

  describe('successful generation', () => {
    it('displays markdown in pre block after fetch', async () => {
      const user = userEvent.setup()
      render(<SummaryPreview subjectiveState={defaultState} />)

      await user.click(screen.getByRole('button', { name: /generate summary/i }))

      await waitFor(() => {
        const pre = screen.getByTestId('summary-preview')
        expect(pre.textContent).toBe(mockMarkdown)
        expect(pre.tagName).toBe('PRE')
      })
    })

    it('shows copy button after generation', async () => {
      const user = userEvent.setup()
      render(<SummaryPreview subjectiveState={defaultState} />)

      await user.click(screen.getByRole('button', { name: /generate summary/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
      })
    })

    it('sends correct request body', async () => {
      const fetchMock = mockFetchSuccess(mockMarkdown)
      vi.stubGlobal('fetch', fetchMock)
      const user = userEvent.setup()
      const state: SubjectiveState = {
        fatigue: 3,
        soreness: 2,
        sleepQuality: 4,
        currentInjuries: 'Sore knee',
        notes: 'Feeling tired',
      }
      render(<SummaryPreview subjectiveState={state} />)

      await user.click(screen.getByRole('button', { name: /generate summary/i }))

      expect(fetchMock).toHaveBeenCalledWith('/api/coaching/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fatigue: 3,
          soreness: 2,
          sleep: 4,
          injuries: 'Sore knee',
          notes: 'Feeling tired',
        }),
      })
    })

    it('re-enables generate button after fetch completes', async () => {
      const user = userEvent.setup()
      render(<SummaryPreview subjectiveState={defaultState} />)

      await user.click(screen.getByRole('button', { name: /generate summary/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate summary/i })).toBeEnabled()
      })
    })
  })

  describe('copy to clipboard', () => {
    it('copies markdown to clipboard on click', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      render(<SummaryPreview subjectiveState={defaultState} />)

      fireEvent.click(screen.getByRole('button', { name: /generate summary/i }))
      await waitFor(() => screen.getByRole('button', { name: /copy/i }))

      // Define after render — userEvent.setup() overrides navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      })

      fireEvent.click(screen.getByRole('button', { name: /copy/i }))

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(mockMarkdown)
      })
    })

    it('shows error when clipboard API fails', async () => {
      render(<SummaryPreview subjectiveState={defaultState} />)

      fireEvent.click(screen.getByRole('button', { name: /generate summary/i }))
      await waitFor(() => screen.getByRole('button', { name: /copy/i }))

      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('Clipboard blocked')) },
        writable: true,
        configurable: true,
      })

      fireEvent.click(screen.getByRole('button', { name: /copy/i }))

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert')
        const copyAlert = alerts.find((a) => a.textContent?.includes('clipboard'))
        expect(copyAlert).toBeTruthy()
      })
    })

    it('shows check icon feedback after copy', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      })
      const user = userEvent.setup()
      render(<SummaryPreview subjectiveState={defaultState} />)

      await user.click(screen.getByRole('button', { name: /generate summary/i }))
      await waitFor(() => screen.getByRole('button', { name: /copy/i }))
      fireEvent.click(screen.getByRole('button', { name: /copy/i }))

      await waitFor(() => {
        expect(screen.getByTestId('copy-check-icon')).toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('shows error message on API error', async () => {
      vi.stubGlobal('fetch', mockFetchError(500, 'Internal server error'))
      const user = userEvent.setup()
      render(<SummaryPreview subjectiveState={defaultState} />)

      await user.click(screen.getByRole('button', { name: /generate summary/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to generate/i)
      })
    })

    it('shows error message on network failure', async () => {
      vi.stubGlobal('fetch', mockFetchNetworkError())
      const user = userEvent.setup()
      render(<SummaryPreview subjectiveState={defaultState} />)

      await user.click(screen.getByRole('button', { name: /generate summary/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to generate/i)
      })
    })

    it('re-enables button after error', async () => {
      vi.stubGlobal('fetch', mockFetchError(500, 'error'))
      const user = userEvent.setup()
      render(<SummaryPreview subjectiveState={defaultState} />)

      await user.click(screen.getByRole('button', { name: /generate summary/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate summary/i })).toBeEnabled()
      })
    })
  })
})
