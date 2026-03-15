import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import { getProgressionData } from './queries'

let sqlite: Database.Database
let db: AppDb

const CREATE_SQL = `
  CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    muscle_group TEXT,
    equipment TEXT,
    created_at INTEGER
  );
  CREATE TABLE mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    work_weeks INTEGER NOT NULL,
    has_deload INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at INTEGER
  );
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
    planned_duration INTEGER,
    created_at INTEGER
  );
  CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    sets INTEGER NOT NULL,
    reps TEXT NOT NULL,
    weight REAL,
    rpe REAL,
    rest_seconds INTEGER,
    guidelines TEXT,
    "order" INTEGER NOT NULL,
    is_main INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  );
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
  );
  CREATE TABLE logged_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_workout_id INTEGER NOT NULL REFERENCES logged_workouts(id) ON DELETE CASCADE,
    exercise_id INTEGER,
    exercise_name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    created_at INTEGER
  );
  CREATE TABLE logged_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_exercise_id INTEGER NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    actual_reps INTEGER,
    actual_weight REAL,
    actual_rpe REAL,
    created_at INTEGER
  );
`

function seedTwoMesocycles() {
  sqlite.exec(`
    INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
    VALUES
      (1, 'Block A', '2026-01-01', '2026-02-01', 4, 'completed'),
      (2, 'Block B', '2026-02-01', '2026-03-01', 4, 'active');

    INSERT INTO exercises (id, name, modality, muscle_group, equipment)
    VALUES
      (10, 'Bench Press', 'resistance', 'Chest', 'Barbell'),
      (20, 'Squat', 'resistance', 'Legs', 'Barbell');

    INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
    VALUES
      (1, 1, 'Push A', 'push-a', 'resistance'),
      (2, 2, 'Push A v2', 'push-a', 'resistance');

    INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, "order", is_main)
    VALUES
      (1, 10, 3, '8', 80.0, 1, 1),
      (2, 10, 4, '6', 90.0, 1, 1);
  `)
}

function insertLoggedWorkout(opts: {
  templateId: number
  canonicalName: string
  logDate: string
  mesocycleName: string
  snapshot: Record<string, unknown>
  exercises: Array<{
    exerciseId: number
    exerciseName: string
    order: number
    sets: Array<{ reps: number; weight: number | null }>
  }>
}) {
  const workoutId = sqlite
    .prepare(
      `INSERT INTO logged_workouts (template_id, canonical_name, log_date, logged_at, template_snapshot)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      opts.templateId,
      opts.canonicalName,
      opts.logDate,
      Math.floor(Date.now() / 1000),
      JSON.stringify(opts.snapshot)
    ).lastInsertRowid as number

  for (const ex of opts.exercises) {
    const exId = sqlite
      .prepare(
        `INSERT INTO logged_exercises (logged_workout_id, exercise_id, exercise_name, "order")
         VALUES (?, ?, ?, ?)`
      )
      .run(workoutId, ex.exerciseId, ex.exerciseName, ex.order)
      .lastInsertRowid as number

    for (let i = 0; i < ex.sets.length; i++) {
      sqlite
        .prepare(
          `INSERT INTO logged_sets (logged_exercise_id, set_number, actual_reps, actual_weight)
           VALUES (?, ?, ?, ?)`
        )
        .run(exId, i + 1, ex.sets[i].reps, ex.sets[i].weight)
    }
  }
}

describe('getProgressionData', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
    sqlite.exec(CREATE_SQL)
  })

  afterEach(() => {
    sqlite?.close()
  })

  it('returns empty array when no logs exist for canonical_name', async () => {
    seedTwoMesocycles()
    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    expect(result).toEqual({ data: [], phases: [] })
  })

  it('returns time-ordered data points for a single mesocycle', async () => {
    seedTwoMesocycles()

    // Log two workouts in Block A
    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-08',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: 80, is_main: true },
        ],
      },
      exercises: [
        {
          exerciseId: 10,
          exerciseName: 'Bench Press',
          order: 1,
          sets: [
            { reps: 8, weight: 80 },
            { reps: 8, weight: 80 },
            { reps: 7, weight: 80 },
          ],
        },
      ],
    })

    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-15',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: 82.5, is_main: true },
        ],
      },
      exercises: [
        {
          exerciseId: 10,
          exerciseName: 'Bench Press',
          order: 1,
          sets: [
            { reps: 8, weight: 82.5 },
            { reps: 7, weight: 82.5 },
            { reps: 6, weight: 82.5 },
          ],
        },
      ],
    })

    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    expect(result.data).toHaveLength(2)

    // Time-ordered
    expect(result.data[0].date).toBe('2026-01-08')
    expect(result.data[1].date).toBe('2026-01-15')

    // Top-set weight (heaviest set)
    expect(result.data[0].actualWeight).toBe(80)
    expect(result.data[1].actualWeight).toBe(82.5)

    // Planned weight from snapshot
    expect(result.data[0].plannedWeight).toBe(80)
    expect(result.data[1].plannedWeight).toBe(82.5)
  })

  it('cross-phase: returns data from multiple mesocycles via canonical_name', async () => {
    seedTwoMesocycles()

    // One log in Block A
    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-10',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: 80, is_main: true },
        ],
      },
      exercises: [
        {
          exerciseId: 10,
          exerciseName: 'Bench Press',
          order: 1,
          sets: [{ reps: 8, weight: 80 }],
        },
      ],
    })

    // One log in Block B with same canonical_name
    insertLoggedWorkout({
      templateId: 2,
      canonicalName: 'push-a',
      logDate: '2026-02-10',
      mesocycleName: 'Block B',
      snapshot: {
        version: 1,
        name: 'Push A v2',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 4, target_reps: '6', target_weight: 90, is_main: true },
        ],
      },
      exercises: [
        {
          exerciseId: 10,
          exerciseName: 'Bench Press',
          order: 1,
          sets: [{ reps: 6, weight: 90 }],
        },
      ],
    })

    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    expect(result.data).toHaveLength(2)
    expect(result.data[0].date).toBe('2026-01-10')
    expect(result.data[1].date).toBe('2026-02-10')
  })

  it('filters by exercise_id when provided', async () => {
    seedTwoMesocycles()

    // Template with two exercises; log both
    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-08',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: 80, is_main: true },
          { exercise_name: 'Squat', target_sets: 3, target_reps: '5', target_weight: 100, is_main: false },
        ],
      },
      exercises: [
        {
          exerciseId: 10,
          exerciseName: 'Bench Press',
          order: 1,
          sets: [{ reps: 8, weight: 80 }],
        },
        {
          exerciseId: 20,
          exerciseName: 'Squat',
          order: 2,
          sets: [{ reps: 5, weight: 100 }],
        },
      ],
    })

    // Filter to Bench Press only
    const result = await getProgressionData(db, {
      canonicalName: 'push-a',
      exerciseId: 10,
    })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].actualWeight).toBe(80)

    // Filter to Squat only
    const sqResult = await getProgressionData(db, {
      canonicalName: 'push-a',
      exerciseId: 20,
    })
    expect(sqResult.data).toHaveLength(1)
    expect(sqResult.data[0].actualWeight).toBe(100)
  })

  it('planned data comes from template_snapshot, not live slots', async () => {
    seedTwoMesocycles()

    // Snapshot says 80kg target, but live slot is different (we test the snapshot is used)
    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-08',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: 75, is_main: true },
        ],
      },
      exercises: [
        {
          exerciseId: 10,
          exerciseName: 'Bench Press',
          order: 1,
          sets: [{ reps: 8, weight: 80 }],
        },
      ],
    })

    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    // Planned weight should be 75 from snapshot, not 80 from live slot
    expect(result.data[0].plannedWeight).toBe(75)
    expect(result.data[0].actualWeight).toBe(80)
  })

  it('top-set weight: picks heaviest set from a session', async () => {
    seedTwoMesocycles()

    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-08',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: 80, is_main: true },
        ],
      },
      exercises: [
        {
          exerciseId: 10,
          exerciseName: 'Bench Press',
          order: 1,
          sets: [
            { reps: 8, weight: 75 },
            { reps: 6, weight: 85 },
            { reps: 8, weight: 80 },
          ],
        },
      ],
    })

    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    expect(result.data[0].actualWeight).toBe(85) // heaviest set
  })

  it('volume calculation: sum of (reps * weight) across all sets', async () => {
    seedTwoMesocycles()

    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-08',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: 80, is_main: true },
        ],
      },
      exercises: [
        {
          exerciseId: 10,
          exerciseName: 'Bench Press',
          order: 1,
          sets: [
            { reps: 8, weight: 80 },
            { reps: 8, weight: 80 },
            { reps: 7, weight: 80 },
          ],
        },
      ],
    })

    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    // Volume = (8*80) + (8*80) + (7*80) = 640 + 640 + 560 = 1840
    expect(result.data[0].actualVolume).toBe(1840)
    // Planned volume = target_sets * target_reps * target_weight = 3 * 8 * 80 = 1920
    expect(result.data[0].plannedVolume).toBe(1920)
  })

  it('handles session with null planned weight', async () => {
    seedTwoMesocycles()

    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-08',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: null, is_main: true },
        ],
      },
      exercises: [
        {
          exerciseId: 10,
          exerciseName: 'Bench Press',
          order: 1,
          sets: [{ reps: 8, weight: 80 }],
        },
      ],
    })

    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    expect(result.data[0].plannedWeight).toBeNull()
    expect(result.data[0].actualWeight).toBe(80)
  })

  it('returns empty for unknown canonical_name', async () => {
    seedTwoMesocycles()
    const result = await getProgressionData(db, { canonicalName: 'nonexistent' })
    expect(result.data).toEqual([])
  })

  it('returns phases array with mesocycle date boundaries', async () => {
    seedTwoMesocycles()

    // Log in both blocks
    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-10',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: 80, is_main: true },
        ],
      },
      exercises: [
        { exerciseId: 10, exerciseName: 'Bench Press', order: 1, sets: [{ reps: 8, weight: 80 }] },
      ],
    })

    insertLoggedWorkout({
      templateId: 2,
      canonicalName: 'push-a',
      logDate: '2026-02-10',
      mesocycleName: 'Block B',
      snapshot: {
        version: 1,
        name: 'Push A v2',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 4, target_reps: '6', target_weight: 90, is_main: true },
        ],
      },
      exercises: [
        { exerciseId: 10, exerciseName: 'Bench Press', order: 1, sets: [{ reps: 6, weight: 90 }] },
      ],
    })

    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    expect(result.phases).toBeDefined()
    expect(result.phases).toHaveLength(2)
    expect(result.phases).toEqual([
      { mesocycleId: 1, mesocycleName: 'Block A', startDate: '2026-01-01', endDate: '2026-02-01' },
      { mesocycleId: 2, mesocycleName: 'Block B', startDate: '2026-02-01', endDate: '2026-03-01' },
    ])
  })

  it('phases only includes mesocycles with data points', async () => {
    seedTwoMesocycles()

    // Only log in Block A, not Block B
    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-10',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: 80, is_main: true },
        ],
      },
      exercises: [
        { exerciseId: 10, exerciseName: 'Bench Press', order: 1, sets: [{ reps: 8, weight: 80 }] },
      ],
    })

    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    expect(result.phases).toHaveLength(1)
    expect(result.phases[0].mesocycleId).toBe(1)
  })

  it('phases empty when no data', async () => {
    seedTwoMesocycles()
    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    expect(result.phases).toEqual([])
  })

  it('includes mesocycle info in each data point', async () => {
    seedTwoMesocycles()

    insertLoggedWorkout({
      templateId: 1,
      canonicalName: 'push-a',
      logDate: '2026-01-08',
      mesocycleName: 'Block A',
      snapshot: {
        version: 1,
        name: 'Push A',
        modality: 'resistance',
        slots: [
          { exercise_name: 'Bench Press', target_sets: 3, target_reps: '8', target_weight: 80, is_main: true },
        ],
      },
      exercises: [
        {
          exerciseId: 10,
          exerciseName: 'Bench Press',
          order: 1,
          sets: [{ reps: 8, weight: 80 }],
        },
      ],
    })

    const result = await getProgressionData(db, { canonicalName: 'push-a' })
    expect(result.data[0].mesocycleId).toBe(1)
    expect(result.data[0].mesocycleName).toBe('Block A')
  })
})
