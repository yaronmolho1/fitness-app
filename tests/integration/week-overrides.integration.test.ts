import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../lib/db/schema'
import * as relationsModule from '../../lib/db/relations'
import type { AppDb } from '../../lib/db'
import {
  upsertWeekOverride,
  deleteWeekOverride,
  getWeekOverrides,
} from '../../lib/progression/week-overrides'

const fullSchema = { ...schema, ...relationsModule }

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
    target_distance REAL,
    target_duration INTEGER,
    planned_duration INTEGER,
    created_at INTEGER
  );
  CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER,
    sets INTEGER NOT NULL,
    reps TEXT NOT NULL,
    weight REAL,
    rpe REAL,
    rest_seconds INTEGER,
    duration INTEGER,
    group_id INTEGER,
    group_rest_seconds INTEGER,
    guidelines TEXT,
    "order" INTEGER NOT NULL,
    is_main INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  );
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
    planned_duration INTEGER,
    interval_count INTEGER,
    interval_rest INTEGER,
    is_deload INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER,
    UNIQUE(exercise_slot_id, week_number)
  );
`

describe('week override CRUD', () => {
  let sqlite: Database.Database
  let db: AppDb
  let slotId: number

  beforeAll(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema: fullSchema }) as AppDb
    sqlite.exec(CREATE_SQL)
  })

  afterAll(() => {
    sqlite?.close()
  })

  beforeEach(() => {
    // Clean all tables in reverse FK order
    sqlite.exec('DELETE FROM slot_week_overrides')
    sqlite.exec('DELETE FROM exercise_slots')
    sqlite.exec('DELETE FROM workout_templates')
    sqlite.exec('DELETE FROM mesocycles')
    sqlite.exec('DELETE FROM exercises')

    // Seed base data
    sqlite.exec(`
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench Press', 'resistance');
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
        VALUES (1, 'Block A', '2026-01-01', '2026-02-28', 4, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, weight, rpe, "order")
        VALUES (1, 1, 1, 3, '8-10', 60.0, 7.0, 1);
    `)
    slotId = 1
  })

  describe('upsertWeekOverride', () => {
    it('inserts a new override', async () => {
      const result = await upsertWeekOverride(db, slotId, 2, {
        weight: 62.5,
        reps: '8',
        sets: 3,
        rpe: 7.5,
      })

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.exercise_slot_id).toBe(slotId)
      expect(result.data.week_number).toBe(2)
      expect(result.data.weight).toBe(62.5)
      expect(result.data.reps).toBe('8')
      expect(result.data.sets).toBe(3)
      expect(result.data.rpe).toBe(7.5)
    })

    it('updates an existing override (upsert)', async () => {
      // First insert
      await upsertWeekOverride(db, slotId, 2, { weight: 62.5 })

      // Upsert same slot+week with new values
      const result = await upsertWeekOverride(db, slotId, 2, { weight: 65 })

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.weight).toBe(65)

      // Verify only one row exists
      const all = db.select().from(schema.slot_week_overrides).all()
      expect(all).toHaveLength(1)
    })

    it('supports partial field updates on upsert', async () => {
      // Insert with weight and rpe
      await upsertWeekOverride(db, slotId, 1, { weight: 60, rpe: 7 })

      // Upsert with only weight changed
      const result = await upsertWeekOverride(db, slotId, 1, { weight: 65 })

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.weight).toBe(65)
      expect(result.data.rpe).toBe(7)
    })

    it('supports is_deload flag', async () => {
      const result = await upsertWeekOverride(db, slotId, 5, {
        weight: 36,
        sets: 2,
        is_deload: true,
      })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.is_deload).toBe(1)
    })

    it('supports running/cardio fields', async () => {
      const result = await upsertWeekOverride(db, slotId, 1, {
        distance: 5.0,
        duration: 25,
        pace: '5:00',
      })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.distance).toBe(5.0)
      expect(result.data.duration).toBe(25)
      expect(result.data.pace).toBe('5:00')
    })

    it('rejects invalid slotId', async () => {
      const result = await upsertWeekOverride(db, 999, 1, { weight: 60 })
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toMatch(/slot not found/i)
    })

    it('rejects non-positive week number', async () => {
      const result = await upsertWeekOverride(db, slotId, 0, { weight: 60 })
      expect(result.success).toBe(false)
    })

    it('accepts weight of 0 (bodyweight exercises)', async () => {
      const result = await upsertWeekOverride(db, slotId, 1, { weight: 0 })
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.weight).toBe(0)
    })
  })

  describe('deleteWeekOverride', () => {
    it('deletes an existing override', async () => {
      await upsertWeekOverride(db, slotId, 2, { weight: 62.5 })

      const result = await deleteWeekOverride(db, slotId, 2)
      expect(result.success).toBe(true)

      // Verify it's gone
      const remaining = db.select().from(schema.slot_week_overrides).all()
      expect(remaining).toHaveLength(0)
    })

    it('returns success (no-op) when override does not exist', async () => {
      const result = await deleteWeekOverride(db, slotId, 99)
      expect(result.success).toBe(true)
    })

    it('only deletes the targeted week, not others', async () => {
      await upsertWeekOverride(db, slotId, 1, { weight: 60 })
      await upsertWeekOverride(db, slotId, 2, { weight: 62.5 })
      await upsertWeekOverride(db, slotId, 3, { weight: 65 })

      await deleteWeekOverride(db, slotId, 2)

      const remaining = db.select().from(schema.slot_week_overrides).all()
      expect(remaining).toHaveLength(2)
      expect(remaining.map((r) => r.week_number).sort()).toEqual([1, 3])
    })
  })

  describe('getWeekOverrides', () => {
    it('returns all overrides for a slot', async () => {
      await upsertWeekOverride(db, slotId, 1, { weight: 60 })
      await upsertWeekOverride(db, slotId, 2, { weight: 62.5 })
      await upsertWeekOverride(db, slotId, 3, { weight: 65 })

      const result = await getWeekOverrides(db, slotId)
      expect(result).toHaveLength(3)
      expect(result.map((r) => r.week_number)).toEqual([1, 2, 3])
    })

    it('returns empty array when no overrides exist', async () => {
      const result = await getWeekOverrides(db, slotId)
      expect(result).toEqual([])
    })

    it('returns only overrides for the specified slot', async () => {
      // Create second slot
      sqlite.exec(`
        INSERT INTO exercises (id, name, modality) VALUES (2, 'Squat', 'resistance');
        INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, "order")
          VALUES (2, 1, 2, 4, '6', 2);
      `)

      await upsertWeekOverride(db, slotId, 1, { weight: 60 })
      await upsertWeekOverride(db, 2, 1, { weight: 100 })

      const result = await getWeekOverrides(db, slotId)
      expect(result).toHaveLength(1)
      expect(result[0].weight).toBe(60)
    })

    it('returns overrides ordered by week_number', async () => {
      await upsertWeekOverride(db, slotId, 3, { weight: 65 })
      await upsertWeekOverride(db, slotId, 1, { weight: 60 })
      await upsertWeekOverride(db, slotId, 2, { weight: 62.5 })

      const result = await getWeekOverrides(db, slotId)
      expect(result.map((r) => r.week_number)).toEqual([1, 2, 3])
    })
  })
})
