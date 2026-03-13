import { describe, it, expect } from 'vitest'
import { filterExercises } from './filters'
import type { Exercise } from './filters'

const exercises: Exercise[] = [
  { id: 1, name: 'Bench Press', modality: 'resistance', muscle_group: 'chest', equipment: 'barbell', created_at: null },
  { id: 2, name: 'Squat', modality: 'resistance', muscle_group: 'legs', equipment: 'barbell', created_at: null },
  { id: 3, name: '5K Tempo Run', modality: 'running', muscle_group: null, equipment: null, created_at: null },
  { id: 4, name: 'Heavy Bag Rounds', modality: 'mma', muscle_group: null, equipment: 'heavy bag', created_at: null },
  { id: 5, name: 'Overhead Press', modality: 'resistance', muscle_group: 'shoulders', equipment: 'barbell', created_at: null },
]

describe('filterExercises', () => {
  describe('name search', () => {
    it('returns all when search is empty', () => {
      expect(filterExercises(exercises, '', 'all')).toEqual(exercises)
    })

    it('case-insensitive partial match', () => {
      const result = filterExercises(exercises, 'press', 'all')
      expect(result).toHaveLength(2)
      expect(result.map(e => e.name)).toEqual(['Bench Press', 'Overhead Press'])
    })

    it('returns empty for no match', () => {
      expect(filterExercises(exercises, 'deadlift', 'all')).toEqual([])
    })

    it('matches uppercase search against lowercase name', () => {
      const result = filterExercises(exercises, 'SQUAT', 'all')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Squat')
    })
  })

  describe('modality filter', () => {
    it('"all" returns everything', () => {
      expect(filterExercises(exercises, '', 'all')).toEqual(exercises)
    })

    it('filters by resistance', () => {
      const result = filterExercises(exercises, '', 'resistance')
      expect(result).toHaveLength(3)
      expect(result.every(e => e.modality === 'resistance')).toBe(true)
    })

    it('filters by running', () => {
      const result = filterExercises(exercises, '', 'running')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('5K Tempo Run')
    })

    it('filters by mma', () => {
      const result = filterExercises(exercises, '', 'mma')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Heavy Bag Rounds')
    })
  })

  describe('combined search + filter', () => {
    it('applies both constraints', () => {
      const result = filterExercises(exercises, 'press', 'resistance')
      expect(result).toHaveLength(2)
      expect(result.map(e => e.name)).toEqual(['Bench Press', 'Overhead Press'])
    })

    it('returns empty when combined yields no results', () => {
      const result = filterExercises(exercises, 'press', 'running')
      expect(result).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('whitespace-only search = no filter', () => {
      expect(filterExercises(exercises, '   ', 'all')).toEqual(exercises)
    })

    it('special regex chars treated as literal', () => {
      expect(() => filterExercises(exercises, '(press[', 'all')).not.toThrow()
      expect(filterExercises(exercises, '(press[', 'all')).toEqual([])
    })

    it('empty exercise list returns empty', () => {
      expect(filterExercises([], 'press', 'all')).toEqual([])
    })
  })
})
