import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDelete, mockCalendarDelete, mockCalendarFn, mockCreateOAuth2Client } = vi.hoisted(() => {
  const mockCalendarDelete = vi.fn()
  const mockCalendarFn = vi.fn().mockReturnValue({
    calendars: { delete: (...args: unknown[]) => mockCalendarDelete(...args) },
  })
  return {
    mockDelete: vi.fn(),
    mockCalendarDelete,
    mockCalendarFn,
    mockCreateOAuth2Client: vi.fn().mockReturnValue({ setCredentials: vi.fn() }),
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  google_credentials: { id: 'google_credentials' },
  google_calendar_events: { id: 'google_calendar_events' },
}))

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials = vi.fn()
      },
    },
    calendar: mockCalendarFn,
  },
}))

vi.mock('./client', () => ({
  createOAuth2Client: mockCreateOAuth2Client,
}))

vi.mock('./queries', () => ({
  getGoogleCredentials: vi.fn(),
}))

import { disconnectGoogle } from './actions'
import { getGoogleCredentials } from './queries'

const mockedGetCreds = vi.mocked(getGoogleCredentials)

describe('lib/google/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDelete.mockReturnValue(Promise.resolve())
    mockCalendarFn.mockReturnValue({
      calendars: { delete: (...args: unknown[]) => mockCalendarDelete(...args) },
    })
    mockCreateOAuth2Client.mockReturnValue({ setCredentials: vi.fn() })
  })

  describe('disconnectGoogle', () => {
    it('returns { success: false } when no credentials exist', async () => {
      mockedGetCreds.mockResolvedValue(null)
      const result = await disconnectGoogle()
      expect(result).toEqual({ success: false, error: 'not_connected' })
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('deletes credentials from DB', async () => {
      mockedGetCreds.mockResolvedValue({
        id: 1,
        access_token: 'tok',
        refresh_token: 'ref',
        token_type: 'Bearer',
        expiry_date: new Date(),
        scope: 'https://www.googleapis.com/auth/calendar',
        calendar_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      })

      const result = await disconnectGoogle()
      expect(result).toEqual({ success: true })
      expect(mockDelete).toHaveBeenCalled()
    })

    it('attempts to delete Google calendar when calendar_id exists and deleteCalendar is true', async () => {
      mockedGetCreds.mockResolvedValue({
        id: 1,
        access_token: 'tok',
        refresh_token: 'ref',
        token_type: 'Bearer',
        expiry_date: new Date(),
        scope: 'https://www.googleapis.com/auth/calendar',
        calendar_id: 'cal-abc',
        created_at: new Date(),
        updated_at: new Date(),
      })
      mockCalendarDelete.mockResolvedValue({})

      const result = await disconnectGoogle({ deleteCalendar: true })
      expect(result).toEqual({ success: true })
      expect(mockCalendarDelete).toHaveBeenCalledWith({ calendarId: 'cal-abc' })
    })

    it('still succeeds if calendar deletion fails (best-effort)', async () => {
      mockedGetCreds.mockResolvedValue({
        id: 1,
        access_token: 'tok',
        refresh_token: 'ref',
        token_type: 'Bearer',
        expiry_date: new Date(),
        scope: 'https://www.googleapis.com/auth/calendar',
        calendar_id: 'cal-abc',
        created_at: new Date(),
        updated_at: new Date(),
      })
      mockCalendarDelete.mockRejectedValue(new Error('API error'))

      const result = await disconnectGoogle({ deleteCalendar: true })
      expect(result).toEqual({ success: true })
      expect(mockDelete).toHaveBeenCalled()
    })

    it('does not call calendar API when deleteCalendar is false', async () => {
      mockedGetCreds.mockResolvedValue({
        id: 1,
        access_token: 'tok',
        refresh_token: 'ref',
        token_type: 'Bearer',
        expiry_date: new Date(),
        scope: 'https://www.googleapis.com/auth/calendar',
        calendar_id: 'cal-abc',
        created_at: new Date(),
        updated_at: new Date(),
      })

      const result = await disconnectGoogle({ deleteCalendar: false })
      expect(result).toEqual({ success: true })
      expect(mockCalendarDelete).not.toHaveBeenCalled()
    })
  })
})
