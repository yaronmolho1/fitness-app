import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getTableColumns } from 'drizzle-orm'
import * as schema from './schema'
import * as relationsModule from './relations'
import type { AppDb } from '.'

let sqlite: Database.Database
let db: AppDb

// CREATE SQL with rotation cycle columns
const CREATE_SQL = `
  CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, modality TEXT NOT NULL,
    muscle_group TEXT, equipment TEXT, created_at INTEGER
  );
  CREATE TABLE mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
    work_weeks INTEGER NOT NULL, has_deload INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned', created_at INTEGER
  );
  CREATE TABLE workout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, canonical_name TEXT NOT NULL,
    modality TEXT NOT NULL CHECK(modality IN ('resistance', 'running', 'mma', 'mixed')),
    notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, estimated_duration INTEGER, created_at INTEGER
  );
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
  );
  CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_position_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, cycle_position);
`

const SEED_SQL = `
  INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
  VALUES (1, 'Block A', '2026-03-01', '2026-04-01', 4, 'active');

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
  VALUES (1, 1, 'VO2 Max', 'vo2-max', 'running');

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
  VALUES (2, 1, 'Threshold', 'threshold', 'running');
`

describe('T211: rotation cycle columns schema', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
    sqlite.exec(CREATE_SQL)
    sqlite.exec(SEED_SQL)
  })

  afterEach(() => {
    sqlite?.close()
  })

  describe('cycle_length and cycle_position columns exist', () => {
    it('has cycle_length column with correct type and default', () => {
      const cols = sqlite
        .prepare("PRAGMA table_info('weekly_schedule')")
        .all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>
      const col = cols.find((c) => c.name === 'cycle_length')

      expect(col).toBeDefined()
      expect(col!.type).toBe('INTEGER')
      expect(col!.notnull).toBe(1)
      expect(col!.dflt_value).toBe('1')
    })

    it('has cycle_position column with correct type and default', () => {
      const cols = sqlite
        .prepare("PRAGMA table_info('weekly_schedule')")
        .all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>
      const col = cols.find((c) => c.name === 'cycle_position')

      expect(col).toBeDefined()
      expect(col!.type).toBe('INTEGER')
      expect(col!.notnull).toBe(1)
      expect(col!.dflt_value).toBe('1')
    })
  })

  describe('Drizzle schema exports', () => {
    it('weekly_schedule has cycle_length integer column', () => {
      const cols = getTableColumns(schema.weekly_schedule)
      expect(cols).toHaveProperty('cycle_length')
      expect(cols.cycle_length.columnType).toBe('SQLiteInteger')
      expect(cols.cycle_length.notNull).toBe(true)
    })

    it('weekly_schedule has cycle_position integer column', () => {
      const cols = getTableColumns(schema.weekly_schedule)
      expect(cols).toHaveProperty('cycle_position')
      expect(cols.cycle_position.columnType).toBe('SQLiteInteger')
      expect(cols.cycle_position.notNull).toBe(true)
    })
  })

  describe('new unique index', () => {
    it('new index exists on (mesocycle_id, day_of_week, week_type, time_slot, cycle_position)', () => {
      const indexes = sqlite
        .prepare("PRAGMA index_list('weekly_schedule')")
        .all() as Array<{ name: string; unique: number }>

      const newIdx = indexes.find(
        (i) => i.name === 'weekly_schedule_meso_day_type_timeslot_position_idx'
      )
      expect(newIdx).toBeDefined()
      expect(newIdx!.unique).toBe(1)

      // Verify index columns
      const indexInfo = sqlite
        .prepare("PRAGMA index_info('weekly_schedule_meso_day_type_timeslot_position_idx')")
        .all() as Array<{ seqno: number; name: string }>

      const colNames = indexInfo.map((c) => c.name)
      expect(colNames).toEqual([
        'mesocycle_id',
        'day_of_week',
        'week_type',
        'time_slot',
        'cycle_position',
      ])
    })

    it('old index is gone', () => {
      const indexes = sqlite
        .prepare("PRAGMA index_list('weekly_schedule')")
        .all() as Array<{ name: string }>

      const oldIdx = indexes.find(
        (i) => i.name === 'weekly_schedule_meso_day_type_timeslot_template_idx'
      )
      expect(oldIdx).toBeUndefined()
    })
  })

  describe('default values work for new rows', () => {
    it('inserts with defaults cycle_length=1, cycle_position=1', () => {
      const result = db
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: 1,
          day_of_week: 1,
          template_id: 1,
        })
        .returning()
        .get()

      expect(result.cycle_length).toBe(1)
      expect(result.cycle_position).toBe(1)
    })

    it('allows explicit cycle_length and cycle_position', () => {
      const result = db
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: 1,
          day_of_week: 1,
          template_id: 1,
          cycle_length: 4,
          cycle_position: 2,
        })
        .returning()
        .get()

      expect(result.cycle_length).toBe(4)
      expect(result.cycle_position).toBe(2)
    })
  })

  describe('rotation rows — multiple cycle positions on same slot', () => {
    it('allows different cycle_positions on same slot', () => {
      // Insert 4 rotation rows for Monday 07:00
      for (let pos = 1; pos <= 4; pos++) {
        db.insert(schema.weekly_schedule)
          .values({
            mesocycle_id: 1,
            day_of_week: 1,
            template_id: pos <= 2 ? 1 : 2,
            cycle_length: 4,
            cycle_position: pos,
          })
          .run()
      }

      const rows = db.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(4)
    })

    it('rejects duplicate cycle_position on same slot (unique constraint)', () => {
      db.insert(schema.weekly_schedule)
        .values({
          mesocycle_id: 1,
          day_of_week: 1,
          template_id: 1,
          cycle_length: 4,
          cycle_position: 1,
        })
        .run()

      expect(() => {
        db.insert(schema.weekly_schedule)
          .values({
            mesocycle_id: 1,
            day_of_week: 1,
            template_id: 2,
            cycle_length: 4,
            cycle_position: 1, // same position — should fail
          })
          .run()
      }).toThrow()
    })
  })

  describe('backward compatibility', () => {
    it('existing rows without explicit cycle values get defaults', () => {
      // Simulate pre-migration insert (using raw SQL without cycle columns)
      sqlite.exec(`
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id)
        VALUES (1, 3, 1);
      `)

      const rows = db.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].cycle_length).toBe(1)
      expect(rows[0].cycle_position).toBe(1)
    })
  })
})
