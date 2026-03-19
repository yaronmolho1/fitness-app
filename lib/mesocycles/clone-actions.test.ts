import { describe, it, expect, vi, beforeEach } from 'vitest'
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

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { cloneMesocycle } from './clone-actions'

function resetTables() {
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)

  testDb.run(sql`CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    muscle_group TEXT,
    equipment TEXT,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE IF NOT EXISTS mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    work_weeks INTEGER NOT NULL,
    has_deload INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE IF NOT EXISTS workout_templates (
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
    planned_duration INTEGER,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE IF NOT EXISTS exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER,
    sets INTEGER NOT NULL,
    reps TEXT NOT NULL,
    weight REAL,
    rpe REAL,
    rest_seconds INTEGER,
    guidelines TEXT,
    "order" INTEGER NOT NULL,
    is_main INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE IF NOT EXISTS weekly_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    template_id INTEGER REFERENCES workout_templates(id),
    week_type TEXT NOT NULL DEFAULT 'normal',
    created_at INTEGER,
    UNIQUE(mesocycle_id, day_of_week, week_type)
  )`)
}

// Seed a source mesocycle with templates, slots, and schedule
function seedSource(opts?: {
  status?: string
  hasDeload?: boolean
  noTemplates?: boolean
  noSlots?: boolean
  noSchedule?: boolean
}) {
  const status = opts?.status ?? 'completed'
  const hasDeload = opts?.hasDeload ?? true

  const meso = testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Source Meso',
      start_date: '2026-01-05',
      end_date: hasDeload ? '2026-02-08' : '2026-02-01',
      work_weeks: 4,
      has_deload: hasDeload,
      status,
    })
    .returning({ id: schema.mesocycles.id })
    .get()

  if (opts?.noTemplates) return { mesoId: meso.id, templateIds: [] as number[] }

  // Resistance template
  const t1 = testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: meso.id,
      name: 'Push A',
      canonical_name: 'push-a',
      modality: 'resistance',
      notes: 'chest focus',
    })
    .returning({ id: schema.workout_templates.id })
    .get()

  // Running template
  const t2 = testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: meso.id,
      name: 'Easy Run',
      canonical_name: 'easy-run',
      modality: 'running',
      run_type: 'easy',
      target_pace: '5:30',
      hr_zone: 2,
    })
    .returning({ id: schema.workout_templates.id })
    .get()

  if (!opts?.noSlots) {
    // Exercise for slots
    const ex = testDb
      .insert(schema.exercises)
      .values({ name: 'Bench Press', modality: 'resistance' })
      .returning({ id: schema.exercises.id })
      .get()

    testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: t1.id,
        exercise_id: ex.id,
        sets: 4,
        reps: '8',
        weight: 80,
        rpe: 8,
        rest_seconds: 120,
        guidelines: 'slow eccentric',
        order: 1,
        is_main: true,
      })
      .run()

    testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: t1.id,
        exercise_id: ex.id,
        sets: 3,
        reps: '12',
        weight: 60,
        order: 2,
        is_main: false,
      })
      .run()
  }

  if (!opts?.noSchedule) {
    // Normal schedule: Mon=Push A, Wed=Easy Run
    testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: meso.id,
        day_of_week: 1,
        template_id: t1.id,
        week_type: 'normal',
      })
      .run()

    testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: meso.id,
        day_of_week: 3,
        template_id: t2.id,
        week_type: 'normal',
      })
      .run()

    if (hasDeload) {
      // Deload schedule: Mon=Easy Run
      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id,
          day_of_week: 1,
          template_id: t2.id,
          week_type: 'deload',
        })
        .run()
    }
  }

  return { mesoId: meso.id, templateIds: [t1.id, t2.id] }
}

describe('cloneMesocycle', () => {
  beforeEach(() => {
    resetTables()
  })

  describe('validation', () => {
    it('rejects missing name', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: '',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/name/i)
    })

    it('rejects whitespace-only name', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: '   ',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/name/i)
    })

    it('rejects missing start_date', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/start.?date/i)
    })

    it('rejects invalid start_date format', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '03/01/2026',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/start.?date/i)
    })

    it('rejects non-existent source mesocycle', async () => {
      const result = await cloneMesocycle({
        source_id: 999,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/not found/i)
    })

    it('rejects source with no templates', async () => {
      const { mesoId } = seedSource({ noTemplates: true })
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/no.*(template|empty)/i)
    })
  })

  describe('successful clone', () => {
    it('creates new mesocycle with status=planned', async () => {
      const { mesoId } = seedSource({ status: 'completed' })
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'New Phase',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const newMeso = testDb
        .select()
        .from(schema.mesocycles)
        .where(sql`id = ${result.id}`)
        .get()

      expect(newMeso).toBeDefined()
      expect(newMeso!.status).toBe('planned')
      expect(newMeso!.name).toBe('New Phase')
    })

    it('copies work_weeks and has_deload from source by default', async () => {
      const { mesoId } = seedSource({ hasDeload: true })
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const newMeso = testDb
        .select()
        .from(schema.mesocycles)
        .where(sql`id = ${result.id}`)
        .get()

      expect(newMeso!.work_weeks).toBe(4)
      expect(newMeso!.has_deload).toBe(true)
    })

    it('allows overriding work_weeks', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
        work_weeks: 6,
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const newMeso = testDb
        .select()
        .from(schema.mesocycles)
        .where(sql`id = ${result.id}`)
        .get()

      expect(newMeso!.work_weeks).toBe(6)
    })

    it('allows overriding has_deload', async () => {
      const { mesoId } = seedSource({ hasDeload: true })
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
        has_deload: false,
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const newMeso = testDb
        .select()
        .from(schema.mesocycles)
        .where(sql`id = ${result.id}`)
        .get()

      expect(newMeso!.has_deload).toBe(false)
    })

    it('computes end_date from new start_date and work_weeks/has_deload', async () => {
      const { mesoId } = seedSource({ hasDeload: true })
      // 4 work weeks + deload = 5 weeks total = 35 days, start March 1 -> end April 4
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const newMeso = testDb
        .select()
        .from(schema.mesocycles)
        .where(sql`id = ${result.id}`)
        .get()

      expect(newMeso!.end_date).toBe('2026-04-04')
    })

    it('clones all workout templates with new IDs', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const sourceTemplates = testDb
        .select()
        .from(schema.workout_templates)
        .where(sql`mesocycle_id = ${mesoId}`)
        .all()

      const clonedTemplates = testDb
        .select()
        .from(schema.workout_templates)
        .where(sql`mesocycle_id = ${result.id}`)
        .all()

      expect(clonedTemplates).toHaveLength(sourceTemplates.length)

      // New IDs, not same as source
      const sourceIds = sourceTemplates.map((t: { id: number }) => t.id)
      for (const ct of clonedTemplates) {
        expect(sourceIds).not.toContain(ct.id)
      }
    })

    it('preserves canonical_name on cloned templates', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const clonedTemplates = testDb
        .select()
        .from(schema.workout_templates)
        .where(sql`mesocycle_id = ${result.id}`)
        .all()

      const canonicals = clonedTemplates.map((t: { canonical_name: string }) => t.canonical_name).sort()
      expect(canonicals).toEqual(['easy-run', 'push-a'])
    })

    it('preserves template modality-specific fields', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const clonedTemplates = testDb
        .select()
        .from(schema.workout_templates)
        .where(sql`mesocycle_id = ${result.id}`)
        .all()

      const resistance = clonedTemplates.find((t: { modality: string }) => t.modality === 'resistance')
      expect(resistance).toBeDefined()
      expect(resistance!.notes).toBe('chest focus')

      const running = clonedTemplates.find((t: { modality: string }) => t.modality === 'running')
      expect(running).toBeDefined()
      expect(running!.run_type).toBe('easy')
      expect(running!.target_pace).toBe('5:30')
      expect(running!.hr_zone).toBe(2)
    })

    it('clones exercise slots with new IDs referencing new template IDs', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      // Get cloned template for Push A
      const clonedPushA = testDb
        .select()
        .from(schema.workout_templates)
        .where(sql`mesocycle_id = ${result.id} AND canonical_name = 'push-a'`)
        .get()

      const clonedSlots = testDb
        .select()
        .from(schema.exercise_slots)
        .where(sql`template_id = ${clonedPushA!.id}`)
        .all()

      expect(clonedSlots).toHaveLength(2)

      // Verify slot data copied
      const mainSlot = clonedSlots.find((s: { is_main: boolean }) => s.is_main)
      expect(mainSlot).toBeDefined()
      expect(mainSlot!.sets).toBe(4)
      expect(mainSlot!.reps).toBe('8')
      expect(mainSlot!.weight).toBe(80)
      expect(mainSlot!.rpe).toBe(8)
      expect(mainSlot!.rest_seconds).toBe(120)
      expect(mainSlot!.guidelines).toBe('slow eccentric')
      expect(mainSlot!.order).toBe(1)

      // Slots reference new template, not source
      const sourceTemplates = testDb
        .select()
        .from(schema.workout_templates)
        .where(sql`mesocycle_id = ${mesoId}`)
        .all()
      const sourceTemplateIds = sourceTemplates.map((t: { id: number }) => t.id)
      for (const slot of clonedSlots) {
        expect(sourceTemplateIds).not.toContain(slot.template_id)
      }
    })

    it('clones both normal and deload schedule rows', async () => {
      const { mesoId } = seedSource({ hasDeload: true })
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const clonedSchedule = testDb
        .select()
        .from(schema.weekly_schedule)
        .where(sql`mesocycle_id = ${result.id}`)
        .all()

      // Source had 2 normal + 1 deload
      expect(clonedSchedule).toHaveLength(3)

      const normal = clonedSchedule.filter((s: { week_type: string }) => s.week_type === 'normal')
      const deload = clonedSchedule.filter((s: { week_type: string }) => s.week_type === 'deload')
      expect(normal).toHaveLength(2)
      expect(deload).toHaveLength(1)
    })

    it('schedule rows reference new template IDs', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const sourceTemplates = testDb
        .select()
        .from(schema.workout_templates)
        .where(sql`mesocycle_id = ${mesoId}`)
        .all()
      const sourceTemplateIds = sourceTemplates.map((t: { id: number }) => t.id)

      const clonedSchedule = testDb
        .select()
        .from(schema.weekly_schedule)
        .where(sql`mesocycle_id = ${result.id}`)
        .all()

      for (const row of clonedSchedule) {
        expect(sourceTemplateIds).not.toContain(row.template_id)
        // Must reference a template in the new mesocycle
        const tmpl = testDb
          .select()
          .from(schema.workout_templates)
          .where(sql`id = ${row.template_id}`)
          .get()
        expect(tmpl).toBeDefined()
        expect(tmpl!.mesocycle_id).toBe(result.id)
      }
    })

    it('accepts source in any status (planned, active, completed)', async () => {
      for (const status of ['planned', 'active', 'completed'] as const) {
        resetTables()
        const { mesoId } = seedSource({ status })
        const result = await cloneMesocycle({
          source_id: mesoId,
          name: `Clone from ${status}`,
          start_date: '2026-03-01',
        })
        expect(result.success).toBe(true)
      }
    })

    it('returns the new mesocycle ID', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(typeof result.id).toBe('number')
      expect(result.id).not.toBe(mesoId)
    })
  })

  describe('transaction atomicity', () => {
    it('rolls back all rows on mid-transaction failure', async () => {
      const { mesoId } = seedSource()

      // Count rows before clone attempt
      const mesosBefore = testDb.select().from(schema.mesocycles).all().length
      const templatesBefore = testDb.select().from(schema.workout_templates).all().length
      const slotsBefore = testDb.select().from(schema.exercise_slots).all().length
      const scheduleBefore = testDb.select().from(schema.weekly_schedule).all().length

      // Wrap db.transaction to inject a throw after template inserts but before slots
      const originalTransaction = testDb.transaction.bind(testDb)
      vi.spyOn(testDb, 'transaction').mockImplementationOnce((...args: unknown[]) => {
        const callback = args[0] as (tx: typeof testDb) => unknown
        return originalTransaction((tx: typeof testDb) => {
          // Wrap tx.insert to throw on exercise_slots
          const originalTxInsert = tx.insert.bind(tx)
          const txInsertSpy = vi.spyOn(tx, 'insert').mockImplementation((...insertArgs: unknown[]) => {
            const table = insertArgs[0] as Parameters<typeof tx.insert>[0]
            if (table === schema.exercise_slots) {
              txInsertSpy.mockRestore()
              throw new Error('Simulated mid-transaction failure')
            }
            return originalTxInsert(table)
          })
          return callback(tx)
        })
      })

      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Should Not Exist',
        start_date: '2026-03-01',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }

      // Verify no partial rows were created
      const mesosAfter = testDb.select().from(schema.mesocycles).all().length
      const templatesAfter = testDb.select().from(schema.workout_templates).all().length
      const slotsAfter = testDb.select().from(schema.exercise_slots).all().length
      const scheduleAfter = testDb.select().from(schema.weekly_schedule).all().length

      expect(mesosAfter).toBe(mesosBefore)
      expect(templatesAfter).toBe(templatesBefore)
      expect(slotsAfter).toBe(slotsBefore)
      expect(scheduleAfter).toBe(scheduleBefore)
    })
  })

  describe('edge cases', () => {
    it('clones source with templates but no slots', async () => {
      const { mesoId } = seedSource({ noSlots: true })
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const clonedTemplates = testDb
        .select()
        .from(schema.workout_templates)
        .where(sql`mesocycle_id = ${result.id}`)
        .all()
      expect(clonedTemplates).toHaveLength(2)

      // No slots cloned
      for (const tmpl of clonedTemplates) {
        const slots = testDb
          .select()
          .from(schema.exercise_slots)
          .where(sql`template_id = ${tmpl.id}`)
          .all()
        expect(slots).toHaveLength(0)
      }
    })

    it('clones source with templates but no schedule', async () => {
      const { mesoId } = seedSource({ noSchedule: true })
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const clonedSchedule = testDb
        .select()
        .from(schema.weekly_schedule)
        .where(sql`mesocycle_id = ${result.id}`)
        .all()
      expect(clonedSchedule).toHaveLength(0)
    })

    it('skips deload schedule rows when has_deload overridden to false', async () => {
      const { mesoId } = seedSource({ hasDeload: true })
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone No Deload',
        start_date: '2026-03-01',
        has_deload: false,
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const clonedSchedule = testDb
        .select()
        .from(schema.weekly_schedule)
        .where(sql`mesocycle_id = ${result.id}`)
        .all()

      // Only normal rows, deload rows excluded
      expect(clonedSchedule).toHaveLength(2)
      for (const row of clonedSchedule) {
        expect(row.week_type).toBe('normal')
      }
    })

    it('has_deload overridden to true from false — no deload schedule rows exist to clone', async () => {
      const { mesoId } = seedSource({ hasDeload: false })
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone With Deload',
        start_date: '2026-03-01',
        has_deload: true,
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const newMeso = testDb
        .select()
        .from(schema.mesocycles)
        .where(sql`id = ${result.id}`)
        .get()
      expect(newMeso!.has_deload).toBe(true)

      // No deload rows to clone from source, so none in clone
      const clonedSchedule = testDb
        .select()
        .from(schema.weekly_schedule)
        .where(sql`mesocycle_id = ${result.id}`)
        .all()
      const deload = clonedSchedule.filter((s: { week_type: string }) => s.week_type === 'deload')
      expect(deload).toHaveLength(0)
    })

    it('trims name whitespace', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: '  New Phase  ',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const newMeso = testDb
        .select()
        .from(schema.mesocycles)
        .where(sql`id = ${result.id}`)
        .get()
      expect(newMeso!.name).toBe('New Phase')
    })
  })
})
