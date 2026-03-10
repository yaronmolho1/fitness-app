import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('SQLite Connection & PRAGMAs', () => {
  let db: Database.Database
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sqlite-test-'))
    const dbPath = join(tempDir, 'test.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('busy_timeout = 5000')
    db.pragma('synchronous = NORMAL')
    db.pragma('foreign_keys = ON')
  })

  afterAll(() => {
    db?.close()
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('WAL mode is active', () => {
    const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>
    expect(result[0].journal_mode).toBe('wal')
  })

  it('foreign keys enforcement is active', () => {
    const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>
    expect(result[0].foreign_keys).toBe(1)
  })

  it('synchronous is NORMAL (1)', () => {
    const result = db.pragma('synchronous') as Array<{ synchronous: number }>
    expect(result[0].synchronous).toBe(1)
  })

  it('busy timeout is 5000', () => {
    const result = db.pragma('busy_timeout') as Array<{ timeout: number }>
    expect(result[0].timeout).toBe(5000)
  })
})
