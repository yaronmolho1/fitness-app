// @vitest-environment jsdom
import { render, screen, within, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { WorkoutLoggingForm } from './workout-logging-form'
import type { WorkoutData } from './workout-logging-form'

function makeWorkoutData(overrides: Partial<WorkoutData> = {}): WorkoutData {
  return {
    date: '2026-03-15',
    mesocycle: {
      id: 1,
      name: 'Block A',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
      week_type: 'normal',
    },
    template: {
      id: 1,
      name: 'Push Day A',
      modality: 'resistance',
      notes: null,
    },
    slots: [],
    ...overrides,
  }
}

function makeSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    exercise_id: 10,
    exercise_name: 'Bench Press',
    sets: 3,
    reps: '8',
    weight: 80,
    rpe: 8,
    rest_seconds: 180,
    guidelines: null,
    order: 1,
    is_main: true,
    ...overrides,
  }
}

// AC12-15: Touch target enforcement (44px minimum)
describe('touch target enforcement', () => {
  afterEach(() => {
    cleanup()
  })

  // AC13: Delete set button — 44px tappable area
  describe('delete set button', () => {
    it('has min-h and min-w of 44px for tappable area', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const removeButtons = screen.getAllByRole('button', { name: /remove/i })
      for (const btn of removeButtons) {
        expect(btn.className).toMatch(/min-h-\[44px\]/)
        expect(btn.className).toMatch(/min-w-\[44px\]/)
      }
    })
  })

  // AC14: Add Set button — min height 44px
  describe('add set button', () => {
    it('has min-h of 44px', () => {
      const data = makeWorkoutData({
        slots: [makeSlot()],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const addBtn = within(section).getByRole('button', { name: /add set/i })
      expect(addBtn.className).toMatch(/min-h-\[44px\]/)
    })
  })

  // AC15: Rating stars — 44px tappable area
  describe('rating stars', () => {
    it('each star has min-h and min-w of 44px', () => {
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 1; i <= 5; i++) {
        const btn = screen.getByRole('button', { name: `Rate ${i}` })
        expect(btn.className).toMatch(/min-h-\[44px\]/)
        expect(btn.className).toMatch(/min-w-\[44px\]/)
      }
    })
  })
})
