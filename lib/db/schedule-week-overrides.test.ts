import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, getTableName } from 'drizzle-orm'
import {
  schedule_week_overrides,
  mesocycles,
  workout_templates,
} from './schema'
import { schedule_week_overridesRelations } from './relations'

function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE mesocycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL DEFAULT '2026-01-01',
      end_date TEXT NOT NULL DEFAULT '2026-02-01',
      work_weeks INTEGER NOT NULL DEFAULT 4,
      has_deload INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at INTEGER
    );
    CREATE TABLE workout_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      canonical_name TEXT NOT NULL,
      modality TEXT NOT NULL DEFAULT 'resistance',
      notes TEXT,
      run_type TEXT,
      target_pace TEXT,
      hr_zone INTEGER,
      interval_count INTEGER,
      interval_rest INTEGER,
      coaching_cues TEXT,
      target_distance REAL,
      target_duration INTEGER,
      target_elevation_gain INTEGER,
      planned_duration INTEGER,
      created_at INTEGER
    );
    CREATE TABLE schedule_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      period TEXT NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      time_slot TEXT,
      override_group TEXT NOT NULL,
      created_at INTEGER
    );
    CREATE UNIQUE INDEX schedule_week_overrides_meso_week_day_period_idx
      ON schedule_week_overrides (mesocycle_id, week_number, day_of_week, period);
  `)
  return {
    db: drizzle(sqlite, {
      schema: { schedule_week_overrides, mesocycles, workout_templates },
    }),
    sqlite,
  }
}

function seedMeso(
  db: ReturnType<typeof createTestDb>['db'],
  name = 'Test Meso'
) {
  db.insert(mesocycles)
    .values({
      name,
      start_date: '2026-01-01',
      end_date: '2026-02-01',
      work_weeks: 4,
    })
    .run()
  return db.select().from(mesocycles).all().at(-1)!
}

function seedTemplate(
  db: ReturnType<typeof createTestDb>['db'],
  mesoId: number
) {
  db.insert(workout_templates)
    .values({
      mesocycle_id: mesoId,
      name: 'Push Day',
      canonical_name: 'push-day',
      modality: 'resistance',
    })
    .run()
  return db.select().from(workout_templates).all()[0]
}

describe('schedule_week_overrides schema', () => {
  it('exports schedule_week_overrides table', () => {
    expect(schedule_week_overrides).toBeDefined()
  })

  it('has correct table name', () => {
    expect(getTableName(schedule_week_overrides)).toBe(
      'schedule_week_overrides'
    )
  })

  it('inserts and reads a valid override row', () => {
    const { db } = createTestDb()
    const meso = seedMeso(db)
    const tmpl = seedTemplate(db, meso.id)

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 2,
        day_of_week: 1,
        period: 'morning',
        template_id: tmpl.id,
        time_slot: '07:00',
        override_group: 'move-001',
      })
      .run()

    const rows = db.select().from(schedule_week_overrides).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].mesocycle_id).toBe(meso.id)
    expect(rows[0].week_number).toBe(2)
    expect(rows[0].day_of_week).toBe(1)
    expect(rows[0].period).toBe('morning')
    expect(rows[0].template_id).toBe(tmpl.id)
    expect(rows[0].time_slot).toBe('07:00')
    expect(rows[0].override_group).toBe('move-001')
    expect(rows[0].id).toBe(1)
  })

  it('allows null template_id (rest/removed)', () => {
    const { db } = createTestDb()
    const meso = seedMeso(db)

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 1,
        day_of_week: 3,
        period: 'afternoon',
        template_id: null,
        override_group: 'move-002',
      })
      .run()

    const rows = db.select().from(schedule_week_overrides).all()
    expect(rows[0].template_id).toBeNull()
  })

  it('allows null time_slot', () => {
    const { db } = createTestDb()
    const meso = seedMeso(db)

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 1,
        day_of_week: 0,
        period: 'evening',
        override_group: 'move-003',
      })
      .run()

    const rows = db.select().from(schedule_week_overrides).all()
    expect(rows[0].time_slot).toBeNull()
  })

  it('enforces unique constraint on (mesocycle_id, week_number, day_of_week, period)', () => {
    const { db } = createTestDb()
    const meso = seedMeso(db)

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 1,
        day_of_week: 2,
        period: 'morning',
        override_group: 'move-004',
      })
      .run()

    expect(() =>
      db
        .insert(schedule_week_overrides)
        .values({
          mesocycle_id: meso.id,
          week_number: 1,
          day_of_week: 2,
          period: 'morning',
          override_group: 'move-005',
        })
        .run()
    ).toThrow()
  })

  it('allows same day+period for different weeks', () => {
    const { db } = createTestDb()
    const meso = seedMeso(db)

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 1,
        day_of_week: 2,
        period: 'morning',
        override_group: 'move-006',
      })
      .run()

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 2,
        day_of_week: 2,
        period: 'morning',
        override_group: 'move-006',
      })
      .run()

    const rows = db.select().from(schedule_week_overrides).all()
    expect(rows).toHaveLength(2)
  })

  it('allows same week+day for different periods', () => {
    const { db } = createTestDb()
    const meso = seedMeso(db)

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 1,
        day_of_week: 3,
        period: 'morning',
        override_group: 'move-007',
      })
      .run()

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 1,
        day_of_week: 3,
        period: 'afternoon',
        override_group: 'move-007',
      })
      .run()

    const rows = db.select().from(schedule_week_overrides).all()
    expect(rows).toHaveLength(2)
  })

  it('allows same week+day+period for different mesocycles', () => {
    const { db } = createTestDb()
    const mesoA = seedMeso(db, 'Meso A')
    const mesoB = seedMeso(db, 'Meso B')

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: mesoA.id,
        week_number: 1,
        day_of_week: 0,
        period: 'morning',
        override_group: 'move-008',
      })
      .run()

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: mesoB.id,
        week_number: 1,
        day_of_week: 0,
        period: 'morning',
        override_group: 'move-009',
      })
      .run()

    const rows = db.select().from(schedule_week_overrides).all()
    expect(rows).toHaveLength(2)
  })

  it('cascades delete when mesocycle is deleted', () => {
    const { db } = createTestDb()
    const meso = seedMeso(db)

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 1,
        day_of_week: 4,
        period: 'evening',
        override_group: 'move-010',
      })
      .run()

    expect(db.select().from(schedule_week_overrides).all()).toHaveLength(1)

    db.delete(mesocycles).where(eq(mesocycles.id, meso.id)).run()

    expect(db.select().from(schedule_week_overrides).all()).toHaveLength(0)
  })

  it('rejects insert with non-existent mesocycle_id', () => {
    const { db } = createTestDb()

    expect(() =>
      db
        .insert(schedule_week_overrides)
        .values({
          mesocycle_id: 999,
          week_number: 1,
          day_of_week: 0,
          period: 'morning',
          override_group: 'move-011',
        })
        .run()
    ).toThrow()
  })

  it('has auto-increment integer PK', () => {
    const { db } = createTestDb()
    const meso = seedMeso(db)

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 1,
        day_of_week: 0,
        period: 'morning',
        override_group: 'move-012',
      })
      .run()

    db.insert(schedule_week_overrides)
      .values({
        mesocycle_id: meso.id,
        week_number: 1,
        day_of_week: 1,
        period: 'morning',
        override_group: 'move-012',
      })
      .run()

    const rows = db.select().from(schedule_week_overrides).all()
    expect(rows[0].id).toBe(1)
    expect(rows[1].id).toBe(2)
  })

  it('exports relations definition', () => {
    expect(schedule_week_overridesRelations).toBeDefined()
  })
})
