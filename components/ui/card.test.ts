import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read source files to verify card styling consistency
function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, '../../', relativePath), 'utf-8')
}

describe('Card normalization (AC4-6)', () => {
  describe('Card component defaults', () => {
    const cardSource = readSource('components/ui/card.tsx')

    it('Card uses rounded-xl (not rounded-lg)', () => {
      // The Card component default className should use rounded-xl
      expect(cardSource).toMatch(/["']rounded-xl\b/)
      expect(cardSource).not.toMatch(/["']rounded-lg\b.*bg-card/)
    })

    it('Card uses shadow-sm', () => {
      expect(cardSource).toMatch(/shadow-sm/)
    })

    it('Card uses theme tokens for bg and text', () => {
      expect(cardSource).toMatch(/bg-card/)
      expect(cardSource).toMatch(/text-card-foreground/)
    })
  })

  describe('Div-based card elements use rounded-xl', () => {
    it('progression-chart card div uses rounded-xl', () => {
      const src = readSource('components/progression-chart.tsx')
      // Find the card-like div with bg-card
      const cardLine = src.split('\n').find(l => l.includes('bg-card') && l.includes('rounded-'))
      expect(cardLine).toBeDefined()
      expect(cardLine).toContain('rounded-xl')
    })

    it('today-workout ExerciseSlot uses rounded-xl', () => {
      const src = readSource('components/today-workout.tsx')
      // ExerciseSlot's card div
      const slotLine = src.split('\n').find(l => l.includes("'rounded-") && l.includes('border p-4 transition-colors'))
      expect(slotLine).toBeDefined()
      expect(slotLine).toContain('rounded-xl')
    })

    it('today-workout logged exercise divs use rounded-xl', () => {
      const src = readSource('components/today-workout.tsx')
      const loggedLine = src.split('\n').find(l => l.includes('rounded-') && l.includes('border bg-card p-4') && !l.includes('rounded-xl'))
      // No lines should have rounded-lg with bg-card p-4 pattern
      expect(loggedLine).toBeUndefined()
    })

    it('routine-check-off card divs use rounded-xl', () => {
      const src = readSource('components/routine-check-off.tsx')
      const cardLines = src.split('\n').filter(l => l.includes('rounded-') && l.includes('border') && l.includes('p-4'))
      expect(cardLines.length).toBeGreaterThan(0)
      cardLines.forEach(line => {
        expect(line).toContain('rounded-xl')
      })
    })

    it('routine-item-list container uses rounded-xl', () => {
      const src = readSource('components/routine-item-list.tsx')
      const listLine = src.split('\n').find(l => l.includes('divide-y') && l.includes('rounded-'))
      expect(listLine).toBeDefined()
      expect(listLine).toContain('rounded-xl')
    })

    it('exercise-list-with-filters container uses rounded-xl', () => {
      const src = readSource('components/exercise-list-with-filters.tsx')
      const listLine = src.split('\n').find(l => l.includes('divide-y') && l.includes('rounded-'))
      expect(listLine).toBeDefined()
      expect(listLine).toContain('rounded-xl')
    })
  })

  describe('No hardcoded colors on cards (AC6)', () => {
    it('Card component uses only theme tokens, no hardcoded bg colors', () => {
      const cardSource = readSource('components/ui/card.tsx')
      // Card base should not use bg-white, bg-gray-*, etc.
      expect(cardSource).not.toMatch(/bg-(white|gray|slate|zinc|neutral|stone)-/)
    })
  })
})
