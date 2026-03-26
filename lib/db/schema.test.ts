import { describe, it, expect } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import {
  workout_templates,
  template_sections,
  slot_week_overrides,
  template_week_overrides,
} from './schema'

describe('elevation gain schema columns', () => {
  it('workout_templates has target_elevation_gain integer column', () => {
    const cols = getTableColumns(workout_templates)
    expect(cols).toHaveProperty('target_elevation_gain')
    expect(cols.target_elevation_gain.columnType).toBe('SQLiteInteger')
    expect(cols.target_elevation_gain.notNull).toBe(false)
  })

  it('template_sections has target_elevation_gain integer column', () => {
    const cols = getTableColumns(template_sections)
    expect(cols).toHaveProperty('target_elevation_gain')
    expect(cols.target_elevation_gain.columnType).toBe('SQLiteInteger')
    expect(cols.target_elevation_gain.notNull).toBe(false)
  })

  it('slot_week_overrides has elevation_gain integer column', () => {
    const cols = getTableColumns(slot_week_overrides)
    expect(cols).toHaveProperty('elevation_gain')
    expect(cols.elevation_gain.columnType).toBe('SQLiteInteger')
    expect(cols.elevation_gain.notNull).toBe(false)
  })

  it('template_week_overrides has elevation_gain integer column', () => {
    const cols = getTableColumns(template_week_overrides)
    expect(cols).toHaveProperty('elevation_gain')
    expect(cols.elevation_gain.columnType).toBe('SQLiteInteger')
    expect(cols.elevation_gain.notNull).toBe(false)
  })
})
