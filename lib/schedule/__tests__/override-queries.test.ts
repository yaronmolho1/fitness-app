import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import {
  mesocycles,
  workout_templates,
  weekly_schedule,
  schedule_week_overrides,
} from '@/lib/db/schema'
import { getEffectiveScheduleForDay } from '../override-queries'
import type { AppDb } from '@/lib/db'

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
      estimated_duration INTEGER,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER

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
    );
  `)
  const db = drizzle(sqlite, {
    schema: {
      mesocycles,
      workout_templates,
      weekly_schedule,
      schedule_week_overrides,
    },
  }) as unknown as AppDb
  return { db, sqlite }
}

function seedMeso(db: AppDb) {
  db.insert(mesocycles)
    .values({ name: 'Test Meso', start_date: '2026-01-01', end_date: '2026-03-01', work_weeks: 8 })
    .run()
  return (db.select().from(mesocycles).all() as typeof mesocycles.$inferSelect[])[0]
}

function seedTemplate(db: AppDb, mesoId: number, name = 'Push Day') {
  db.insert(workout_templates)
    .values({ mesocycle_id: mesoId, name, canonical_name: name.toLowerCase().replace(/ /g, '-'), modality: 'resistance' })
    .run()
  const rows = db.select().from(workout_templates).all() as typeof workout_templates.$inferSelect[]
  return rows[rows.length - 1]
}

function seedBaseEntry(
  db: AppDb,
  mesoId: number,
  templateId: number | null,
  day: number,
  weekType: 'normal' | 'deload',
  timeSlot: string,
  period: 'morning' | 'afternoon' | 'evening' = 'morning',
  duration = 90,
  cycleLength = 1,
  cyclePosition = 1
) {
  db.insert(weekly_schedule)
    .values({
      mesocycle_id: mesoId,
      day_of_week: day,
      template_id: templateId,
      week_type: weekType,
      period,
      time_slot: timeSlot,
      duration,
      cycle_length: cycleLength,
      cycle_position: cyclePosition,
    })
    .run()
  const rows = db.select().from(weekly_schedule).all() as typeof weekly_schedule.$inferSelect[]
  return rows[rows.length - 1]
}

function seedOverride(
  db: AppDb,
  mesoId: number,
  templateId: number | null,
  weekNumber: number,
  day: number,
  timeSlot: string,
  period: 'morning' | 'afternoon' | 'evening' = 'morning',
  duration = 60,
  overrideGroup = 'grp-001'
) {
  db.insert(schedule_week_overrides)
    .values({ mesocycle_id: mesoId, week_number: weekNumber, day_of_week: day, period, template_id: templateId, time_slot: timeSlot, duration, override_group: overrideGroup })
    .run()
}

describe('getEffectiveScheduleForDay — cycle-aware resolution (T212)', () => {
  let db: AppDb
  let mesoId: number

  beforeEach(() => {
    const setup = createTestDb()
    db = setup.db
    const meso = seedMeso(db)
    mesoId = meso.id
  })

  // ─── AC11: cycle_length=1 backward compatible ─────────────────────────────

  it('returns single-template entry for any week when cycle_length=1 (backward compatible)', async () => {
    const tmpl = seedTemplate(db, mesoId, 'VO2 Max')
    seedBaseEntry(db, mesoId, tmpl.id, 1, 'normal', '07:00', 'morning', 90, 1, 1)

    const week1 = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    const week5 = await getEffectiveScheduleForDay(db, mesoId, 5, 1, 'normal')

    expect(week1).toHaveLength(1)
    expect(week1[0].template_id).toBe(tmpl.id)
    expect(week1[0].cycle_length).toBe(1)
    expect(week1[0].cycle_position).toBe(1)

    expect(week5).toHaveLength(1)
    expect(week5[0].template_id).toBe(tmpl.id)
  })

  // ─── AC8: Week 1 of 4-week rotation resolves position 1 ──────────────────

  it('resolves position 1 for week 1 of a 4-week rotation', async () => {
    const vo2 = seedTemplate(db, mesoId, 'VO2 Max')
    const threshold = seedTemplate(db, mesoId, 'Threshold')
    const tempo = seedTemplate(db, mesoId, 'Tempo')
    const longRun = seedTemplate(db, mesoId, 'Long Run')

    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 4, 1)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 4, 2)
    seedBaseEntry(db, mesoId, tempo.id, 1, 'normal', '07:00', 'morning', 90, 4, 3)
    seedBaseEntry(db, mesoId, longRun.id, 1, 'normal', '07:00', 'morning', 90, 4, 4)

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].template_id).toBe(vo2.id)
    expect(result[0].cycle_length).toBe(4)
    expect(result[0].cycle_position).toBe(1)
  })

  // ─── AC10: Week 3 resolves position 3 ─────────────────────────────────────

  it('resolves position 3 for week 3 of a 4-week rotation', async () => {
    const vo2 = seedTemplate(db, mesoId, 'VO2 Max')
    const threshold = seedTemplate(db, mesoId, 'Threshold')
    const tempo = seedTemplate(db, mesoId, 'Tempo')
    const longRun = seedTemplate(db, mesoId, 'Long Run')

    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 4, 1)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 4, 2)
    seedBaseEntry(db, mesoId, tempo.id, 1, 'normal', '07:00', 'morning', 90, 4, 3)
    seedBaseEntry(db, mesoId, longRun.id, 1, 'normal', '07:00', 'morning', 90, 4, 4)

    const result = await getEffectiveScheduleForDay(db, mesoId, 3, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].template_id).toBe(tempo.id)
    expect(result[0].cycle_position).toBe(3)
  })

  // ─── AC9: Week 5 wraps — ((5-1) % 4) + 1 = 1 ────────────────────────────

  it('cycle repeats: week 5 resolves to position 1 for a 4-week rotation', async () => {
    const vo2 = seedTemplate(db, mesoId, 'VO2 Max')
    const threshold = seedTemplate(db, mesoId, 'Threshold')
    const tempo = seedTemplate(db, mesoId, 'Tempo')
    const longRun = seedTemplate(db, mesoId, 'Long Run')

    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 4, 1)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 4, 2)
    seedBaseEntry(db, mesoId, tempo.id, 1, 'normal', '07:00', 'morning', 90, 4, 3)
    seedBaseEntry(db, mesoId, longRun.id, 1, 'normal', '07:00', 'morning', 90, 4, 4)

    const result = await getEffectiveScheduleForDay(db, mesoId, 5, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].template_id).toBe(vo2.id)
    expect(result[0].cycle_position).toBe(1)
  })

  // ─── 2-week rotation: week 2 resolves position 2, week 4 wraps to 2 ──────

  it('handles 2-week rotation correctly', async () => {
    const a = seedTemplate(db, mesoId, 'Session A')
    const b = seedTemplate(db, mesoId, 'Session B')

    seedBaseEntry(db, mesoId, a.id, 1, 'normal', '07:00', 'morning', 90, 2, 1)
    seedBaseEntry(db, mesoId, b.id, 1, 'normal', '07:00', 'morning', 90, 2, 2)

    const week1 = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(week1[0].template_id).toBe(a.id)

    const week2 = await getEffectiveScheduleForDay(db, mesoId, 2, 1, 'normal')
    expect(week2[0].template_id).toBe(b.id)

    const week4 = await getEffectiveScheduleForDay(db, mesoId, 4, 1, 'normal')
    expect(week4[0].template_id).toBe(b.id) // ((4-1) % 2) + 1 = 2
  })

  // ─── Multiple time slots with independent rotations ───────────────────────

  it('resolves independent rotations on different time_slots for same day', async () => {
    const vo2 = seedTemplate(db, mesoId, 'VO2 Max')
    const threshold = seedTemplate(db, mesoId, 'Threshold')
    const yoga = seedTemplate(db, mesoId, 'Yoga')
    const stretch = seedTemplate(db, mesoId, 'Stretch')

    // 07:00 slot: 2-week rotation
    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 2, 1)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 2, 2)

    // 17:00 slot: 2-week rotation
    seedBaseEntry(db, mesoId, yoga.id, 1, 'normal', '17:00', 'afternoon', 60, 2, 1)
    seedBaseEntry(db, mesoId, stretch.id, 1, 'normal', '17:00', 'afternoon', 60, 2, 2)

    // Week 1: position 1 for both
    const week1 = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(week1).toHaveLength(2)
    expect(week1[0].template_id).toBe(vo2.id)
    expect(week1[1].template_id).toBe(yoga.id)

    // Week 2: position 2 for both
    const week2 = await getEffectiveScheduleForDay(db, mesoId, 2, 1, 'normal')
    expect(week2).toHaveLength(2)
    expect(week2[0].template_id).toBe(threshold.id)
    expect(week2[1].template_id).toBe(stretch.id)
  })

  // ─── Mixed: rotation slot + non-rotation slot on same day ─────────────────

  it('handles mix of rotation and non-rotation slots', async () => {
    const vo2 = seedTemplate(db, mesoId, 'VO2 Max')
    const threshold = seedTemplate(db, mesoId, 'Threshold')
    const yoga = seedTemplate(db, mesoId, 'Yoga')

    // 07:00: 2-week rotation
    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 2, 1)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 2, 2)

    // 17:00: single assignment (cycle_length=1)
    seedBaseEntry(db, mesoId, yoga.id, 1, 'normal', '17:00', 'afternoon', 60, 1, 1)

    const week2 = await getEffectiveScheduleForDay(db, mesoId, 2, 1, 'normal')
    expect(week2).toHaveLength(2)
    expect(week2[0].template_id).toBe(threshold.id) // rotation resolved to pos 2
    expect(week2[1].template_id).toBe(yoga.id) // always the same
  })

  // ─── AC12: Override wins over rotation-resolved template ──────────────────

  it('override replaces rotation-resolved template', async () => {
    const vo2 = seedTemplate(db, mesoId, 'VO2 Max')
    const threshold = seedTemplate(db, mesoId, 'Threshold')
    const longRun = seedTemplate(db, mesoId, 'Long Run')

    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 2, 1)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 2, 2)

    // Override week 1 (which would normally resolve to VO2 Max) to Long Run
    seedOverride(db, mesoId, longRun.id, 1, 1, '07:00', 'morning', 60, 'grp-swap')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].template_id).toBe(longRun.id)
    expect(result[0].is_override).toBe(true)
    expect(result[0].override_group).toBe('grp-swap')
  })

  // ─── AC13: Override with null template_id = rest ──────────────────────────

  it('override with null template_id makes rotation slot rest for that week', async () => {
    const vo2 = seedTemplate(db, mesoId, 'VO2 Max')
    const threshold = seedTemplate(db, mesoId, 'Threshold')

    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 2, 1)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 2, 2)

    seedOverride(db, mesoId, null, 1, 1, '07:00', 'morning', 90, 'grp-rest')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].template_id).toBeNull()
    expect(result[0].is_override).toBe(true)
  })

  // ─── AC15: Deload uses its own rows, not rotation ─────────────────────────

  it('deload week uses deload schedule rows, not normal rotation', async () => {
    const vo2 = seedTemplate(db, mesoId, 'VO2 Max')
    const threshold = seedTemplate(db, mesoId, 'Threshold')
    const deloadRun = seedTemplate(db, mesoId, 'Deload Run')

    // Normal week rotation
    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 2, 1)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 2, 2)

    // Deload: single assignment
    seedBaseEntry(db, mesoId, deloadRun.id, 1, 'deload', '07:00', 'morning', 45, 1, 1)

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'deload')
    expect(result).toHaveLength(1)
    expect(result[0].template_id).toBe(deloadRun.id)
    expect(result[0].cycle_length).toBe(1)
  })

  // ─── Return type includes cycle_length and cycle_position ─────────────────

  it('includes cycle_length and cycle_position in returned entries', async () => {
    const vo2 = seedTemplate(db, mesoId, 'VO2 Max')
    const threshold = seedTemplate(db, mesoId, 'Threshold')

    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 4, 1)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 4, 2)
    // Add positions 3 and 4 as well
    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 4, 3)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 4, 4)

    const result = await getEffectiveScheduleForDay(db, mesoId, 2, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].cycle_length).toBe(4)
    expect(result[0].cycle_position).toBe(2)
  })

  // ─── Override-only entry (no base) still works with rotation ──────────────

  it('additive override (no base) works independently of rotation logic', async () => {
    const vo2 = seedTemplate(db, mesoId, 'VO2 Max')
    const threshold = seedTemplate(db, mesoId, 'Threshold')
    const extra = seedTemplate(db, mesoId, 'Extra Session')

    seedBaseEntry(db, mesoId, vo2.id, 1, 'normal', '07:00', 'morning', 90, 2, 1)
    seedBaseEntry(db, mesoId, threshold.id, 1, 'normal', '07:00', 'morning', 90, 2, 2)

    // Additive override at different time_slot
    seedOverride(db, mesoId, extra.id, 1, 1, '12:00', 'afternoon', 45, 'grp-add')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(2)
    expect(result[0].time_slot).toBe('07:00')
    expect(result[0].template_id).toBe(vo2.id)
    expect(result[1].time_slot).toBe('12:00')
    expect(result[1].is_override).toBe(true)
  })
})
