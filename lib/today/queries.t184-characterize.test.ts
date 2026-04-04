// Characterization test — T184: captures current schedule resolution behavior
// before replacing direct weekly_schedule query with getEffectiveScheduleForDay()
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
  testDb.run(sql`DROP TABLE IF EXISTS logged_sets`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_exercises`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
  testDb.run(sql`DROP TABLE IF EXISTS slot_week_overrides`)
  testDb.run(sql`DROP TABLE IF EXISTS template_week_overrides`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS schedule_week_overrides`)
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
  // schedule_week_overrides table — exists in schema but NOT consulted by current code
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
      target_distance REAL, target_duration INTEGER,
      planned_duration INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE slot_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_slot_id INTEGER NOT NULL REFERENCES exercise_slots(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      weight REAL, reps TEXT, sets INTEGER, rpe REAL,
      distance REAL, duration INTEGER, pace TEXT, planned_duration INTEGER,
      interval_count INTEGER, interval_rest INTEGER, elevation_gain INTEGER,
      is_deload INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX slot_week_overrides_slot_week_idx ON slot_week_overrides(exercise_slot_id, week_number)`
  )
  testDb.run(sql`
    CREATE TABLE template_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      section_id INTEGER REFERENCES template_sections(id),
      week_number INTEGER NOT NULL,
      pace TEXT, distance REAL, duration INTEGER, planned_duration INTEGER,
      interval_count INTEGER, interval_rest INTEGER, elevation_gain INTEGER,
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

// Seed helpers
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
      start_date: overrides.start_date ?? '2026-03-02',
      end_date: overrides.end_date ?? '2026-03-29',
      work_weeks: overrides.work_weeks ?? 4,
      has_deload: overrides.has_deload ?? false,
      status: overrides.status ?? 'planned',
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedExercise(name: string, modality = 'resistance') {
  return testDb
    .insert(schema.exercises)
    .values({ name, modality, created_at: new Date() })
    .returning({ id: schema.exercises.id })
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
  timeSlot?: string
) {
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesoId,
      day_of_week: day,
      template_id: templateId,
      week_type: weekType,
      period,
      time_slot: timeSlot ?? (period === 'morning' ? '07:00' : period === 'afternoon' ? '13:00' : '18:00'),
      created_at: new Date(),
    })
    .returning()
    .get()
}

function seedExerciseSlot(templateId: number, exerciseId: number, order: number) {
  return testDb
    .insert(schema.exercise_slots)
    .values({
      template_id: templateId,
      exercise_id: exerciseId,
      sets: 3,
      reps: '8-10',
      order,
      is_main: false,
      created_at: new Date(),
    })
    .returning({ id: schema.exercise_slots.id })
    .get()
}

// ============================================================================
// Schedule resolution — base weekly_schedule query (T184 will replace)
// ============================================================================

describe('getTodayWorkout — schedule resolution baseline (T184 characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('resolves workout from weekly_schedule for matching day_of_week + week_type', async () => {
    // 2026-03-02 is Monday (day_of_week=0)
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-02' })
    const ex = seedExercise('Bench Press')
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedExerciseSlot(tmpl.id, ex.id, 1)
    seedSchedule(meso.id, 0, tmpl.id) // Mon, normal

    const results = await getTodayWorkout('2026-03-02')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('workout')
    if (results[0].type === 'workout') {
      expect(results[0].template.name).toBe('Push A')
    }
  })

  it('returns rest_day when no schedule entry for day_of_week', async () => {
    // 2026-03-03 is Tuesday (day_of_week=1), schedule only on Monday
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-02' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 0, tmpl.id) // Mon only

    const results = await getTodayWorkout('2026-03-03')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('rest_day')
  })

  it('uses normal week_type during work weeks', async () => {
    // 4 work weeks, has_deload. Week 1 = normal.
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-02',
      end_date: '2026-04-05',
      work_weeks: 4,
      has_deload: true,
    })
    const ex = seedExercise('Squat')
    const tmplNormal = seedTemplate(meso.id, 'Legs Normal')
    const tmplDeload = seedTemplate(meso.id, 'Legs Deload')
    seedExerciseSlot(tmplNormal.id, ex.id, 1)
    seedExerciseSlot(tmplDeload.id, ex.id, 1)
    seedSchedule(meso.id, 0, tmplNormal.id, 'normal')
    seedSchedule(meso.id, 0, tmplDeload.id, 'deload')

    // Week 1 Monday
    const results = await getTodayWorkout('2026-03-02')
    expect(results).toHaveLength(1)
    if (results[0].type === 'workout') {
      expect(results[0].template.name).toBe('Legs Normal')
      expect(results[0].mesocycle.week_type).toBe('normal')
    }
  })

  it('uses deload week_type during deload week', async () => {
    // 2 work weeks + deload. Start 2026-03-02 (Mon).
    // Week 3 starts 2026-03-16 = deload week.
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-02',
      end_date: '2026-03-22',
      work_weeks: 2,
      has_deload: true,
    })
    const ex = seedExercise('Bench Press')
    const tmplNormal = seedTemplate(meso.id, 'Push Normal')
    const tmplDeload = seedTemplate(meso.id, 'Push Deload')
    seedExerciseSlot(tmplNormal.id, ex.id, 1)
    seedExerciseSlot(tmplDeload.id, ex.id, 1)
    seedSchedule(meso.id, 0, tmplNormal.id, 'normal')
    seedSchedule(meso.id, 0, tmplDeload.id, 'deload')

    // 2026-03-16 is Monday, deload week
    const results = await getTodayWorkout('2026-03-16')
    expect(results).toHaveLength(1)
    if (results[0].type === 'workout') {
      expect(results[0].template.name).toBe('Push Deload')
      expect(results[0].mesocycle.week_type).toBe('deload')
    }
  })

  it('returns multiple sessions for same day with different periods', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-02' })
    const ex = seedExercise('Bench Press')
    const tmpl1 = seedTemplate(meso.id, 'Morning Push')
    const tmpl2 = seedTemplate(meso.id, 'Evening Run', { modality: 'running' })
    seedExerciseSlot(tmpl1.id, ex.id, 1)
    seedSchedule(meso.id, 0, tmpl1.id, 'normal', 'morning', '07:00')
    seedSchedule(meso.id, 0, tmpl2.id, 'normal', 'evening', '18:00')

    const results = await getTodayWorkout('2026-03-02')
    expect(results).toHaveLength(2)
    // Sorted: morning first, evening second
    if (results[0].type === 'workout' && results[1].type === 'workout') {
      expect(results[0].period).toBe('morning')
      expect(results[0].template.name).toBe('Morning Push')
      expect(results[0].time_slot).toBe('07:00')
      expect(results[1].period).toBe('evening')
      expect(results[1].template.name).toBe('Evening Run')
      expect(results[1].time_slot).toBe('18:00')
    }
  })

  it('schedule_week_overrides swap template for the overridden week', async () => {
    // Override swaps template — now respected via getEffectiveScheduleForDay
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-02' })
    const ex = seedExercise('Bench Press')
    const tmpl1 = seedTemplate(meso.id, 'Base Push')
    const tmpl2 = seedTemplate(meso.id, 'Override Pull')
    seedExerciseSlot(tmpl1.id, ex.id, 1)
    seedExerciseSlot(tmpl2.id, ex.id, 1)
    seedSchedule(meso.id, 0, tmpl1.id, 'normal', 'morning')

    // Insert an override for week 1, day 0, at same time_slot as base
    testDb.run(sql`
      INSERT INTO schedule_week_overrides
        (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES
        (${meso.id}, 1, 0, 'morning', ${tmpl2.id}, '07:00', 'move-test')
    `)

    const results = await getTodayWorkout('2026-03-02')
    expect(results).toHaveLength(1)
    // Override template is returned
    if (results[0].type === 'workout') {
      expect(results[0].template.name).toBe('Override Pull')
      expect(results[0].time_slot).toBe('07:00')
    }
  })

  it('schedule_week_overrides null template_id causes rest day', async () => {
    // Override sets template_id=NULL (rest override) — now respected
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-02' })
    const ex = seedExercise('Squat')
    const tmpl = seedTemplate(meso.id, 'Legs')
    seedExerciseSlot(tmpl.id, ex.id, 1)
    seedSchedule(meso.id, 0, tmpl.id, 'normal', 'morning')

    testDb.run(sql`
      INSERT INTO schedule_week_overrides
        (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES
        (${meso.id}, 1, 0, 'morning', NULL, '07:00', 'move-rest')
    `)

    const results = await getTodayWorkout('2026-03-02')
    expect(results).toHaveLength(1)
    // Null template override = rest day
    expect(results[0].type).toBe('rest_day')
  })

  it('override-only entry (no base for period) now appears', async () => {
    // Override adds a workout to evening, no base evening entry — now included
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-02' })
    const ex = seedExercise('Bench Press')
    const tmpl1 = seedTemplate(meso.id, 'Morning Push')
    const tmpl2 = seedTemplate(meso.id, 'Evening Add')
    seedExerciseSlot(tmpl1.id, ex.id, 1)
    seedExerciseSlot(tmpl2.id, ex.id, 1)
    seedSchedule(meso.id, 0, tmpl1.id, 'normal', 'morning')

    testDb.run(sql`
      INSERT INTO schedule_week_overrides
        (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES
        (${meso.id}, 1, 0, 'evening', ${tmpl2.id}, '19:00', 'move-add')
    `)

    const results = await getTodayWorkout('2026-03-02')
    // Both morning (base) and evening (override-only) appear
    expect(results).toHaveLength(2)
    if (results[0].type === 'workout' && results[1].type === 'workout') {
      expect(results[0].period).toBe('morning')
      expect(results[0].template.name).toBe('Morning Push')
      expect(results[1].period).toBe('evening')
      expect(results[1].template.name).toBe('Evening Add')
      expect(results[1].time_slot).toBe('19:00')
    }
  })

  it('completed mesocycle still resolves schedule (retroactive logging)', async () => {
    const meso = seedMesocycle({
      status: 'completed',
      start_date: '2026-03-02',
    })
    const ex = seedExercise('Bench Press')
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedExerciseSlot(tmpl.id, ex.id, 1)
    seedSchedule(meso.id, 0, tmpl.id)

    const results = await getTodayWorkout('2026-03-02')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('workout')
  })

  it('active mesocycle takes precedence over completed for same date range', async () => {
    const completedMeso = seedMesocycle({
      name: 'Completed',
      status: 'completed',
      start_date: '2026-03-02',
      end_date: '2026-03-29',
    })
    const activeMeso = seedMesocycle({
      name: 'Active',
      status: 'active',
      start_date: '2026-03-02',
      end_date: '2026-03-29',
    })
    const ex = seedExercise('Bench Press')
    const tmplCompleted = seedTemplate(completedMeso.id, 'Old Push')
    const tmplActive = seedTemplate(activeMeso.id, 'New Push')
    seedExerciseSlot(tmplCompleted.id, ex.id, 1)
    seedExerciseSlot(tmplActive.id, ex.id, 1)
    seedSchedule(completedMeso.id, 0, tmplCompleted.id)
    seedSchedule(activeMeso.id, 0, tmplActive.id)

    const results = await getTodayWorkout('2026-03-02')
    expect(results).toHaveLength(1)
    if (results[0].type === 'workout') {
      expect(results[0].template.name).toBe('New Push')
    }
  })
})
