import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockSelect = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  google_credentials: { id: 'id' },
  google_calendar_events: {
    mesocycle_id: 'mesocycle_id',
    schedule_entry_id: 'schedule_entry_id',
    event_date: 'event_date',
  },
}))

import {
  getGoogleCredentials,
  isGoogleConnected,
  getEventMapping,
  getEventsByMesocycle,
  getSyncStatus,
} from './queries'

describe('lib/google/queries', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
  })

  describe('getGoogleCredentials', () => {
    it('returns null when no credentials exist', async () => {
      mockFrom.mockResolvedValue([])
      const result = await getGoogleCredentials()
      expect(result).toBeNull()
    })

    it('returns credentials when they exist', async () => {
      const creds = {
        id: 1,
        access_token: 'tok',
        refresh_token: 'ref',
        token_type: 'Bearer',
        expiry_date: new Date(),
        scope: 'https://www.googleapis.com/auth/calendar',
        calendar_id: 'cal-123',
        created_at: new Date(),
        updated_at: new Date(),
      }
      mockFrom.mockResolvedValue([creds])
      const result = await getGoogleCredentials()
      expect(result).toEqual(creds)
    })
  })

  describe('isGoogleConnected', () => {
    it('returns false when no credentials', async () => {
      mockFrom.mockResolvedValue([])
      const result = await isGoogleConnected()
      expect(result).toBe(false)
    })

    it('returns true when credentials exist', async () => {
      mockFrom.mockResolvedValue([{ id: 1 }])
      const result = await isGoogleConnected()
      expect(result).toBe(true)
    })
  })

  describe('getEventMapping', () => {
    it('returns null when no mapping exists', async () => {
      mockWhere.mockResolvedValue([])
      const result = await getEventMapping(1, 10, '2026-03-29')
      expect(result).toBeNull()
    })

    it('returns event mapping when found', async () => {
      const event = {
        id: 1,
        google_event_id: 'gev-1',
        mesocycle_id: 1,
        schedule_entry_id: 10,
        event_date: '2026-03-29',
        summary: 'Push A',
        start_time: '07:00',
        end_time: '08:30',
        sync_status: 'synced',
      }
      mockWhere.mockResolvedValue([event])
      const result = await getEventMapping(1, 10, '2026-03-29')
      expect(result).toEqual(event)
    })
  })

  describe('getEventsByMesocycle', () => {
    it('returns empty array when no events', async () => {
      mockWhere.mockResolvedValue([])
      const result = await getEventsByMesocycle(1)
      expect(result).toEqual([])
    })

    it('returns all events for mesocycle', async () => {
      const events = [
        { id: 1, google_event_id: 'gev-1', mesocycle_id: 1 },
        { id: 2, google_event_id: 'gev-2', mesocycle_id: 1 },
      ]
      mockWhere.mockResolvedValue(events)
      const result = await getEventsByMesocycle(1)
      expect(result).toEqual(events)
      expect(result).toHaveLength(2)
    })
  })

  describe('getSyncStatus', () => {
    it('returns zero counts when no events', async () => {
      mockFrom.mockResolvedValue([])
      const result = await getSyncStatus()
      expect(result).toEqual({ synced: 0, pending: 0, error: 0, lastSyncedAt: null })
    })

    it('returns counts grouped by sync_status', async () => {
      mockFrom.mockResolvedValue([
        { sync_status: 'synced', last_synced_at: new Date('2026-03-30T10:00:00Z') },
        { sync_status: 'synced', last_synced_at: new Date('2026-03-29T10:00:00Z') },
        { sync_status: 'error', last_synced_at: null },
        { sync_status: 'pending', last_synced_at: null },
      ])
      const result = await getSyncStatus()
      expect(result.synced).toBe(2)
      expect(result.error).toBe(1)
      expect(result.pending).toBe(1)
      expect(result.lastSyncedAt).toBe('2026-03-30T10:00:00.000Z')
    })
  })
})
