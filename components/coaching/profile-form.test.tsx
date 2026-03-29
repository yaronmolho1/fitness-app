// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'

// Radix primitives need these in jsdom
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/lib/coaching/actions', () => ({
  saveAthleteProfile: vi.fn().mockResolvedValue({ success: true, data: {} }),
}))

// Stub useTransition to run async callback synchronously
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useTransition: () => [false, (fn: () => void | Promise<void>) => { const r = fn(); if (r instanceof Promise) r.catch(() => {}) }],
  }
})

import { ProfileForm } from './profile-form'
import { saveAthleteProfile } from '@/lib/coaching/actions'
import { toast } from 'sonner'

const fullProfile = {
  id: 1,
  age: 30,
  weight_kg: 85.5,
  height_cm: 180,
  gender: 'male',
  training_age_years: 5,
  primary_goal: 'Hypertrophy',
  injury_history: 'Left shoulder impingement',
  timezone: 'UTC', created_at: new Date(),
  updated_at: new Date(),
}

describe('ProfileForm', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('field rendering', () => {
    it('renders all profile fields', () => {
      render(<ProfileForm profile={null} />)

      expect(screen.getByLabelText('Age')).toBeInTheDocument()
      expect(screen.getByLabelText('Weight (kg)')).toBeInTheDocument()
      expect(screen.getByLabelText('Height (cm)')).toBeInTheDocument()
      expect(screen.getByText('Gender')).toBeInTheDocument()
      expect(screen.getByLabelText('Training Age (years)')).toBeInTheDocument()
      expect(screen.getByLabelText('Primary Goal')).toBeInTheDocument()
      expect(screen.getByLabelText('Injury History')).toBeInTheDocument()
    })

    it('renders numeric inputs for age, weight, height, training age', () => {
      render(<ProfileForm profile={null} />)

      expect(screen.getByLabelText('Age')).toHaveAttribute('type', 'number')
      expect(screen.getByLabelText('Weight (kg)')).toHaveAttribute('type', 'number')
      expect(screen.getByLabelText('Height (cm)')).toHaveAttribute('type', 'number')
      expect(screen.getByLabelText('Training Age (years)')).toHaveAttribute('type', 'number')
    })

    it('renders injury history as textarea', () => {
      render(<ProfileForm profile={null} />)
      const textarea = screen.getByLabelText('Injury History')
      expect(textarea.tagName).toBe('TEXTAREA')
    })
  })

  describe('pre-fill with existing profile', () => {
    it('populates fields with profile data', () => {
      render(<ProfileForm profile={fullProfile} />)

      // Number inputs store string values internally
      expect(screen.getByLabelText('Age')).toHaveValue(30)
      expect(screen.getByLabelText('Weight (kg)')).toHaveValue(85.5)
      expect(screen.getByLabelText('Height (cm)')).toHaveValue(180)
      expect(screen.getByLabelText('Training Age (years)')).toHaveValue(5)
      expect(screen.getByLabelText('Primary Goal')).toHaveValue('Hypertrophy')
      expect(screen.getByLabelText('Injury History')).toHaveValue('Left shoulder impingement')
    })

    it('shows selected gender value', () => {
      render(<ProfileForm profile={fullProfile} />)
      // Radix Select renders the selected value text
      expect(screen.getByText('Male')).toBeInTheDocument()
    })
  })

  describe('empty/default state', () => {
    it('shows empty fields when no profile', () => {
      render(<ProfileForm profile={null} />)

      const ageInput = screen.getByLabelText('Age') as HTMLInputElement
      expect(ageInput.value).toBe('')

      const weightInput = screen.getByLabelText('Weight (kg)') as HTMLInputElement
      expect(weightInput.value).toBe('')

      expect(screen.getByLabelText('Primary Goal')).toHaveValue('')
      expect(screen.getByLabelText('Injury History')).toHaveValue('')
    })
  })

  describe('auto-save on blur', () => {
    it('calls saveAthleteProfile when a text field is blurred', async () => {
      const user = userEvent.setup()
      render(<ProfileForm profile={null} />)

      const goalInput = screen.getByLabelText('Primary Goal')
      await user.click(goalInput)
      await user.type(goalInput, 'Strength')
      await user.tab()

      await waitFor(() => {
        expect(saveAthleteProfile).toHaveBeenCalledWith(
          expect.objectContaining({ primary_goal: 'Strength' })
        )
      })
    })

    it('calls saveAthleteProfile when a number field is blurred', async () => {
      const user = userEvent.setup()
      render(<ProfileForm profile={null} />)

      const ageInput = screen.getByLabelText('Age')
      await user.click(ageInput)
      await user.type(ageInput, '25')
      await user.tab()

      await waitFor(() => {
        expect(saveAthleteProfile).toHaveBeenCalledWith(
          expect.objectContaining({ age: 25 })
        )
      })
    })

    it('calls saveAthleteProfile when textarea is blurred', async () => {
      const user = userEvent.setup()
      render(<ProfileForm profile={null} />)

      const textarea = screen.getByLabelText('Injury History')
      await user.click(textarea)
      await user.type(textarea, 'Bad knees')
      await user.tab()

      await waitFor(() => {
        expect(saveAthleteProfile).toHaveBeenCalledWith(
          expect.objectContaining({ injury_history: 'Bad knees' })
        )
      })
    })

    it('does not save if value unchanged', async () => {
      const user = userEvent.setup()
      render(<ProfileForm profile={fullProfile} />)

      const goalInput = screen.getByLabelText('Primary Goal')
      await user.click(goalInput)
      await user.tab()

      expect(saveAthleteProfile).not.toHaveBeenCalled()
    })

    it('calls saveAthleteProfile when gender select changes', async () => {
      const user = userEvent.setup()
      render(<ProfileForm profile={null} />)

      const trigger = screen.getByTestId('gender-select')
      await user.click(trigger)
      const option = screen.getByRole('option', { name: 'Female' })
      await user.click(option)

      await waitFor(() => {
        expect(saveAthleteProfile).toHaveBeenCalledWith(
          expect.objectContaining({ gender: 'female' })
        )
      })
    })
  })

  describe('controlled inputs', () => {
    it('updates value on typing', async () => {
      const user = userEvent.setup()
      render(<ProfileForm profile={null} />)

      const goalInput = screen.getByLabelText('Primary Goal')
      await user.type(goalInput, 'Power')

      expect(goalInput).toHaveValue('Power')
    })
  })

  describe('error handling', () => {
    it('reverts field and shows toast on save failure', async () => {
      vi.mocked(saveAthleteProfile).mockResolvedValueOnce({
        success: false,
        error: 'Validation failed',
      })

      const user = userEvent.setup()
      render(<ProfileForm profile={fullProfile} />)

      const goalInput = screen.getByLabelText('Primary Goal')
      await user.clear(goalInput)
      await user.type(goalInput, 'Bad value')
      await user.tab()

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Validation failed')
      })

      // Field reverts to original saved value
      await waitFor(() => {
        expect(goalInput).toHaveValue('Hypertrophy')
      })
    })
  })
})
