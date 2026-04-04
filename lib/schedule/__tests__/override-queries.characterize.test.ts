// Characterization test — captures current behavior for safe refactoring

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

// Creates an in-memory DB with the minimal schema needed to exercise the function.
// Assumption: the function only touches weekly_schedule and schedule_week_overrides tables.
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

// Seed helpers
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
  duration = 90
) {
  db.insert(weekly_schedule)
    .values({ mesocycle_id: mesoId, day_of_week: day, template_id: templateId, week_type: weekType, period, time_slot: timeSlot, duration })
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

// ============================================================================

describe('getEffectiveScheduleForDay — characterization', () => {
  let db: AppDb
  let mesoId: number
  let tmplId: number

  beforeEach(() => {
    const setup = createTestDb()
    db = setup.db
    const meso = seedMeso(db)
    mesoId = meso.id
    const tmpl = seedTemplate(db, mesoId)
    tmplId = tmpl.id
  })

  // ─── 1. Empty state ──────────────────────────────────────────────────────────

  it('returns [] when no base schedule and no overrides exist', async () => {
    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toEqual([])
  })

  it('returns [] when there are base entries for a different day', async () => {
    seedBaseEntry(db, mesoId, tmplId, 2 /* day 2 */, 'normal', '07:00')
    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1 /* day 1 */, 'normal')
    expect(result).toEqual([])
  })

  it('returns [] when there are base entries for a different week_type', async () => {
    seedBaseEntry(db, mesoId, tmplId, 1, 'deload', '07:00')
    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toEqual([])
  })

  it('returns [] when there are base entries for a different mesocycle', async () => {
    // second meso
    db.insert(mesocycles)
      .values({ name: 'Other Meso', start_date: '2026-04-01', end_date: '2026-06-01', work_weeks: 8 })
      .run()
    const mesoRows = db.select().from(mesocycles).all() as typeof mesocycles.$inferSelect[]
    const otherMesoId = mesoRows[1].id
    seedBaseEntry(db, otherMesoId, tmplId, 1, 'normal', '07:00')
    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toEqual([])
  })

  // ─── 2. Base only (no overrides) ─────────────────────────────────────────────

  it('returns base entry as-is when no override exists', async () => {
    const base = seedBaseEntry(db, mesoId, tmplId, 1, 'normal', '07:00', 'morning', 90)
    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      schedule_entry_id: base.id,
      template_id: tmplId,
      period: 'morning',
      time_slot: '07:00',
      duration: 90,
      is_override: false,
      override_group: null,
    })
  })

  it('returns null template_id when base entry is a rest-day slot (template_id = null)', async () => {
    const base = seedBaseEntry(db, mesoId, null, 1, 'normal', '07:00', 'morning', 90)
    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].template_id).toBeNull()
    expect(result[0].is_override).toBe(false)
    expect(result[0].schedule_entry_id).toBe(base.id)
  })

  it('returns multiple base entries sorted by time_slot ascending', async () => {
    const tmpl2 = seedTemplate(db, mesoId, 'Pull Day')
    seedBaseEntry(db, mesoId, tmplId,  1, 'normal', '17:00', 'afternoon', 60)
    seedBaseEntry(db, mesoId, tmpl2.id, 1, 'normal', '07:00', 'morning',  90)
    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(2)
    expect(result[0].time_slot).toBe('07:00')
    expect(result[1].time_slot).toBe('17:00')
  })

  // ─── 3. Override replaces matching base entry ─────────────────────────────────

  it('applies override when time_slot matches base, replacing template_id/period/duration', async () => {
    const base = seedBaseEntry(db, mesoId, tmplId, 1, 'normal', '07:00', 'morning', 90)
    const tmpl2 = seedTemplate(db, mesoId, 'Yoga')
    seedOverride(db, mesoId, tmpl2.id, 1, 1, '07:00', 'evening', 45, 'grp-A')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      schedule_entry_id: base.id,   // preserves the base entry id
      template_id: tmpl2.id,        // taken from override
      period: 'evening',            // taken from override
      time_slot: '07:00',           // same key used for matching
      duration: 45,                 // taken from override
      is_override: true,
      override_group: 'grp-A',
    })
  })

  it('override with null template_id yields is_override=true, template_id=null (rest removal)', async () => {
    seedBaseEntry(db, mesoId, tmplId, 1, 'normal', '07:00', 'morning', 90)
    seedOverride(db, mesoId, null, 1, 1, '07:00', 'morning', 90, 'grp-rest')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].template_id).toBeNull()
    expect(result[0].is_override).toBe(true)
    expect(result[0].override_group).toBe('grp-rest')
  })

  it('override matching uses time_slot not period — period mismatch still applies override', async () => {
    // Base has period=morning, override has period=afternoon but same time_slot
    const base = seedBaseEntry(db, mesoId, tmplId, 1, 'normal', '07:00', 'morning', 90)
    const tmpl2 = seedTemplate(db, mesoId, 'Run')
    seedOverride(db, mesoId, tmpl2.id, 1, 1, '07:00', 'afternoon', 30, 'grp-B')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].schedule_entry_id).toBe(base.id)
    expect(result[0].period).toBe('afternoon')  // override period wins
    expect(result[0].is_override).toBe(true)
  })

  // ─── 4. Override only (no matching base) — additive entry ─────────────────────

  it('adds override-only entry with schedule_entry_id=null when no base matches the time_slot', async () => {
    const tmpl2 = seedTemplate(db, mesoId, 'Extra Session')
    seedOverride(db, mesoId, tmpl2.id, 1, 1, '12:00', 'afternoon', 45, 'grp-add')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      schedule_entry_id: null,
      template_id: tmpl2.id,
      period: 'afternoon',
      time_slot: '12:00',
      duration: 45,
      is_override: true,
      override_group: 'grp-add',
    })
  })

  // ─── 5. Mixed: base + override replacement + additive override ─────────────────

  it('handles mix of base, replaced base, and additive override, sorted by time_slot', async () => {
    const tmpl2 = seedTemplate(db, mesoId, 'Evening Run')
    const tmpl3 = seedTemplate(db, mesoId, 'Yoga')

    // base entries
    const base07 = seedBaseEntry(db, mesoId, tmplId,  1, 'normal', '07:00', 'morning',   90)
    const base17 = seedBaseEntry(db, mesoId, tmpl2.id, 1, 'normal', '17:00', 'afternoon', 60)

    // override replaces 07:00
    seedOverride(db, mesoId, tmpl3.id, 1, 1, '07:00', 'morning', 45, 'grp-swap')
    // additive override at 12:00
    seedOverride(db, mesoId, tmpl2.id, 1, 1, '12:00', 'afternoon', 30, 'grp-add')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(3)
    // sorted by time_slot
    expect(result[0].time_slot).toBe('07:00')
    expect(result[1].time_slot).toBe('12:00')
    expect(result[2].time_slot).toBe('17:00')

    // 07:00 was replaced
    expect(result[0].is_override).toBe(true)
    expect(result[0].schedule_entry_id).toBe(base07.id)
    expect(result[0].template_id).toBe(tmpl3.id)

    // 12:00 is additive
    expect(result[1].is_override).toBe(true)
    expect(result[1].schedule_entry_id).toBeNull()

    // 17:00 is unchanged base
    expect(result[2].is_override).toBe(false)
    expect(result[2].schedule_entry_id).toBe(base17.id)
    expect(result[2].template_id).toBe(tmpl2.id)
  })

  // ─── 6. Override scoping — week_number must match ────────────────────────────

  it('does not apply override from a different week_number', async () => {
    const base = seedBaseEntry(db, mesoId, tmplId, 1, 'normal', '07:00', 'morning', 90)
    const tmpl2 = seedTemplate(db, mesoId, 'Other')
    // override is for week 2, but we query week 1
    seedOverride(db, mesoId, tmpl2.id, 2, 1, '07:00', 'morning', 45, 'grp-wk')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1 /* week 1 */, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].is_override).toBe(false)
    expect(result[0].schedule_entry_id).toBe(base.id)
  })

  it('does not apply override from a different day_of_week', async () => {
    const base = seedBaseEntry(db, mesoId, tmplId, 1, 'normal', '07:00', 'morning', 90)
    const tmpl2 = seedTemplate(db, mesoId, 'Other')
    seedOverride(db, mesoId, tmpl2.id, 1, 3 /* day 3 */, '07:00', 'morning', 45, 'grp-day')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1 /* day 1 */, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].is_override).toBe(false)
  })

  // ─── 7. week_type filter — override query does NOT filter by week_type ────────
  // NOTE: possible bug — overrides are fetched without a week_type filter.
  // A deload-week override will still apply when querying for a normal week
  // if the week_number, day_of_week, and time_slot match.

  it('override is applied regardless of which week_type was passed to the function (overrides have no week_type column)', async () => {
    const base = seedBaseEntry(db, mesoId, tmplId, 1, 'normal', '07:00', 'morning', 90)
    const tmpl2 = seedTemplate(db, mesoId, 'Deload Run')
    // An override exists for week 1 day 1 — it has no week_type awareness
    seedOverride(db, mesoId, tmpl2.id, 1, 1, '07:00', 'morning', 30, 'grp-no-type')

    // querying with week_type='normal' still gets this override because the override
    // table has no week_type column — overrides are keyed only on (meso, week_num, day)
    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].is_override).toBe(true)
    expect(result[0].template_id).toBe(tmpl2.id)
  })

  // ─── 8. Deload base entries ───────────────────────────────────────────────────

  it('returns deload base entries when week_type=deload is requested', async () => {
    seedBaseEntry(db, mesoId, tmplId, 1, 'normal', '07:00', 'morning', 90)
    const base = seedBaseEntry(db, mesoId, tmplId, 1, 'deload', '07:00', 'morning', 45)

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'deload')
    expect(result).toHaveLength(1)
    expect(result[0].schedule_entry_id).toBe(base.id)
    expect(result[0].duration).toBe(45)
  })

  // ─── 9. Multiple overrides for same time_slot — last-write-wins via Map ───────
  // NOTE: possible bug — if two override rows share the same time_slot for
  // the same (meso, week, day), the Map will silently keep the last one inserted.
  // The DB unique index only covers (meso, week, day, time_slot, template_id),
  // so two rows with different template_ids CAN exist for the same time_slot.

  it('when two overrides share the same time_slot, last one inserted wins (Map overwrites)', async () => {
    seedBaseEntry(db, mesoId, tmplId, 1, 'normal', '07:00', 'morning', 90)
    const tmpl2 = seedTemplate(db, mesoId, 'Alt A')
    const tmpl3 = seedTemplate(db, mesoId, 'Alt B')
    seedOverride(db, mesoId, tmpl2.id, 1, 1, '07:00', 'morning', 40, 'grp-first')
    seedOverride(db, mesoId, tmpl3.id, 1, 1, '07:00', 'morning', 50, 'grp-second')

    const result = await getEffectiveScheduleForDay(db, mesoId, 1, 1, 'normal')
    expect(result).toHaveLength(1)
    // Last override in iteration order wins
    expect(result[0].is_override).toBe(true)
    expect(result[0].template_id).toBe(tmpl3.id) // NOTE: possible bug — nondeterministic if DB returns rows in different order
    expect(result[0].duration).toBe(50)
  })
})
