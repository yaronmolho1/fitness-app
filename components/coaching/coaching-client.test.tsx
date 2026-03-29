// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { CoachingClient } from './coaching-client'

// Mock child components to isolate orchestrator logic
vi.mock('./profile-form', () => ({
  ProfileForm: ({ profile }: { profile: unknown }) => (
    <div data-testid="profile-form" data-profile={JSON.stringify(profile)}>
      ProfileForm
    </div>
  ),
}))

vi.mock('./subjective-state-form', () => ({
  SubjectiveStateForm: ({
    value,
    onChange,
  }: {
    value: Record<string, unknown>
    onChange: (s: Record<string, unknown>) => void
  }) => (
    <div data-testid="subjective-state-form">
      <span data-testid="state-value">{JSON.stringify(value)}</span>
      <button
        data-testid="set-fatigue"
        onClick={() => onChange({ ...value, fatigue: 4 })}
      >
        Set Fatigue
      </button>
    </div>
  ),
}))

vi.mock('./summary-preview', () => ({
  SummaryPreview: ({
    subjectiveState,
  }: {
    subjectiveState: Record<string, unknown>
  }) => (
    <div data-testid="summary-preview">
      <span data-testid="preview-state">{JSON.stringify(subjectiveState)}</span>
    </div>
  ),
}))

afterEach(cleanup)

const mockProfile = {
  id: 1,
  age: 30,
  weight_kg: 85,
  height_cm: 180,
  gender: 'male',
  training_age_years: 5,
  primary_goal: 'Hypertrophy',
  injury_history: null,
  timezone: 'UTC',
  created_at: null,
  updated_at: null,
}

describe('CoachingClient', () => {
  describe('rendering', () => {
    it('renders profile form with profile data', () => {
      render(<CoachingClient profile={mockProfile} />)
      const form = screen.getByTestId('profile-form')
      expect(form).toBeInTheDocument()
      expect(form.dataset.profile).toBe(JSON.stringify(mockProfile))
    })

    it('renders profile form with null profile', () => {
      render(<CoachingClient profile={null} />)
      const form = screen.getByTestId('profile-form')
      expect(form.dataset.profile).toBe('null')
    })

    it('renders subjective state form', () => {
      render(<CoachingClient profile={mockProfile} />)
      expect(screen.getByTestId('subjective-state-form')).toBeInTheDocument()
    })

    it('renders summary preview', () => {
      render(<CoachingClient profile={mockProfile} />)
      expect(screen.getByTestId('summary-preview')).toBeInTheDocument()
    })

    it('renders all three sections with headings', () => {
      render(<CoachingClient profile={mockProfile} />)
      expect(screen.getByText('Athlete Profile')).toBeInTheDocument()
    })
  })

  describe('state flow', () => {
    it('initializes subjective state with defaults', () => {
      render(<CoachingClient profile={mockProfile} />)
      const stateValue = JSON.parse(
        screen.getByTestId('state-value').textContent ?? '{}'
      )
      expect(stateValue).toEqual({
        fatigue: null,
        soreness: null,
        sleepQuality: null,
        currentInjuries: '',
        notes: '',
      })
    })

    it('passes updated subjective state to summary preview', async () => {
      const user = userEvent.setup()
      render(<CoachingClient profile={mockProfile} />)

      await user.click(screen.getByTestId('set-fatigue'))

      await waitFor(() => {
        const previewState = JSON.parse(
          screen.getByTestId('preview-state').textContent ?? '{}'
        )
        expect(previewState.fatigue).toBe(4)
      })
    })

    it('subjective state form and summary preview share same state', async () => {
      const user = userEvent.setup()
      render(<CoachingClient profile={mockProfile} />)

      await user.click(screen.getByTestId('set-fatigue'))

      await waitFor(() => {
        const formState = JSON.parse(
          screen.getByTestId('state-value').textContent ?? '{}'
        )
        const previewState = JSON.parse(
          screen.getByTestId('preview-state').textContent ?? '{}'
        )
        expect(formState.fatigue).toBe(previewState.fatigue)
      })
    })
  })
})
