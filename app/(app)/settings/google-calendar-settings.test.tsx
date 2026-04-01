// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: refreshMock })),
}))

vi.mock('@/lib/google/actions', () => ({
  disconnectGoogle: vi.fn(),
}))

import { disconnectGoogle } from '@/lib/google/actions'
import { GoogleCalendarSettings } from './google-calendar-settings'

describe('GoogleCalendarSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('disconnected state', () => {
    it('shows "Connect Google Calendar" button when not connected', () => {
      render(<GoogleCalendarSettings connected={false} timezone={null} />)
      expect(screen.getByRole('link', { name: /connect google calendar/i })).toBeInTheDocument()
    })

    it('links connect button to /api/auth/google', () => {
      render(<GoogleCalendarSettings connected={false} timezone={null} />)
      const link = screen.getByRole('link', { name: /connect google calendar/i })
      expect(link).toHaveAttribute('href', '/api/auth/google')
    })

    it('does not show disconnect button when disconnected', () => {
      render(<GoogleCalendarSettings connected={false} timezone={null} />)
      expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument()
    })

    it('does not show connected badge when disconnected', () => {
      render(<GoogleCalendarSettings connected={false} timezone={null} />)
      expect(screen.queryByText(/connected/i)).not.toBeInTheDocument()
    })
  })

  describe('connected state', () => {
    it('shows connected badge', () => {
      render(<GoogleCalendarSettings connected={true} timezone="America/New_York" />)
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('shows timezone from athlete profile', () => {
      render(<GoogleCalendarSettings connected={true} timezone="America/New_York" />)
      expect(screen.getByText('America/New_York')).toBeInTheDocument()
    })

    it('shows disconnect button', () => {
      render(<GoogleCalendarSettings connected={true} timezone="America/New_York" />)
      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
    })

    it('does not show connect button when connected', () => {
      render(<GoogleCalendarSettings connected={true} timezone="America/New_York" />)
      expect(screen.queryByRole('link', { name: /connect google calendar/i })).not.toBeInTheDocument()
    })
  })

  describe('disconnect flow', () => {
    it('shows confirmation dialog when disconnect is clicked', async () => {
      render(<GoogleCalendarSettings connected={true} timezone="America/New_York" />)
      fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
      })
    })

    it('calls disconnectGoogle when confirmed', async () => {
      vi.mocked(disconnectGoogle).mockResolvedValue({ success: true })
      render(<GoogleCalendarSettings connected={true} timezone="America/New_York" />)

      fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }))
      await waitFor(() => {
        expect(disconnectGoogle).toHaveBeenCalled()
      })
    })

    it('can cancel the disconnect dialog', async () => {
      render(<GoogleCalendarSettings connected={true} timezone="America/New_York" />)
      fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      await waitFor(() => {
        expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('sync status display', () => {
    it('AC25: shows synced/pending/failed counts when connected', () => {
      render(
        <GoogleCalendarSettings
          connected={true}
          timezone="America/New_York"
          syncStatus={{ synced: 20, pending: 2, error: 1, lastSyncedAt: '2026-03-30T10:00:00.000Z' }}
        />
      )
      expect(screen.getByText('20')).toBeInTheDocument()
      expect(screen.getByText('synced')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('pending')).toBeInTheDocument()
    })

    it('AC25: shows last sync timestamp', () => {
      render(
        <GoogleCalendarSettings
          connected={true}
          timezone="America/New_York"
          syncStatus={{ synced: 20, pending: 0, error: 0, lastSyncedAt: '2026-03-30T10:00:00.000Z' }}
        />
      )
      expect(screen.getByText(/last sync/i)).toBeInTheDocument()
    })

    it('does not show sync status when disconnected', () => {
      render(<GoogleCalendarSettings connected={false} timezone={null} />)
      expect(screen.queryByText(/synced/i)).not.toBeInTheDocument()
    })

    it('shows re-sync button when there are failed events', () => {
      render(
        <GoogleCalendarSettings
          connected={true}
          timezone="America/New_York"
          syncStatus={{ synced: 10, pending: 0, error: 3, lastSyncedAt: null }}
        />
      )
      expect(screen.getByRole('button', { name: /retry failed/i })).toBeInTheDocument()
    })

    it('does not show retry-failed button when no failed events', () => {
      render(
        <GoogleCalendarSettings
          connected={true}
          timezone="America/New_York"
          syncStatus={{ synced: 10, pending: 0, error: 0, lastSyncedAt: null }}
        />
      )
      expect(screen.queryByRole('button', { name: /retry failed/i })).not.toBeInTheDocument()
      // Full re-sync is always visible
      expect(screen.getByRole('button', { name: /full re-sync/i })).toBeInTheDocument()
    })
  })

  describe('error message', () => {
    it('shows error message when provided', () => {
      render(<GoogleCalendarSettings connected={false} timezone={null} error="access_denied" />)
      expect(screen.getByText(/access_denied/i)).toBeInTheDocument()
    })

    it('does not show error when not provided', () => {
      render(<GoogleCalendarSettings connected={false} timezone={null} />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
