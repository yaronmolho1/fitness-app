// Characterization test — captures current behavior for safe refactoring
// T200: getTodayWorkout multi-session, completed-meso fallback, schedule override integration
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

import { getTodayWorkout } from './queries'

function createTables() {
  testDb.run(sql`DROP TABLE IF EXISTS routine_logs`)
  testDb.run(sql`DROP TABLE IF EXISTS routine_items`)
  testDb.run(sql`DROP TABLE IF EXISTS template_week_overrides`)
  testDb.run(sql`DROP TABLE IF EXISTS slot_week_overrides`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_sets`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_exercises`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS schedule_week_overrides`)
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)
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
    CREATE TABLE exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      modality TEXT NOT NULL,
      muscle_group TEXT,
      equipment TEXT,
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
      target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
      planned_duration INTEGER, estimated_duration INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE exercise_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      section_id INTEGER,
      sets INTEGER NOT NULL,
      reps TEXT NOT NULL,
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
    CREATE TABLE template_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      section_name TEXT NOT NULL,
      modality TEXT NOT NULL,
      "order" INTEGER NOT NULL,
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
    )
  `)
  testDb.run(sql`
    CREATE TABLE weekly_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      week_type TEXT NOT NULL DEFAULT 'normal',
      period TEXT NOT NULL DEFAULT 'morning',
      time_slot TEXT NOT NULL DEFAULT '07:00',
      duration INTEGER NOT NULL DEFAULT 90,
      cycle_length INTEGER NOT NULL DEFAULT 1,
      cycle_position INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_position_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)`
  )
  testDb.run(sql`
    CREATE TABLE schedule_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      period TEXT NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      time_slot TEXT NOT NULL DEFAULT '07:00',
      duration INTEGER NOT NULL DEFAULT 90,
      override_group TEXT NOT NULL,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX schedule_week_overrides_meso_week_day_timeslot_template_idx ON schedule_week_overrides(mesocycle_id, week_number, day_of_week, time_slot, template_id)`
  )
  testDb.run(sql`
    CREATE TABLE slot_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_slot_id INTEGER NOT NULL REFERENCES exercise_slots(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      weight REAL,
      reps TEXT,
      sets INTEGER,
      rpe REAL,
      distance REAL,
      duration INTEGER,
      pace TEXT,
      is_deload INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE template_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      section_id INTEGER REFERENCES template_sections(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      pace TEXT,
      interval_count INTEGER,
      interval_rest INTEGER,
      distance REAL,
      duration INTEGER,
      elevation_gain INTEGER,
      planned_duration INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE logged_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      canonical_name TEXT,
      log_date TEXT NOT NULL,
      logged_at INTEGER NOT NULL,
      rating INTEGER,
      notes TEXT,
      template_snapshot TEXT NOT NULL,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE logged_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_workout_id INTEGER NOT NULL REFERENCES logged_workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER,
      exercise_name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      actual_rpe REAL,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE logged_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_exercise_id INTEGER NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      actual_reps INTEGER,
      actual_weight REAL,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE routine_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      has_weight INTEGER NOT NULL DEFAULT 0,
      has_length INTEGER NOT NULL DEFAULT 0,
      has_duration INTEGER NOT NULL DEFAULT 0,
      has_sets INTEGER NOT NULL DEFAULT 0,
      has_reps INTEGER NOT NULL DEFAULT 0,
      frequency_target INTEGER NOT NULL DEFAULT 1,
      scope TEXT NOT NULL DEFAULT 'global',
      mesocycle_id INTEGER REFERENCES mesocycles(id),
      start_date TEXT,
      end_date TEXT,
      skip_on_deload INTEGER NOT NULL DEFAULT 0,
      frequency_mode TEXT NOT NULL DEFAULT 'weekly_target',
      frequency_days TEXT,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE routine_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_item_id INTEGER NOT NULL REFERENCES routine_items(id),
      log_date TEXT NOT NULL,
      status TEXT NOT NULL,
      value_weight REAL,
      value_length REAL,
      value_duration REAL,
      value_sets INTEGER,
      value_reps INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX routine_logs_item_date_idx ON routine_logs(routine_item_id, log_date)`
  )
}

// === Seed helpers ===

function seedMesocycle(
  overrides: Partial<{
    name: string
    start_date: string
    end_date: string
    work_weeks: number
    has_deload: boolean
    status: string
  }> = {}
) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: overrides.name ?? 'Test Meso',
      start_date: overrides.start_date ?? '2026-03-01',
      end_date: overrides.end_date ?? '2026-03-28',
      work_weeks: overrides.work_weeks ?? 4,
      has_deload: overrides.has_deload ?? false,
      status: overrides.status ?? 'planned',
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedTemplate(
  mesocycleId: number,
  name = 'Push A',
  overrides: Partial<{ modality: string }> = {}
) {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name,
      canonical_name: name.toLowerCase().replace(/\s+/g, '-'),
      modality: overrides.modality ?? 'resistance',
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

function seedSchedule(
  mesoId: number,
  day: number,
  templateId: number,
  weekType = 'normal',
  period = 'morning',
  timeSlot = '07:00'
) {
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesoId,
      day_of_week: day,
      template_id: templateId,
      week_type: weekType,
      period,
      time_slot: timeSlot,
      created_at: new Date(),
    })
    .returning()
    .get()
}

function seedLoggedWorkout(
  templateId: number,
  logDate: string,
  canonicalName: string
) {
  return testDb
    .insert(schema.logged_workouts)
    .values({
      template_id: templateId,
      canonical_name: canonicalName,
      log_date: logDate,
      logged_at: new Date(),
      template_snapshot: {
        version: 1,
        name: canonicalName,
        modality: 'resistance',
      },
      created_at: new Date(),
    })
    .returning({ id: schema.logged_workouts.id })
    .get()
}

// ============================================================================
// Multi-session support (T114)
// ============================================================================

describe('getTodayWorkout — multi-session (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('returns multiple workout results for multi-session day', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const t1 = seedTemplate(meso.id, 'Push A')
    const t2 = seedTemplate(meso.id, 'Easy Run', { modality: 'running' })

    // Mar 10 = Tuesday (day_of_week 1)
    seedSchedule(meso.id, 1, t1.id, 'normal', 'morning', '08:00')
    seedSchedule(meso.id, 1, t2.id, 'normal', 'evening', '18:00')

    const results = await getTodayWorkout('2026-03-10')
    expect(results).toHaveLength(2)
    expect(results[0].type).toBe('workout')
    expect(results[1].type).toBe('workout')

    if (results[0].type === 'workout' && results[1].type === 'workout') {
      // Sorted morning before evening
      expect(results[0].period).toBe('morning')
      expect(results[0].template.name).toBe('Push A')
      expect(results[0].time_slot).toBe('08:00')
      expect(results[1].period).toBe('evening')
      expect(results[1].template.name).toBe('Easy Run')
      expect(results[1].time_slot).toBe('18:00')
    }
  })

  it('returns mix of workout and already_logged for multi-session', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const t1 = seedTemplate(meso.id, 'Push A')
    const t2 = seedTemplate(meso.id, 'Easy Run', { modality: 'running' })

    seedSchedule(meso.id, 1, t1.id, 'normal', 'morning', '08:00')
    seedSchedule(meso.id, 1, t2.id, 'normal', 'evening', '18:00')

    // Log only the morning session
    seedLoggedWorkout(t1.id, '2026-03-10', 'push-a')

    const results = await getTodayWorkout('2026-03-10')
    expect(results).toHaveLength(2)

    // Morning already_logged, evening workout
    const morning = results.find(
      (r) => 'period' in r && r.period === 'morning'
    )!
    const evening = results.find(
      (r) => 'period' in r && r.period === 'evening'
    )!
    expect(morning.type).toBe('already_logged')
    expect(evening.type).toBe('workout')
  })

  it('all sessions logged returns all already_logged', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const t1 = seedTemplate(meso.id, 'Push A')
    const t2 = seedTemplate(meso.id, 'Easy Run', { modality: 'running' })

    seedSchedule(meso.id, 1, t1.id, 'normal', 'morning', '08:00')
    seedSchedule(meso.id, 1, t2.id, 'normal', 'evening', '18:00')

    seedLoggedWorkout(t1.id, '2026-03-10', 'push-a')
    seedLoggedWorkout(t2.id, '2026-03-10', 'easy-run')

    const results = await getTodayWorkout('2026-03-10')
    expect(results).toHaveLength(2)
    expect(results[0].type).toBe('already_logged')
    expect(results[1].type).toBe('already_logged')
  })

  it('results sorted by period: morning < afternoon < evening', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const t1 = seedTemplate(meso.id, 'A')
    const t2 = seedTemplate(meso.id, 'B')
    const t3 = seedTemplate(meso.id, 'C')

    // Insert out of period order
    seedSchedule(meso.id, 1, t3.id, 'normal', 'evening', '18:00')
    seedSchedule(meso.id, 1, t1.id, 'normal', 'morning', '08:00')
    seedSchedule(meso.id, 1, t2.id, 'normal', 'afternoon', '14:00')

    const results = await getTodayWorkout('2026-03-10')
    expect(results).toHaveLength(3)
    if (
      results[0].type === 'workout' &&
      results[1].type === 'workout' &&
      results[2].type === 'workout'
    ) {
      expect(results[0].period).toBe('morning')
      expect(results[1].period).toBe('afternoon')
      expect(results[2].period).toBe('evening')
    }
  })
})

// ============================================================================
// Completed mesocycle fallback
// ============================================================================

describe('getTodayWorkout — completed mesocycle fallback (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('falls back to completed mesocycle when no active exists', async () => {
    const meso = seedMesocycle({
      status: 'completed',
      start_date: '2026-03-01',
    })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    expect(results[0].type).toBe('workout')
    if (results[0].type === 'workout') {
      expect(results[0].mesocycle.status).toBe('completed')
      expect(results[0].template.name).toBe('Push A')
    }
  })

  it('active mesocycle takes priority over completed', async () => {
    const completed = seedMesocycle({
      status: 'completed',
      start_date: '2026-03-01',
    })
    const active = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
    })

    const t1 = seedTemplate(completed.id, 'Completed Push')
    const t2 = seedTemplate(active.id, 'Active Push')
    seedSchedule(completed.id, 1, t1.id)
    seedSchedule(active.id, 1, t2.id)

    const results = await getTodayWorkout('2026-03-10')
    expect(results[0].type).toBe('workout')
    if (results[0].type === 'workout') {
      expect(results[0].mesocycle.status).toBe('active')
      expect(results[0].template.name).toBe('Active Push')
    }
  })

  it('planned mesocycle is not used (only active/completed)', async () => {
    seedMesocycle({
      status: 'planned',
      start_date: '2026-03-01',
    })

    const results = await getTodayWorkout('2026-03-10')
    expect(results[0].type).toBe('no_active_mesocycle')
  })
})

// ============================================================================
// Schedule override integration in getTodayWorkout
// ============================================================================

describe('getTodayWorkout — schedule override integration (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('uses overridden template from schedule_week_overrides', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const t1 = seedTemplate(meso.id, 'Push A')
    const t2 = seedTemplate(meso.id, 'Pull A')

    // Base: Tuesday morning = Push A
    seedSchedule(meso.id, 1, t1.id, 'normal', 'morning')

    // Override: week 2 Tuesday morning = Pull A
    testDb.run(sql`
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group)
      VALUES (${meso.id}, 2, 1, 'morning', ${t2.id}, 'move-1')
    `)

    // Mar 10 = Tuesday, week 2 from Mar 1
    const results = await getTodayWorkout('2026-03-10')
    expect(results[0].type).toBe('workout')
    if (results[0].type === 'workout') {
      expect(results[0].template.name).toBe('Pull A')
    }
  })

  it('override with null template_id makes rest day', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const t1 = seedTemplate(meso.id, 'Push A')

    // Base: Tuesday morning = Push A
    seedSchedule(meso.id, 1, t1.id, 'normal', 'morning')

    // Override: week 2 Tuesday morning = null (rest)
    testDb.run(sql`
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group)
      VALUES (${meso.id}, 2, 1, 'morning', NULL, 'move-1')
    `)

    // Mar 10 = Tuesday, week 2 from Mar 1
    const results = await getTodayWorkout('2026-03-10')
    expect(results[0].type).toBe('rest_day')
  })

  it('override adds session to previously empty day', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const t1 = seedTemplate(meso.id, 'Push A')

    // No base schedule for Tuesday
    // Override: week 2 Tuesday evening = Push A
    testDb.run(sql`
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (${meso.id}, 2, 1, 'evening', ${t1.id}, '18:00', 'move-1')
    `)

    const results = await getTodayWorkout('2026-03-10')
    expect(results[0].type).toBe('workout')
    if (results[0].type === 'workout') {
      expect(results[0].template.name).toBe('Push A')
      expect(results[0].period).toBe('evening')
      expect(results[0].time_slot).toBe('18:00')
    }
  })
})

// ============================================================================
// Week number computation
// ============================================================================

describe('getTodayWorkout — week number computation (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('week number is 1-based from mesocycle start_date', async () => {
    // Meso starts Mar 1 (Sun). Mar 1=w1, Mar 8=w2, Mar 10=w2
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const t1 = seedTemplate(meso.id, 'Push A')
    const t2 = seedTemplate(meso.id, 'Pull A')

    // Base: Tuesday = Push A
    seedSchedule(meso.id, 1, t1.id, 'normal', 'morning')

    // Override only week 1 Tue morning = Pull A
    testDb.run(sql`
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group)
      VALUES (${meso.id}, 1, 1, 'morning', ${t2.id}, 'move-1')
    `)

    // Mar 3 = Tuesday, week 1
    const week1 = await getTodayWorkout('2026-03-03')
    expect(week1[0].type).toBe('workout')
    if (week1[0].type === 'workout') {
      expect(week1[0].template.name).toBe('Pull A')
    }

    // Mar 10 = Tuesday, week 2 — no override, base schedule
    const week2 = await getTodayWorkout('2026-03-10')
    expect(week2[0].type).toBe('workout')
    if (week2[0].type === 'workout') {
      expect(week2[0].template.name).toBe('Push A')
    }
  })
})

// ============================================================================
// Period and time_slot on results
// ============================================================================

describe('getTodayWorkout — period/time_slot passthrough (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('workout result carries period and time_slot from effective schedule', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id, 'normal', 'afternoon', '14:30')

    const results = await getTodayWorkout('2026-03-10')
    if (results[0].type === 'workout') {
      expect(results[0].period).toBe('afternoon')
      expect(results[0].time_slot).toBe('14:30')
    }
  })

  it('already_logged result carries period and time_slot', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id, 'normal', 'evening', '19:00')
    seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')

    const results = await getTodayWorkout('2026-03-10')
    if (results[0].type === 'already_logged') {
      expect(results[0].period).toBe('evening')
      expect(results[0].time_slot).toBe('19:00')
    }
  })

  it('default period is morning with time_slot 07:00', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    // Use raw SQL to get schema defaults
    testDb.run(sql`
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (${meso.id}, 1, ${tmpl.id}, 'normal')
    `)

    const results = await getTodayWorkout('2026-03-10')
    if (results[0].type === 'workout') {
      expect(results[0].period).toBe('morning')
      expect(results[0].time_slot).toBe('07:00')
    }
  })
})
