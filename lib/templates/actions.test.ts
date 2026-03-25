import { describe, it, expect, vi, beforeEach } from 'vitest'
import { revalidatePath } from 'next/cache'
import { sql } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'

const { testDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3')
  const sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return { testDb: drizzle(sqlite) }
})

vi.mock('@/lib/db/index', () => ({
  db: testDb,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  createResistanceTemplate,
  createRunningTemplate,
  createMmaBjjTemplate,
  updateTemplate,
  deleteTemplate,
} from './actions'

function seedMesocycle(
  overrides: Partial<{
    id: number
    name: string
    status: string
  }> = {}
) {
  const defaults = {
    name: 'Test Meso',
    start_date: '2026-03-01',
    end_date: '2026-03-28',
    work_weeks: 4,
    has_deload: 0,
    status: 'planned',
  }
  const row = { ...defaults, ...overrides }
  return testDb
    .insert(schema.mesocycles)
    .values(row)
    .returning({ id: schema.mesocycles.id })
    .get()
}

describe('createResistanceTemplate', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(sql`
      CREATE TABLE mesocycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        work_weeks INTEGER NOT NULL,
        has_deload INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'planned',
        created_at INTEGER
      )
    `)
    testDb.run(sql`
      CREATE TABLE workout_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        modality TEXT NOT NULL,
        notes TEXT,
        run_type TEXT,
        target_pace TEXT,
        hr_zone INTEGER,
        interval_count INTEGER,
        interval_rest INTEGER,
        coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER,
        planned_duration INTEGER,
        created_at INTEGER
      )
    `)
  })

  describe('validation', () => {
    it('rejects empty name', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: '', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/name/i)
    })

    it('rejects whitespace-only name', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: '   ', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/name/i)
    })

    it('rejects name producing empty slug', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: '!@#$%^&*()', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/canonical/i)
    })

    it('rejects non-existent mesocycle_id', async () => {
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: 999 })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/mesocycle/i)
    })
  })

  describe('completed mesocycle', () => {
    it('blocks creation on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })

    it('allows creation on planned mesocycle', async () => {
      const meso = seedMesocycle({ status: 'planned' })
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
    })

    it('allows creation on active mesocycle', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
    })
  })

  describe('canonical_name uniqueness', () => {
    it('rejects duplicate canonical_name within same mesocycle', async () => {
      const meso = seedMesocycle()
      await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duplicate|exists/i)
    })

    it('rejects same slug from different display names within mesocycle', async () => {
      const meso = seedMesocycle()
      await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      // "push-a" and "PUSH A" produce same canonical_name
      const result = await createResistanceTemplate({ name: 'PUSH A', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duplicate|exists/i)
    })

    it('allows same canonical_name across different mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Meso 1' })
      const meso2 = seedMesocycle({ name: 'Meso 2' })
      const r1 = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso1.id })
      const r2 = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso2.id })
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
    })
  })

  describe('successful creation', () => {
    it('returns success with correct data', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: 'Push A (Main)', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBeDefined()
        expect(typeof result.data.id).toBe('number')
        expect(result.data.name).toBe('Push A (Main)')
        expect(result.data.canonical_name).toBe('push-a-main')
        expect(result.data.mesocycle_id).toBe(meso.id)
      }
      expect(revalidatePath).toHaveBeenCalledWith('/mesocycles')
    })

    it('always sets modality to resistance', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.modality).toBe('resistance')
      }
    })

    it('auto-generates canonical_name from name', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: 'Lower Body B', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.canonical_name).toBe('lower-body-b')
      }
    })

    it('trims name whitespace before storing', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: '  Push A  ', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Push A')
      }
    })

    it('returns auto-increment integer ids', async () => {
      const meso = seedMesocycle()
      const r1 = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      const r2 = await createResistanceTemplate({ name: 'Pull A', mesocycle_id: meso.id })
      expect(r1.success && r1.data.id).toBe(1)
      expect(r2.success && r2.data.id).toBe(2)
    })

    it('persists template to database', async () => {
      const meso = seedMesocycle()
      await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      const rows = testDb.select().from(schema.workout_templates).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].canonical_name).toBe('push-a')
      expect(rows[0].modality).toBe('resistance')
    })
  })
})

describe('createRunningTemplate', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(sql`
      CREATE TABLE mesocycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        work_weeks INTEGER NOT NULL,
        has_deload INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'planned',
        created_at INTEGER
      )
    `)
    testDb.run(sql`
      CREATE TABLE workout_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        modality TEXT NOT NULL,
        notes TEXT,
        run_type TEXT,
        target_pace TEXT,
        hr_zone INTEGER,
        interval_count INTEGER,
        interval_rest INTEGER,
        coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER,
        planned_duration INTEGER,
        created_at INTEGER
      )
    `)
  })

  describe('validation', () => {
    it('rejects empty name', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: '',
        mesocycle_id: meso.id,
        run_type: 'easy',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/name/i)
    })

    it('rejects invalid run_type', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Test Run',
        mesocycle_id: meso.id,
        run_type: 'sprint' as 'easy',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/run type/i)
    })

    it('rejects hr_zone outside 1-5', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Test Run',
        mesocycle_id: meso.id,
        run_type: 'easy',
        hr_zone: 6,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/hr zone/i)
    })

    it('rejects hr_zone of 0', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Test Run',
        mesocycle_id: meso.id,
        run_type: 'easy',
        hr_zone: 0,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/hr zone/i)
    })

    it('rejects negative interval_count', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Intervals',
        mesocycle_id: meso.id,
        run_type: 'interval',
        interval_count: -1,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/interval count/i)
    })

    it('rejects zero interval_count', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Intervals',
        mesocycle_id: meso.id,
        run_type: 'interval',
        interval_count: 0,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/interval count/i)
    })

    it('rejects negative interval_rest', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Intervals',
        mesocycle_id: meso.id,
        run_type: 'interval',
        interval_rest: -10,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/interval rest/i)
    })

    it('rejects non-existent mesocycle', async () => {
      const result = await createRunningTemplate({
        name: 'Easy Run',
        mesocycle_id: 999,
        run_type: 'easy',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/mesocycle/i)
    })
  })

  describe('completed mesocycle', () => {
    it('blocks creation on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const result = await createRunningTemplate({
        name: 'Easy Run',
        mesocycle_id: meso.id,
        run_type: 'easy',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })
  })

  describe('canonical_name uniqueness', () => {
    it('rejects duplicate canonical_name within mesocycle', async () => {
      const meso = seedMesocycle()
      await createRunningTemplate({
        name: 'Easy Run',
        mesocycle_id: meso.id,
        run_type: 'easy',
      })
      const result = await createRunningTemplate({
        name: 'Easy Run',
        mesocycle_id: meso.id,
        run_type: 'tempo',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duplicate|exists/i)
    })

    it('rejects duplicate canonical_name across modalities within mesocycle', async () => {
      const meso = seedMesocycle()
      await createResistanceTemplate({ name: 'Session A', mesocycle_id: meso.id })
      const result = await createRunningTemplate({
        name: 'Session A',
        mesocycle_id: meso.id,
        run_type: 'easy',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duplicate|exists/i)
    })
  })

  describe('successful creation', () => {
    it('creates easy run with correct fields', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Tuesday Easy',
        mesocycle_id: meso.id,
        run_type: 'easy',
        target_pace: '6:00/km',
        hr_zone: 2,
        coaching_cues: 'Keep it conversational',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.modality).toBe('running')
        expect(result.data.run_type).toBe('easy')
        expect(result.data.target_pace).toBe('6:00/km')
        expect(result.data.hr_zone).toBe(2)
        expect(result.data.coaching_cues).toBe('Keep it conversational')
        expect(result.data.canonical_name).toBe('tuesday-easy')
        expect(result.data.interval_count).toBeNull()
        expect(result.data.interval_rest).toBeNull()
      }
    })

    it('creates interval run with interval fields', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Track Intervals',
        mesocycle_id: meso.id,
        run_type: 'interval',
        interval_count: 6,
        interval_rest: 90,
        target_pace: '4:30/km',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.run_type).toBe('interval')
        expect(result.data.interval_count).toBe(6)
        expect(result.data.interval_rest).toBe(90)
      }
    })

    it('clears interval fields for non-interval run_type', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Tempo Run',
        mesocycle_id: meso.id,
        run_type: 'tempo',
        interval_count: 5,
        interval_rest: 60,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.interval_count).toBeNull()
        expect(result.data.interval_rest).toBeNull()
      }
    })

    it('accepts all valid run_type values', async () => {
      const meso = seedMesocycle()
      const types = ['easy', 'tempo', 'interval', 'long', 'race'] as const
      for (const rt of types) {
        const result = await createRunningTemplate({
          name: `Run ${rt}`,
          mesocycle_id: meso.id,
          run_type: rt,
        })
        expect(result.success).toBe(true)
      }
    })

    it('allows interval_rest of 0', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'No Rest Intervals',
        mesocycle_id: meso.id,
        run_type: 'interval',
        interval_rest: 0,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.interval_rest).toBe(0)
      }
    })

    it('stores optional fields as null when not provided', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Minimal Run',
        mesocycle_id: meso.id,
        run_type: 'easy',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.target_pace).toBeNull()
        expect(result.data.hr_zone).toBeNull()
        expect(result.data.coaching_cues).toBeNull()
      }
    })

    it('calls revalidatePath after creation', async () => {
      const meso = seedMesocycle()
      await createRunningTemplate({
        name: 'Easy Run',
        mesocycle_id: meso.id,
        run_type: 'easy',
      })
      expect(revalidatePath).toHaveBeenCalledWith('/mesocycles')
    })
  })

  describe('distance/duration fields', () => {
    it('stores target_distance on creation', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: '5K Easy',
        mesocycle_id: meso.id,
        run_type: 'easy',
        target_distance: 5.0,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.target_distance).toBe(5.0)
      }
    })

    it('stores target_duration on creation', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: '30min Tempo',
        mesocycle_id: meso.id,
        run_type: 'tempo',
        target_duration: 30,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.target_duration).toBe(30)
      }
    })

    it('stores both distance and duration together', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: '10K Race',
        mesocycle_id: meso.id,
        run_type: 'race',
        target_distance: 10.0,
        target_duration: 50,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.target_distance).toBe(10.0)
        expect(result.data.target_duration).toBe(50)
      }
    })

    it('defaults both to null when not provided', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Minimal Run',
        mesocycle_id: meso.id,
        run_type: 'easy',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.target_distance).toBeNull()
        expect(result.data.target_duration).toBeNull()
      }
    })

    it('rejects negative target_distance', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Bad Distance',
        mesocycle_id: meso.id,
        run_type: 'easy',
        target_distance: -1,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/distance.*positive/i)
    })

    it('rejects zero target_distance', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Zero Distance',
        mesocycle_id: meso.id,
        run_type: 'easy',
        target_distance: 0,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/distance.*positive/i)
    })

    it('rejects negative target_duration', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Bad Duration',
        mesocycle_id: meso.id,
        run_type: 'easy',
        target_duration: -5,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duration.*positive/i)
    })

    it('rejects zero target_duration', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Zero Duration',
        mesocycle_id: meso.id,
        run_type: 'easy',
        target_duration: 0,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duration.*positive/i)
    })

    it('accepts fractional target_distance', async () => {
      const meso = seedMesocycle()
      const result = await createRunningTemplate({
        name: 'Half Marathon',
        mesocycle_id: meso.id,
        run_type: 'long',
        target_distance: 21.1,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.target_distance).toBeCloseTo(21.1)
      }
    })
  })
})

describe('createMmaBjjTemplate', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(sql`
      CREATE TABLE mesocycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        work_weeks INTEGER NOT NULL,
        has_deload INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'planned',
        created_at INTEGER
      )
    `)
    testDb.run(sql`
      CREATE TABLE workout_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        modality TEXT NOT NULL,
        notes TEXT,
        run_type TEXT,
        target_pace TEXT,
        hr_zone INTEGER,
        interval_count INTEGER,
        interval_rest INTEGER,
        coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER,
        planned_duration INTEGER,
        created_at INTEGER
      )
    `)
  })

  describe('validation', () => {
    it('rejects empty name', async () => {
      const meso = seedMesocycle()
      const result = await createMmaBjjTemplate({ name: '', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/name/i)
    })

    it('rejects whitespace-only name', async () => {
      const meso = seedMesocycle()
      const result = await createMmaBjjTemplate({ name: '   ', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/name/i)
    })

    it('rejects name producing empty slug', async () => {
      const meso = seedMesocycle()
      const result = await createMmaBjjTemplate({ name: '!@#$%', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/canonical/i)
    })

    it('rejects non-existent mesocycle', async () => {
      const result = await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: 999 })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/mesocycle/i)
    })

    it('rejects zero planned_duration', async () => {
      const meso = seedMesocycle()
      const result = await createMmaBjjTemplate({
        name: 'BJJ Gi',
        mesocycle_id: meso.id,
        planned_duration: 0,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duration|positive/i)
    })

    it('rejects negative planned_duration', async () => {
      const meso = seedMesocycle()
      const result = await createMmaBjjTemplate({
        name: 'BJJ Gi',
        mesocycle_id: meso.id,
        planned_duration: -30,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duration|positive/i)
    })
  })

  describe('completed mesocycle', () => {
    it('blocks creation on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const result = await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })

    it('allows creation on planned mesocycle', async () => {
      const meso = seedMesocycle({ status: 'planned' })
      const result = await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
    })

    it('allows creation on active mesocycle', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const result = await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
    })
  })

  describe('canonical_name uniqueness', () => {
    it('rejects duplicate canonical_name within mesocycle', async () => {
      const meso = seedMesocycle()
      await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: meso.id })
      const result = await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duplicate|exists/i)
    })

    it('rejects duplicate canonical_name across modalities', async () => {
      const meso = seedMesocycle()
      await createResistanceTemplate({ name: 'Session A', mesocycle_id: meso.id })
      const result = await createMmaBjjTemplate({ name: 'Session A', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duplicate|exists/i)
    })

    it('allows same canonical_name across different mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Meso 1' })
      const meso2 = seedMesocycle({ name: 'Meso 2' })
      const r1 = await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: meso1.id })
      const r2 = await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: meso2.id })
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
    })
  })

  describe('successful creation', () => {
    it('creates template with correct modality and fields', async () => {
      const meso = seedMesocycle()
      const result = await createMmaBjjTemplate({
        name: 'BJJ No-Gi',
        mesocycle_id: meso.id,
        planned_duration: 90,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.modality).toBe('mma')
        expect(result.data.name).toBe('BJJ No-Gi')
        expect(result.data.canonical_name).toBe('bjj-no-gi')
        expect(result.data.planned_duration).toBe(90)
      }
    })

    it('creates template without planned_duration', async () => {
      const meso = seedMesocycle()
      const result = await createMmaBjjTemplate({
        name: 'MMA Sparring',
        mesocycle_id: meso.id,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.modality).toBe('mma')
        expect(result.data.planned_duration).toBeNull()
      }
    })

    it('trims name whitespace', async () => {
      const meso = seedMesocycle()
      const result = await createMmaBjjTemplate({ name: '  BJJ Gi  ', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('BJJ Gi')
      }
    })

    it('returns auto-increment integer ids', async () => {
      const meso = seedMesocycle()
      const r1 = await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: meso.id })
      const r2 = await createMmaBjjTemplate({ name: 'MMA Sparring', mesocycle_id: meso.id })
      expect(r1.success && r1.data.id).toBe(1)
      expect(r2.success && r2.data.id).toBe(2)
    })

    it('calls revalidatePath after creation', async () => {
      const meso = seedMesocycle()
      await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: meso.id })
      expect(revalidatePath).toHaveBeenCalledWith('/mesocycles')
    })

    it('persists to database with no exercise slots', async () => {
      const meso = seedMesocycle()
      await createMmaBjjTemplate({ name: 'BJJ Gi', mesocycle_id: meso.id })
      const rows = testDb.select().from(schema.workout_templates).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].modality).toBe('mma')
      expect(rows[0].run_type).toBeNull()
    })
  })
})

// ============================================================================
// updateTemplate — completed mesocycle protection (T038)
// ============================================================================

describe('updateTemplate', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
    testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
    testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(sql`
      CREATE TABLE mesocycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        work_weeks INTEGER NOT NULL,
        has_deload INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'planned',
        created_at INTEGER
      )
    `)
    testDb.run(sql`
      CREATE TABLE workout_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        modality TEXT NOT NULL,
        notes TEXT,
        run_type TEXT,
        target_pace TEXT,
        hr_zone INTEGER,
        interval_count INTEGER,
        interval_rest INTEGER,
        coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER,
        planned_duration INTEGER,
        created_at INTEGER
      )
    `)
  })

  function seedTemplateForMeso(mesoId: number) {
    return testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: mesoId,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
        created_at: new Date(),
      })
      .returning()
      .get()
  }

  describe('completed mesocycle', () => {
    it('blocks edit on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplateForMeso(meso.id)
      const result = await updateTemplate({ id: tmpl.id, name: 'Updated' })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })

    it('allows edit on planned mesocycle', async () => {
      const meso = seedMesocycle({ status: 'planned' })
      const tmpl = seedTemplateForMeso(meso.id)
      const result = await updateTemplate({ id: tmpl.id, name: 'Updated' })
      expect(result.success).toBe(true)
    })

    it('allows edit on active mesocycle', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const tmpl = seedTemplateForMeso(meso.id)
      const result = await updateTemplate({ id: tmpl.id, name: 'Updated' })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// deleteTemplate — completed mesocycle protection (T038)
// ============================================================================

describe('deleteTemplate', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
    testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
    testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(sql`
      CREATE TABLE mesocycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        work_weeks INTEGER NOT NULL,
        has_deload INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'planned',
        created_at INTEGER
      )
    `)
    testDb.run(sql`
      CREATE TABLE workout_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        modality TEXT NOT NULL,
        notes TEXT,
        run_type TEXT,
        target_pace TEXT,
        hr_zone INTEGER,
        interval_count INTEGER,
        interval_rest INTEGER,
        coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER,
        planned_duration INTEGER,
        created_at INTEGER
      )
    `)
    testDb.run(sql`
      CREATE TABLE exercise_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL,
        sets INTEGER,
        reps TEXT,
        weight REAL,
        rpe REAL,
        rest_seconds INTEGER, duration INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
        guidelines TEXT,
        "order" INTEGER NOT NULL,
        is_main INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER
      )
    `)
    testDb.run(sql`
      CREATE TABLE weekly_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
        template_id INTEGER NOT NULL REFERENCES workout_templates(id),
        day_of_week INTEGER NOT NULL,
        week_type TEXT NOT NULL DEFAULT 'normal',
        period TEXT NOT NULL DEFAULT 'morning',
        time_slot TEXT,
        created_at INTEGER
      )
    `)
  })

  function seedTemplateForMeso(mesoId: number) {
    return testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: mesoId,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
        created_at: new Date(),
      })
      .returning()
      .get()
  }

  describe('completed mesocycle', () => {
    it('blocks delete on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplateForMeso(meso.id)
      const result = await deleteTemplate(tmpl.id)
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })

    it('allows delete on planned mesocycle', async () => {
      const meso = seedMesocycle({ status: 'planned' })
      const tmpl = seedTemplateForMeso(meso.id)
      const result = await deleteTemplate(tmpl.id)
      expect(result.success).toBe(true)
    })

    it('allows delete on active mesocycle', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const tmpl = seedTemplateForMeso(meso.id)
      const result = await deleteTemplate(tmpl.id)
      expect(result.success).toBe(true)
    })
  })
})
