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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  createMixedTemplate,
  addSection,
  removeSection,
  reorderSections,
} from './section-actions'

const MESO_DDL = sql`
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
`

const TEMPLATES_DDL = sql`
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
`

const SECTIONS_DDL = sql`
  CREATE TABLE template_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    modality TEXT NOT NULL,
    section_name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
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
`

const EXERCISES_DDL = sql`
  CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    modality TEXT NOT NULL DEFAULT 'resistance',
    muscle_group TEXT,
    equipment TEXT,
    created_at INTEGER
  )
`

const SLOTS_DDL = sql`
  CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER REFERENCES template_sections(id),
    sets INTEGER NOT NULL,
    reps TEXT NOT NULL,
    weight REAL,
    rpe REAL,
    rest_seconds INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
    guidelines TEXT,
    "order" INTEGER NOT NULL,
    is_main INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  )
`

function seedDb() {
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
  testDb.run(MESO_DDL)
  testDb.run(TEMPLATES_DDL)
  testDb.run(SECTIONS_DDL)
  testDb.run(EXERCISES_DDL)
  testDb.run(SLOTS_DDL)
}

function seedMesocycle(
  overrides: Partial<{ name: string; status: string }> = {}
) {
  const defaults = {
    name: 'Test Meso',
    start_date: '2026-03-01',
    end_date: '2026-03-28',
    work_weeks: 4,
    has_deload: 0,
    status: 'planned',
  }
  return testDb
    .insert(schema.mesocycles)
    .values({ ...defaults, ...overrides })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedMixedTemplate(mesoId: number, name = 'Strength + Cardio') {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesoId,
      name,
      canonical_name: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      modality: 'mixed',
      created_at: new Date(),
    })
    .returning()
    .get()
}

function seedSection(
  templateId: number,
  modality: 'resistance' | 'running' | 'mma',
  order: number,
  name = `Section ${order}`
) {
  return testDb
    .insert(schema.template_sections)
    .values({
      template_id: templateId,
      modality,
      section_name: name,
      order,
      created_at: new Date(),
    })
    .returning()
    .get()
}

// ============================================================================
// createMixedTemplate
// ============================================================================

describe('createMixedTemplate', () => {
  beforeEach(seedDb)

  describe('validation', () => {
    it('rejects empty name', async () => {
      const meso = seedMesocycle()
      const result = await createMixedTemplate({
        name: '',
        mesocycle_id: meso.id,
        sections: [
          { section_name: 'Lift', modality: 'resistance', order: 1 },
          { section_name: 'Run', modality: 'running', order: 2, run_type: 'easy' },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/name/i)
    })

    it('rejects fewer than 2 sections', async () => {
      const meso = seedMesocycle()
      const result = await createMixedTemplate({
        name: 'Mixed',
        mesocycle_id: meso.id,
        sections: [
          { section_name: 'Lift', modality: 'resistance', order: 1 },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/2.*section/i)
    })

    it('rejects sections with all same modality', async () => {
      const meso = seedMesocycle()
      const result = await createMixedTemplate({
        name: 'Mixed',
        mesocycle_id: meso.id,
        sections: [
          { section_name: 'Lift A', modality: 'resistance', order: 1 },
          { section_name: 'Lift B', modality: 'resistance', order: 2 },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/different modal/i)
    })

    it('rejects non-existent mesocycle', async () => {
      const result = await createMixedTemplate({
        name: 'Mixed',
        mesocycle_id: 999,
        sections: [
          { section_name: 'Lift', modality: 'resistance', order: 1 },
          { section_name: 'Run', modality: 'running', order: 2, run_type: 'easy' },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/mesocycle/i)
    })

    it('rejects completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const result = await createMixedTemplate({
        name: 'Mixed',
        mesocycle_id: meso.id,
        sections: [
          { section_name: 'Lift', modality: 'resistance', order: 1 },
          { section_name: 'Run', modality: 'running', order: 2, run_type: 'easy' },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })

    it('rejects duplicate canonical_name within mesocycle', async () => {
      const meso = seedMesocycle()
      seedMixedTemplate(meso.id, 'Mixed Session')
      const result = await createMixedTemplate({
        name: 'Mixed Session',
        mesocycle_id: meso.id,
        sections: [
          { section_name: 'Lift', modality: 'resistance', order: 1 },
          { section_name: 'Run', modality: 'running', order: 2, run_type: 'easy' },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duplicate|exists/i)
    })
  })

  describe('successful creation', () => {
    it('creates template with modality=mixed and sections', async () => {
      const meso = seedMesocycle()
      const result = await createMixedTemplate({
        name: 'Strength + Cardio',
        mesocycle_id: meso.id,
        sections: [
          { section_name: 'Main Lift', modality: 'resistance', order: 1 },
          { section_name: 'Cooldown Run', modality: 'running', order: 2, run_type: 'easy', target_pace: '6:00/km' },
        ],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.template.modality).toBe('mixed')
        expect(result.data.template.canonical_name).toBe('strength-cardio')
        expect(result.data.sections).toHaveLength(2)
        expect(result.data.sections[0].section_name).toBe('Main Lift')
        expect(result.data.sections[0].modality).toBe('resistance')
        expect(result.data.sections[1].section_name).toBe('Cooldown Run')
        expect(result.data.sections[1].modality).toBe('running')
        expect(result.data.sections[1].run_type).toBe('easy')
        expect(result.data.sections[1].target_pace).toBe('6:00/km')
      }
    })

    it('creates sections with MMA fields', async () => {
      const meso = seedMesocycle()
      const result = await createMixedTemplate({
        name: 'Full Session',
        mesocycle_id: meso.id,
        sections: [
          { section_name: 'Lift', modality: 'resistance', order: 1 },
          { section_name: 'Sparring', modality: 'mma', order: 2, planned_duration: 60 },
        ],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sections[1].planned_duration).toBe(60)
      }
    })

    it('persists template and sections to database', async () => {
      const meso = seedMesocycle()
      await createMixedTemplate({
        name: 'Mixed',
        mesocycle_id: meso.id,
        sections: [
          { section_name: 'A', modality: 'resistance', order: 1 },
          { section_name: 'B', modality: 'running', order: 2, run_type: 'easy' },
        ],
      })
      const templates = testDb.select().from(schema.workout_templates).all()
      const sections = testDb.select().from(schema.template_sections).all()
      expect(templates).toHaveLength(1)
      expect(templates[0].modality).toBe('mixed')
      expect(sections).toHaveLength(2)
      expect(sections[0].template_id).toBe(templates[0].id)
    })

    it('supports 3+ sections with multiple modalities', async () => {
      const meso = seedMesocycle()
      const result = await createMixedTemplate({
        name: 'Triple',
        mesocycle_id: meso.id,
        sections: [
          { section_name: 'Lift', modality: 'resistance', order: 1 },
          { section_name: 'Run', modality: 'running', order: 2, run_type: 'easy' },
          { section_name: 'Spar', modality: 'mma', order: 3, planned_duration: 30 },
        ],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sections).toHaveLength(3)
      }
    })

    it('allows on active mesocycle', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const result = await createMixedTemplate({
        name: 'Mixed',
        mesocycle_id: meso.id,
        sections: [
          { section_name: 'A', modality: 'resistance', order: 1 },
          { section_name: 'B', modality: 'running', order: 2, run_type: 'easy' },
        ],
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// addSection
// ============================================================================

describe('addSection', () => {
  beforeEach(seedDb)

  it('adds a section to an existing mixed template', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    seedSection(tmpl.id, 'resistance', 1)
    seedSection(tmpl.id, 'running', 2)

    const result = await addSection({
      template_id: tmpl.id,
      section_name: 'Sparring',
      modality: 'mma',
      planned_duration: 45,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.section_name).toBe('Sparring')
      expect(result.data.modality).toBe('mma')
      expect(result.data.order).toBe(3)
      expect(result.data.planned_duration).toBe(45)
    }
  })

  it('auto-assigns order as max+1', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    seedSection(tmpl.id, 'resistance', 1)
    seedSection(tmpl.id, 'running', 2)

    const result = await addSection({
      template_id: tmpl.id,
      section_name: 'Extra',
      modality: 'resistance',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.order).toBe(3)
    }
  })

  it('rejects non-existent template', async () => {
    const result = await addSection({
      template_id: 999,
      section_name: 'Test',
      modality: 'resistance',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/template/i)
  })

  it('rejects non-mixed template', async () => {
    const meso = seedMesocycle()
    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: meso.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
        created_at: new Date(),
      })
      .returning()
      .get()

    const result = await addSection({
      template_id: tmpl.id,
      section_name: 'Test',
      modality: 'resistance',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/mixed/i)
  })

  it('rejects empty section_name', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    const result = await addSection({
      template_id: tmpl.id,
      section_name: '',
      modality: 'resistance',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/name/i)
  })

  it('rejects on completed mesocycle', async () => {
    const meso = seedMesocycle({ status: 'completed' })
    const tmpl = seedMixedTemplate(meso.id)
    const result = await addSection({
      template_id: tmpl.id,
      section_name: 'Test',
      modality: 'resistance',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/completed/i)
  })

  it('stores running fields on section', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    const result = await addSection({
      template_id: tmpl.id,
      section_name: 'Intervals',
      modality: 'running',
      run_type: 'interval',
      target_pace: '4:30/km',
      hr_zone: 4,
      interval_count: 6,
      interval_rest: 90,
      coaching_cues: 'Push hard',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.run_type).toBe('interval')
      expect(result.data.target_pace).toBe('4:30/km')
      expect(result.data.hr_zone).toBe(4)
      expect(result.data.interval_count).toBe(6)
      expect(result.data.interval_rest).toBe(90)
      expect(result.data.coaching_cues).toBe('Push hard')
    }
  })
})

// ============================================================================
// removeSection
// ============================================================================

describe('removeSection', () => {
  beforeEach(seedDb)

  it('removes a section when 3+ sections with 2+ modalities remain', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    seedSection(tmpl.id, 'resistance', 1, 'Lift A')
    seedSection(tmpl.id, 'resistance', 2, 'Lift B')
    seedSection(tmpl.id, 'running', 3, 'Run')

    // Remove "Lift B" — leaves resistance + running
    const allSections = testDb.select().from(schema.template_sections).all()
    const liftB = allSections.find(
      (s: typeof schema.template_sections.$inferSelect) => s.section_name === 'Lift B'
    )!

    const result = await removeSection(liftB.id)
    expect(result.success).toBe(true)

    const remaining = testDb.select().from(schema.template_sections).all()
    expect(remaining).toHaveLength(2)
  })

  it('rejects removal if only 2 sections remain (would leave 1)', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    const s1 = seedSection(tmpl.id, 'resistance', 1)
    seedSection(tmpl.id, 'running', 2)

    const result = await removeSection(s1.id)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/2.*section/i)
  })

  it('rejects removal if remaining sections would have only one modality', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    seedSection(tmpl.id, 'resistance', 1, 'Lift A')
    seedSection(tmpl.id, 'resistance', 2, 'Lift B')
    const s3 = seedSection(tmpl.id, 'running', 3, 'Run')

    // Removing the only running section leaves all resistance
    const result = await removeSection(s3.id)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/different modal/i)
  })

  it('rejects non-existent section', async () => {
    const result = await removeSection(999)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/section.*not found/i)
  })

  it('rejects on completed mesocycle', async () => {
    const meso = seedMesocycle({ status: 'completed' })
    const tmpl = seedMixedTemplate(meso.id)
    const s1 = seedSection(tmpl.id, 'resistance', 1)
    seedSection(tmpl.id, 'running', 2)
    seedSection(tmpl.id, 'mma', 3)

    const result = await removeSection(s1.id)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/completed/i)
  })

  it('deletes associated exercise_slots when removing a section', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    const s1 = seedSection(tmpl.id, 'resistance', 1, 'Lift A')
    const s2 = seedSection(tmpl.id, 'resistance', 2, 'Lift B')
    seedSection(tmpl.id, 'running', 3, 'Run')

    // Create exercise + slots tied to s1
    const ex = testDb
      .insert(schema.exercises)
      .values({ name: 'Bench Press', modality: 'resistance' })
      .returning({ id: schema.exercises.id })
      .get()
    testDb
      .insert(schema.exercise_slots)
      .values({ template_id: tmpl.id, exercise_id: ex.id, section_id: s1.id, sets: 3, reps: '8', order: 1 })
      .run()
    testDb
      .insert(schema.exercise_slots)
      .values({ template_id: tmpl.id, exercise_id: ex.id, section_id: s2.id, sets: 4, reps: '10', order: 2 })
      .run()

    const result = await removeSection(s1.id)
    expect(result.success).toBe(true)

    // Slots for s1 should be gone, slots for s2 remain
    const remainingSlots = testDb.select().from(schema.exercise_slots).all()
    expect(remainingSlots).toHaveLength(1)
    expect(remainingSlots[0].section_id).toBe(s2.id)
  })
})

// ============================================================================
// reorderSections
// ============================================================================

describe('reorderSections', () => {
  beforeEach(seedDb)

  it('reorders sections by new ID order', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    const s1 = seedSection(tmpl.id, 'resistance', 1, 'Lift')
    const s2 = seedSection(tmpl.id, 'running', 2, 'Run')

    const result = await reorderSections({
      template_id: tmpl.id,
      section_ids: [s2.id, s1.id],
    })
    expect(result.success).toBe(true)

    const sections = testDb
      .select()
      .from(schema.template_sections)
      .all()
      .sort((a: typeof schema.template_sections.$inferSelect, b: typeof schema.template_sections.$inferSelect) => a.order - b.order)
    expect(sections[0].id).toBe(s2.id)
    expect(sections[0].order).toBe(1)
    expect(sections[1].id).toBe(s1.id)
    expect(sections[1].order).toBe(2)
  })

  it('returns noop when order unchanged', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    const s1 = seedSection(tmpl.id, 'resistance', 1)
    const s2 = seedSection(tmpl.id, 'running', 2)

    const result = await reorderSections({
      template_id: tmpl.id,
      section_ids: [s1.id, s2.id],
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.noop).toBe(true)
  })

  it('rejects mismatched section IDs', async () => {
    const meso = seedMesocycle()
    const tmpl = seedMixedTemplate(meso.id)
    seedSection(tmpl.id, 'resistance', 1)
    seedSection(tmpl.id, 'running', 2)

    const result = await reorderSections({
      template_id: tmpl.id,
      section_ids: [999, 998],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/mismatch/i)
  })

  it('rejects non-existent template', async () => {
    const result = await reorderSections({
      template_id: 999,
      section_ids: [1, 2],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/template/i)
  })

  it('rejects non-mixed template', async () => {
    const meso = seedMesocycle()
    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: meso.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
        created_at: new Date(),
      })
      .returning()
      .get()

    const result = await reorderSections({
      template_id: tmpl.id,
      section_ids: [1, 2],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/mixed/i)
  })

  it('rejects on completed mesocycle', async () => {
    const meso = seedMesocycle({ status: 'completed' })
    const tmpl = seedMixedTemplate(meso.id)
    const s1 = seedSection(tmpl.id, 'resistance', 1)
    const s2 = seedSection(tmpl.id, 'running', 2)

    const result = await reorderSections({
      template_id: tmpl.id,
      section_ids: [s2.id, s1.id],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/completed/i)
  })
})
