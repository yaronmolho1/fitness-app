import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getTableName } from 'drizzle-orm'
import { athlete_profile } from './schema'

describe('athlete_profile schema', () => {
  function createTestDb() {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    // Create table from schema definition
    sqlite.exec(`
      CREATE TABLE athlete_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        age INTEGER,
        weight_kg REAL,
        height_cm REAL,
        gender TEXT,
        training_age_years INTEGER,
        primary_goal TEXT,
        injury_history TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `)
    return drizzle(sqlite, { schema: { athlete_profile } })
  }

  it('exports athlete_profile table', () => {
    expect(athlete_profile).toBeDefined()
  })

  it('has correct table name', () => {
    expect(getTableName(athlete_profile)).toBe('athlete_profile')
  })

  it('has auto-increment integer PK', () => {
    const db = createTestDb()
    // Insert with all nulls except auto PK
    db.insert(athlete_profile).values({}).run()
    const rows = db.select().from(athlete_profile).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(1)
  })

  it('all fields except id are nullable', () => {
    const db = createTestDb()
    // Insert empty row — should succeed
    db.insert(athlete_profile).values({}).run()
    const row = db.select().from(athlete_profile).all()[0]
    expect(row.age).toBeNull()
    expect(row.weight_kg).toBeNull()
    expect(row.height_cm).toBeNull()
    expect(row.gender).toBeNull()
    expect(row.training_age_years).toBeNull()
    expect(row.primary_goal).toBeNull()
    expect(row.injury_history).toBeNull()
    expect(row.created_at).toBeNull()
    expect(row.updated_at).toBeNull()
  })

  it('accepts valid data for all columns', () => {
    const db = createTestDb()
    const now = new Date()
    db.insert(athlete_profile)
      .values({
        age: 30,
        weight_kg: 85.5,
        height_cm: 180.0,
        gender: 'male',
        training_age_years: 5,
        primary_goal: 'hypertrophy',
        injury_history: 'left shoulder impingement',
        created_at: now,
        updated_at: now,
      })
      .run()

    const row = db.select().from(athlete_profile).all()[0]
    expect(row.age).toBe(30)
    expect(row.weight_kg).toBe(85.5)
    expect(row.height_cm).toBe(180.0)
    expect(row.gender).toBe('male')
    expect(row.training_age_years).toBe(5)
    expect(row.primary_goal).toBe('hypertrophy')
    expect(row.injury_history).toBe('left shoulder impingement')
    expect(row.created_at).toBeInstanceOf(Date)
    expect(row.updated_at).toBeInstanceOf(Date)
  })

  it('has integer columns for age and training_age_years', () => {
    const db = createTestDb()
    db.insert(athlete_profile).values({ age: 25, training_age_years: 3 }).run()
    const row = db.select().from(athlete_profile).all()[0]
    expect(typeof row.age).toBe('number')
    expect(typeof row.training_age_years).toBe('number')
  })

  it('has real columns for weight_kg and height_cm', () => {
    const db = createTestDb()
    db.insert(athlete_profile)
      .values({ weight_kg: 72.3, height_cm: 175.5 })
      .run()
    const row = db.select().from(athlete_profile).all()[0]
    expect(row.weight_kg).toBe(72.3)
    expect(row.height_cm).toBe(175.5)
  })

  it('has text columns for gender, primary_goal, injury_history', () => {
    const db = createTestDb()
    db.insert(athlete_profile)
      .values({
        gender: 'other',
        primary_goal: 'strength',
        injury_history: 'none',
      })
      .run()
    const row = db.select().from(athlete_profile).all()[0]
    expect(typeof row.gender).toBe('string')
    expect(typeof row.primary_goal).toBe('string')
    expect(typeof row.injury_history).toBe('string')
  })
})
