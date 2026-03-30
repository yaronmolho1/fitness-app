import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GCalEventParams } from './types'

// ── Mock fns ────────────────────────────────────────────────────────────

const mockEventsInsert = vi.fn()
const mockEventsUpdate = vi.fn()
const mockEventsDelete = vi.fn()

// DB chain mocks — configurable per test
const mockSelectAll = vi.fn().mockResolvedValue([])
const mockSelectGet = vi.fn().mockResolvedValue(undefined)
const mockInsertValues = vi.fn()
const mockUpdateSet = vi.fn()
const mockDeleteWhere = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn().mockReturnValue({
      events: {
        insert: (...args: unknown[]) => mockEventsInsert(...args),
        update: (...args: unknown[]) => mockEventsUpdate(...args),
        delete: (...args: unknown[]) => mockEventsDelete(...args),
      },
    }),
    auth: {
      OAuth2: class {
        setCredentials = vi.fn()
        on = vi.fn()
      },
    },
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: (...args: unknown[]) => mockSelectAll(...args),
          get: (...args: unknown[]) => mockSelectGet(...args),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              all: (...args: unknown[]) => mockSelectAll(...args),
            }),
          }),
          orderBy: vi.fn().mockReturnValue({
            all: (...args: unknown[]) => mockSelectAll(...args),
          }),
        }),
        all: (...args: unknown[]) => mockSelectAll(...args),
        get: (...args: unknown[]) => mockSelectGet(...args),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: (...args: unknown[]) => {
        mockInsertValues(...args)
        return {
          returning: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ id: 1 }),
          }),
        }
      },
    }),
    update: vi.fn().mockReturnValue({
      set: (...args: unknown[]) => {
        mockUpdateSet(...args)
        return { where: vi.fn().mockResolvedValue(undefined) }
      },
    }),
    delete: vi.fn().mockReturnValue({
      where: (...args: unknown[]) => {
        mockDeleteWhere(...args)
        return Promise.resolve()
      },
    }),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  google_credentials: { id: 'id', calendar_id: 'calendar_id' },
  google_calendar_events: {
    id: 'id',
    google_event_id: 'google_event_id',
    mesocycle_id: 'mesocycle_id',
    schedule_entry_id: 'schedule_entry_id',
    event_date: 'event_date',
    summary: 'summary',
    start_time: 'start_time',
    end_time: 'end_time',
    sync_status: 'sync_status',
    last_synced_at: 'last_synced_at',
    override_entry_id: 'override_entry_id',
    created_at: 'created_at',
    updated_at: 'updated_at',
  },
  mesocycles: { id: 'id', start_date: 'start_date', end_date: 'end_date' },
  weekly_schedule: {
    id: 'id', mesocycle_id: 'mesocycle_id', day_of_week: 'day_of_week',
    template_id: 'template_id', week_type: 'week_type', time_slot: 'time_slot',
    duration: 'duration', period: 'period',
  },
  workout_templates: { id: 'id', name: 'name', modality: 'modality', mesocycle_id: 'mesocycle_id' },
  exercise_slots: { id: 'id', template_id: 'template_id', exercise_id: 'exercise_id', order: 'order' },
  exercises: { id: 'id', name: 'name' },
  athlete_profile: { id: 'id', timezone: 'timezone' },
  schedule_week_overrides: {
    mesocycle_id: 'mesocycle_id', week_number: 'week_number', day_of_week: 'day_of_week',
  },
}))

const mockGetAuthenticatedClient = vi.fn()
vi.mock('./client', () => ({
  getAuthenticatedClient: (...args: unknown[]) => mockGetAuthenticatedClient(...args),
  createOAuth2Client: vi.fn(),
}))

const mockGetGoogleCredentials = vi.fn()
const mockGetEventsByMesocycle = vi.fn()
const mockGetAthleteTimezone = vi.fn()
vi.mock('./queries', () => ({
  getGoogleCredentials: (...args: unknown[]) => mockGetGoogleCredentials(...args),
  isGoogleConnected: vi.fn(),
  getEventsByMesocycle: (...args: unknown[]) => mockGetEventsByMesocycle(...args),
  getEventMapping: vi.fn(),
  getAthleteTimezone: (...args: unknown[]) => mockGetAthleteTimezone(...args),
}))

// ── Imports (after mocks) ───────────────────────────────────────────────

import {
  buildEventBody,
  syncMesocycle,
  syncScheduleChange,
  syncCompletion,
  retryFailedSyncs,
  MODALITY_COLORS,
} from './sync'

// ── Helpers ─────────────────────────────────────────────────────────────

const fakeCreds = {
  id: 1,
  access_token: 'tok',
  refresh_token: 'ref',
  token_type: 'Bearer',
  expiry_date: new Date(Date.now() + 3600000),
  scope: 'calendar',
  calendar_id: 'cal-123',
  created_at: new Date(),
  updated_at: new Date(),
}

function setupConnected() {
  mockGetGoogleCredentials.mockResolvedValue(fakeCreds)
  mockGetAthleteTimezone.mockResolvedValue('Asia/Jerusalem')
  mockGetAuthenticatedClient.mockResolvedValue({
    setCredentials: vi.fn(),
    on: vi.fn(),
  })
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('lib/google/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://fitness.example.com'
    process.env.GOOGLE_CLIENT_ID = 'test-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback'
  })

  // ── buildEventBody ──────────────────────────────────────────────────

  describe('buildEventBody', () => {
    const baseParams: GCalEventParams = {
      templateName: 'Push A',
      modality: 'resistance',
      date: '2026-04-06',
      timeSlot: '07:00',
      duration: 90,
      weekNumber: 2,
      timezone: 'Asia/Jerusalem',
      appUrl: 'https://fitness.example.com',
      mesocycleId: 1,
      templateId: 10,
      scheduleEntryId: 5,
      exercises: ['Bench Press', 'Overhead Press', 'Lateral Raise'],
    }

    it('AC3: sets title "{Template Name} — Week {N}"', () => {
      const event = buildEventBody(baseParams)
      expect(event.summary).toBe('Push A — Week 2')
    })

    it('AC3: sets correct start/end time in user timezone', () => {
      const event = buildEventBody(baseParams)
      expect(event.start?.dateTime).toBe('2026-04-06T07:00:00')
      expect(event.start?.timeZone).toBe('Asia/Jerusalem')
      expect(event.end?.dateTime).toBe('2026-04-06T08:30:00')
      expect(event.end?.timeZone).toBe('Asia/Jerusalem')
    })

    it('AC3: sets modality-based colorId', () => {
      const event = buildEventBody(baseParams)
      expect(event.colorId).toBe(MODALITY_COLORS.resistance)
    })

    it('AC4: description includes exercise names', () => {
      const event = buildEventBody(baseParams)
      expect(event.description).toContain('Bench Press')
      expect(event.description).toContain('Overhead Press')
      expect(event.description).toContain('Lateral Raise')
    })

    it('AC5: description includes "View workout" link', () => {
      const event = buildEventBody(baseParams)
      expect(event.description).toContain('https://fitness.example.com/?date=2026-04-06')
    })

    it('AC6: description includes "Log workout" link', () => {
      const event = buildEventBody(baseParams)
      expect(event.description).toContain('https://fitness.example.com/?date=2026-04-06&action=log')
    })

    it('AC7: sets extendedProperties.private with mapping IDs', () => {
      const event = buildEventBody(baseParams)
      expect(event.extendedProperties?.private).toEqual({
        mesocycleId: '1',
        templateId: '10',
        eventDate: '2026-04-06',
      })
    })

    it('colorId maps correctly for all modalities', () => {
      expect(MODALITY_COLORS.resistance).toBe('9')
      expect(MODALITY_COLORS.running).toBe('2')
      expect(MODALITY_COLORS.mma).toBe('11')
      expect(MODALITY_COLORS.mixed).toBe('3')
    })

    it('uses fallback colorId for unknown modality', () => {
      const event = buildEventBody({ ...baseParams, modality: 'yoga' })
      expect(event.colorId).toBe('1')
    })

    it('AC14: prepends checkmark when completed', () => {
      const event = buildEventBody({ ...baseParams, completed: true })
      expect(event.summary).toBe('✅ Push A — Week 2')
    })

    it('omits exercise section when no exercises', () => {
      const event = buildEventBody({ ...baseParams, exercises: undefined })
      expect(event.description).not.toContain('Exercises:')
      expect(event.description).toContain('View workout')
    })

    it('omits deep links when appUrl is empty', () => {
      const event = buildEventBody({ ...baseParams, appUrl: '' })
      expect(event.description).not.toContain('View workout')
      expect(event.description).not.toContain('Log workout')
    })

    it('sets source URL from appUrl', () => {
      const event = buildEventBody(baseParams)
      expect(event.source?.url).toBe('https://fitness.example.com')
      expect(event.source?.title).toBe('Fitness App')
    })

    it('omits source when appUrl is empty', () => {
      const event = buildEventBody({ ...baseParams, appUrl: '' })
      expect(event.source).toBeUndefined()
    })
  })

  // ── syncMesocycle ──────────────────────────────────────────────────────

  describe('syncMesocycle', () => {
    it('AC22: returns empty result when Google is not connected', async () => {
      mockGetGoogleCredentials.mockResolvedValue(null)

      const result = await syncMesocycle(1)
      expect(result.created).toBe(0)
      expect(result.failed).toBe(0)
      expect(mockEventsInsert).not.toHaveBeenCalled()
    })

    it('AC1-2: creates events for all projected workouts', async () => {
      setupConnected()

      // Call sequence: mesocycle.get(), schedule.all(), template.get(), exercises.all()
      // The mock chains always flow through the same path, so we use call-order logic
      let getCallCount = 0
      mockSelectGet.mockImplementation(() => {
        getCallCount++
        if (getCallCount === 1) {
          // mesocycle
          return {
            id: 1, name: 'Block 1', start_date: '2026-03-30', end_date: '2026-04-12',
            work_weeks: 2, has_deload: false,
          }
        }
        // template
        return { id: 10, name: 'Push A', modality: 'resistance', mesocycle_id: 1 }
      })

      let allCallCount = 0
      mockSelectAll.mockImplementation(() => {
        allCallCount++
        if (allCallCount === 1) {
          // existing Google Calendar event mappings (empty for clean sync)
          return []
        }
        if (allCallCount === 2) {
          // schedule entries: Mon=0 and Wed=2
          return [
            { id: 5, day_of_week: 0, template_id: 10, week_type: 'normal', time_slot: '07:00', duration: 90 },
            { id: 6, day_of_week: 2, template_id: 10, week_type: 'normal', time_slot: '09:00', duration: 60 },
          ]
        }
        // exercise names for template
        return [{ name: 'Bench Press' }, { name: 'OHP' }]
      })

      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-evt-1' } })

      const result = await syncMesocycle(1)
      // 2 entries x 2 weeks each = 4 events
      expect(result.created).toBe(4)
      expect(result.failed).toBe(0)
    })

    it('AC19: records failure without throwing when API errors', async () => {
      setupConnected()

      let getCallCount = 0
      mockSelectGet.mockImplementation(() => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            id: 1, start_date: '2026-03-30', end_date: '2026-04-05',
            work_weeks: 1, has_deload: false,
          }
        }
        return { id: 10, name: 'Push A', modality: 'resistance', mesocycle_id: 1 }
      })

      let allCallCount = 0
      mockSelectAll.mockImplementation(() => {
        allCallCount++
        if (allCallCount === 1) return [] // existing event mappings
        return [{ id: 5, day_of_week: 0, template_id: 10, week_type: 'normal', time_slot: '07:00', duration: 90 }]
      })

      mockEventsInsert.mockRejectedValue(new Error('API quota exceeded'))

      const result = await syncMesocycle(1)
      expect(result.failed).toBeGreaterThan(0)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toContain('API quota exceeded')
    })

    it('edge: skips schedule entries with null template_id (rest days)', async () => {
      setupConnected()

      mockSelectGet.mockReturnValue({
        id: 1, start_date: '2026-03-30', end_date: '2026-04-05',
        work_weeks: 1, has_deload: false,
      })

      let allCallCount = 0
      mockSelectAll.mockImplementation(() => {
        allCallCount++
        if (allCallCount === 1) return [] // existing event mappings
        return [
          { id: 5, day_of_week: 0, template_id: null, week_type: 'normal', time_slot: '07:00', duration: 90 },
        ]
      })

      const result = await syncMesocycle(1)
      expect(result.created).toBe(0)
      expect(mockEventsInsert).not.toHaveBeenCalled()
    })
  })

  // ── syncScheduleChange ────────────────────────────────────────────────

  describe('syncScheduleChange', () => {
    it('AC22: no-op when Google not connected', async () => {
      mockGetGoogleCredentials.mockResolvedValue(null)

      const result = await syncScheduleChange('assign', 1, ['2026-04-06'])
      expect(result.created).toBe(0)
      expect(mockEventsInsert).not.toHaveBeenCalled()
    })

    it('AC8: assign action creates events for affected dates', async () => {
      setupConnected()
      mockGetEventsByMesocycle.mockResolvedValue([])

      mockSelectGet.mockReturnValue({
        id: 1, start_date: '2026-03-30', end_date: '2026-04-12',
        work_weeks: 2, has_deload: false,
      })

      // schedule entries for the affected days
      mockSelectAll.mockImplementation(() => {
        return [{ id: 5, day_of_week: 0, template_id: 10, week_type: 'normal', time_slot: '07:00', duration: 90 }]
      })

      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-new-1' } })

      const result = await syncScheduleChange('assign', 1, ['2026-04-06', '2026-04-13'])
      expect(result.created).toBe(2)
    })

    it('AC9: remove action deletes events for affected dates', async () => {
      setupConnected()
      mockGetEventsByMesocycle.mockResolvedValue([
        {
          id: 1, google_event_id: 'gcal-evt-1', mesocycle_id: 1,
          schedule_entry_id: 5, override_entry_id: null,
          event_date: '2026-04-06', summary: 'Push A — Week 2',
          start_time: '07:00', end_time: '08:30',
          sync_status: 'synced', last_synced_at: new Date(),
          created_at: new Date(), updated_at: new Date(),
        },
      ])

      mockEventsDelete.mockResolvedValue({})

      mockSelectGet.mockReturnValue({
        id: 1, start_date: '2026-03-30', end_date: '2026-04-12',
        work_weeks: 2, has_deload: false,
      })

      const result = await syncScheduleChange('remove', 1, ['2026-04-06'])
      expect(result.deleted).toBe(1)
    })

    it('AC23: handles 404 on delete gracefully', async () => {
      setupConnected()
      mockGetEventsByMesocycle.mockResolvedValue([
        {
          id: 1, google_event_id: 'gcal-evt-1', mesocycle_id: 1,
          schedule_entry_id: 5, override_entry_id: null,
          event_date: '2026-04-06', summary: 'Push A — Week 2',
          start_time: '07:00', end_time: '08:30',
          sync_status: 'synced', last_synced_at: new Date(),
          created_at: new Date(), updated_at: new Date(),
        },
      ])

      const err = new Error('Not Found') as Error & { code: number }
      err.code = 404
      mockEventsDelete.mockRejectedValue(err)

      mockSelectGet.mockReturnValue({
        id: 1, start_date: '2026-03-30', end_date: '2026-04-12',
        work_weeks: 2, has_deload: false,
      })

      const result = await syncScheduleChange('remove', 1, ['2026-04-06'])
      expect(result.deleted).toBe(1)
      expect(result.failed).toBe(0)
    })
  })

  // ── syncCompletion ────────────────────────────────────────────────────

  describe('syncCompletion', () => {
    it('AC22: no-op when Google not connected', async () => {
      mockGetGoogleCredentials.mockResolvedValue(null)

      const result = await syncCompletion(1, 10, '2026-04-06')
      expect(result.updated).toBe(0)
      expect(mockEventsUpdate).not.toHaveBeenCalled()
    })

    it('AC14: updates event title with checkmark prefix', async () => {
      setupConnected()

      mockSelectAll.mockReturnValue([
        {
          id: 1, google_event_id: 'gcal-evt-1', mesocycle_id: 1,
          schedule_entry_id: 5, event_date: '2026-04-06',
          summary: 'Push A — Week 2', start_time: '07:00', end_time: '08:30',
          sync_status: 'synced',
        },
      ])

      mockEventsUpdate.mockResolvedValue({
        data: { id: 'gcal-evt-1', summary: '✅ Push A — Week 2' },
      })

      const result = await syncCompletion(1, 10, '2026-04-06')
      expect(result.updated).toBe(1)
      expect(mockEventsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            summary: '✅ Push A — Week 2',
          }),
        })
      )
    })

    it('AC15: no-op when no event mapping exists for this workout', async () => {
      setupConnected()

      mockSelectAll.mockReturnValue([])

      const result = await syncCompletion(1, 10, '2026-04-06')
      expect(result.updated).toBe(0)
      expect(result.failed).toBe(0)
      expect(mockEventsUpdate).not.toHaveBeenCalled()
    })

    it('AC23: handles 404/410 on update by recreating event', async () => {
      setupConnected()

      mockSelectAll.mockReturnValue([
        {
          id: 1, google_event_id: 'gcal-evt-1', mesocycle_id: 1,
          schedule_entry_id: 5, event_date: '2026-04-06',
          summary: 'Push A — Week 2', start_time: '07:00', end_time: '08:30',
          sync_status: 'synced',
        },
      ])

      mockSelectGet.mockReturnValue({
        id: 1, start_date: '2026-03-30', end_date: '2026-04-12',
        work_weeks: 2, has_deload: false,
      })

      const err = new Error('Gone') as Error & { code: number }
      err.code = 410
      mockEventsUpdate.mockRejectedValue(err)

      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-evt-new' } })

      const result = await syncCompletion(1, 10, '2026-04-06')
      expect(result.updated).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockEventsInsert).toHaveBeenCalled()
    })
  })

  // ── retryFailedSyncs ──────────────────────────────────────────────────

  describe('retryFailedSyncs', () => {
    it('AC20: returns empty result when Google not connected', async () => {
      mockGetGoogleCredentials.mockResolvedValue(null)

      const result = await retryFailedSyncs()
      expect(result.created).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('AC20: retries events with error sync_status', async () => {
      setupConnected()

      let allCallCount = 0
      mockSelectAll.mockImplementation(() => {
        allCallCount++
        if (allCallCount === 1) {
          // Failed events query
          return [
            {
              id: 1, google_event_id: 'pending-2026-04-06-10-1-1234',
              mesocycle_id: 1, schedule_entry_id: 5,
              event_date: '2026-04-06', summary: 'Push A — Week 2',
              start_time: '07:00', end_time: '08:30',
              sync_status: 'error', last_synced_at: null,
              created_at: new Date(), updated_at: new Date(),
            },
          ]
        }
        return []
      })

      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-new-1' } })

      const result = await retryFailedSyncs()
      expect(result.created).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockEventsInsert).toHaveBeenCalled()
    })

    it('AC20: no-op when no failed events exist', async () => {
      setupConnected()

      mockSelectAll.mockReturnValue([])

      const result = await retryFailedSyncs()
      expect(result.created).toBe(0)
      expect(mockEventsInsert).not.toHaveBeenCalled()
    })

    it('records failure if retry also fails', async () => {
      setupConnected()

      let allCallCount = 0
      mockSelectAll.mockImplementation(() => {
        allCallCount++
        if (allCallCount === 1) {
          return [
            {
              id: 1, google_event_id: 'pending-2026-04-06-10-1-1234',
              mesocycle_id: 1, schedule_entry_id: 5,
              event_date: '2026-04-06', summary: 'Push A — Week 2',
              start_time: '07:00', end_time: '08:30',
              sync_status: 'error', last_synced_at: null,
              created_at: new Date(), updated_at: new Date(),
            },
          ]
        }
        return []
      })

      mockEventsInsert.mockRejectedValue(new Error('Still failing'))

      const result = await retryFailedSyncs()
      expect(result.failed).toBe(1)
      expect(result.errors[0].message).toContain('Still failing')
    })
  })

  // ── Bug fixes (T207 review) ───────────────────────────────────────────

  describe('syncCompletion — templateId filter (bug #1)', () => {
    it('filters by templateId when looking up event mapping', async () => {
      setupConnected()

      let allCallCount = 0
      mockSelectAll.mockImplementation(() => {
        allCallCount++
        if (allCallCount === 1) {
          // First call: schedule entries for mesocycle+templateId=20
          return [{ id: 6 }]
        }
        // Second call: all events for mesocycle+date
        return [
          {
            id: 1, google_event_id: 'gcal-evt-1', mesocycle_id: 1,
            schedule_entry_id: 5, event_date: '2026-04-06',
            summary: 'Push A — Week 2', start_time: '07:00', end_time: '08:30',
            sync_status: 'synced',
          },
          {
            id: 2, google_event_id: 'gcal-evt-2', mesocycle_id: 1,
            schedule_entry_id: 6, event_date: '2026-04-06',
            summary: 'Pull B — Week 2', start_time: '17:00', end_time: '18:30',
            sync_status: 'synced',
          },
        ]
      })

      mockEventsUpdate.mockResolvedValue({
        data: { id: 'gcal-evt-2', summary: '✅ Pull B — Week 2' },
      })

      // Completing templateId=20 (Pull B) — should pick event id=2
      const result = await syncCompletion(1, 20, '2026-04-06')
      expect(result.updated).toBe(1)
      // The update call should use event id 2's google_event_id
      expect(mockEventsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'gcal-evt-2',
          requestBody: expect.objectContaining({
            summary: '✅ Pull B — Week 2',
          }),
        })
      )
    })
  })

  describe('syncMesocycle — idempotency (bug #2)', () => {
    it('deletes existing mappings for the mesocycle before inserting', async () => {
      setupConnected()

      let getCallCount = 0
      mockSelectGet.mockImplementation(() => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            id: 1, name: 'Block 1', start_date: '2026-03-30', end_date: '2026-04-05',
            work_weeks: 1, has_deload: false,
          }
        }
        return { id: 10, name: 'Push A', modality: 'resistance', mesocycle_id: 1 }
      })

      let allCallCount = 0
      mockSelectAll.mockImplementation(() => {
        allCallCount++
        if (allCallCount === 1) return [] // existing event mappings
        return [{ id: 5, day_of_week: 0, template_id: 10, week_type: 'normal', time_slot: '07:00', duration: 90 }]
      })

      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-evt-1' } })

      await syncMesocycle(1)

      // Should call db.delete to clear existing mappings before creating new ones
      expect(mockDeleteWhere).toHaveBeenCalled()
    })
  })

  describe('syncMesocycle — week_type filter (bug #3)', () => {
    it('filters schedule entries by week_type to avoid duplicates', async () => {
      setupConnected()

      // 3-week range: 2 work + 1 deload, all Mondays
      let getCallCount = 0
      mockSelectGet.mockImplementation(() => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            id: 1, name: 'Block 1', start_date: '2026-03-30', end_date: '2026-04-19',
            work_weeks: 2, has_deload: true,
          }
        }
        return { id: 10, name: 'Push A', modality: 'resistance', mesocycle_id: 1 }
      })

      // Both normal and deload entries for same day_of_week
      let allCallCount = 0
      mockSelectAll.mockImplementation(() => {
        allCallCount++
        if (allCallCount === 1) {
          // existing event mappings (empty for clean sync)
          return []
        }
        if (allCallCount === 2) {
          return [
            { id: 5, day_of_week: 0, template_id: 10, week_type: 'normal', time_slot: '07:00', duration: 90 },
            { id: 6, day_of_week: 0, template_id: 10, week_type: 'deload', time_slot: '07:00', duration: 60 },
          ]
        }
        return [{ name: 'Bench Press' }]
      })

      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-evt-1' } })

      const result = await syncMesocycle(1)
      // Mondays: 03-30 (wk1, normal), 04-06 (wk2, normal), 04-13 (wk3, deload)
      // Each week only 1 event → 3 total (not 6 from both entries × 3 dates)
      expect(result.created).toBe(3)
    })
  })

  describe('createEvent — placeholder collision (bug #4)', () => {
    it('uses unique placeholder IDs for failed events', async () => {
      setupConnected()

      let getCallCount = 0
      mockSelectGet.mockImplementation(() => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            id: 1, name: 'Block 1', start_date: '2026-03-30', end_date: '2026-04-05',
            work_weeks: 1, has_deload: false,
          }
        }
        return { id: 10, name: 'Push A', modality: 'resistance', mesocycle_id: 1 }
      })

      // Two entries on same day at different times, both with same template
      let allCallCount = 0
      mockSelectAll.mockImplementation(() => {
        allCallCount++
        if (allCallCount === 1) return [] // existing event mappings
        return [
          { id: 5, day_of_week: 0, template_id: 10, week_type: 'normal', time_slot: '07:00', duration: 90 },
          { id: 6, day_of_week: 0, template_id: 10, week_type: 'normal', time_slot: '17:00', duration: 60 },
        ]
      })

      // Both API calls fail — will generate placeholder IDs
      mockEventsInsert.mockRejectedValue(new Error('API error'))

      await syncMesocycle(1)

      // Collect all placeholder IDs from insert calls
      const placeholderIds = mockInsertValues.mock.calls
        .map((args) => args[0]?.google_event_id)
        .filter((id): id is string => typeof id === 'string' && id.startsWith('pending-'))

      // All placeholder IDs should be unique
      const unique = new Set(placeholderIds)
      expect(unique.size).toBe(placeholderIds.length)
    })
  })

  // ── MODALITY_COLORS ────────────────────────────────────────────────────

  describe('MODALITY_COLORS', () => {
    it('maps resistance to blueberry (9)', () => {
      expect(MODALITY_COLORS.resistance).toBe('9')
    })

    it('maps running to sage (2)', () => {
      expect(MODALITY_COLORS.running).toBe('2')
    })

    it('maps mma to tomato (11)', () => {
      expect(MODALITY_COLORS.mma).toBe('11')
    })

    it('maps mixed to grape (3)', () => {
      expect(MODALITY_COLORS.mixed).toBe('3')
    })
  })
})
