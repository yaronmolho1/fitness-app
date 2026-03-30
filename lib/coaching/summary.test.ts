import { describe, it, expect } from 'vitest'
import {
  generateCoachingSummary,
  type SummaryInput,
  type SubjectiveState,
} from './summary'
import type { CurrentPlan } from './queries'
import type { RecentSession } from './queries'
import type { CalendarDay } from '@/lib/calendar/queries'

// Helpers to build test data
function makeProfile(overrides: Partial<SummaryInput['profile']> = {}): SummaryInput['profile'] {
  return {
    age: 30,
    weight_kg: 85.5,
    height_cm: 180,
    gender: 'male',
    training_age_years: 5,
    primary_goal: 'hypertrophy',
    injury_history: 'left shoulder impingement',
    athletic_background: null,
    ...overrides,
  }
}

function makeCurrentPlan(overrides: Partial<CurrentPlan> = {}): CurrentPlan {
  return {
    mesocycle: {
      id: 1,
      name: 'Hypertrophy Block',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: 'active',
    },
    templates: [
      {
        id: 1,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
        notes: null,
        run_type: null,
        target_pace: null,
        hr_zone: null,
        target_distance: null,
        target_duration: null,
        target_elevation_gain: null,
        interval_count: null,
        interval_rest: null,
        coaching_cues: null,
        planned_duration: null,
        exercise_slots: [
          { id: 1, exercise_id: 100, sets: 4, reps: '6-8', weight: 80, rpe: 8, rest_seconds: 120, order: 1, exercise_name: 'Bench Press' },
          { id: 2, exercise_id: 101, sets: 3, reps: '10-12', weight: 40, rpe: 7, rest_seconds: 90, order: 2, exercise_name: 'OHP' },
        ],
      },
    ],
    schedule: [
      { day_of_week: 0, template_id: 1, template_name: 'Push A', week_type: 'normal', period: 'morning', time_slot: null },
      { day_of_week: 2, template_id: 1, template_name: 'Push A', week_type: 'normal', period: 'morning', time_slot: null },
    ],
    ...overrides,
  }
}

function makeSession(overrides: Partial<RecentSession> = {}): RecentSession {
  return {
    id: 1,
    logDate: '2026-03-20',
    rating: 4,
    notes: 'Felt strong',
    templateSnapshot: { version: 1, name: 'Push A' },
    canonicalName: 'push-a',
    exercises: [
      {
        id: 1,
        exerciseName: 'Bench Press',
        order: 1,
        actualRpe: 8,
        sets: [
          { id: 1, setNumber: 1, actualReps: 8, actualWeight: 80 },
          { id: 2, setNumber: 2, actualReps: 7, actualWeight: 80 },
        ],
      },
    ],
    ...overrides,
  }
}

function makeProgressionTrend(): SummaryInput['progressionTrends'] {
  return [
    {
      canonicalName: 'push-a',
      exerciseName: 'Bench Press',
      dataPoints: [
        { date: '2026-03-06', actualWeight: 75, actualVolume: 1800 },
        { date: '2026-03-13', actualWeight: 77.5, actualVolume: 1950 },
        { date: '2026-03-20', actualWeight: 80, actualVolume: 2080 },
      ],
    },
  ]
}

function makeUpcomingDays(): CalendarDay[] {
  return [
    { date: '2026-03-26', template_name: 'Push A', modality: 'resistance', mesocycle_id: 1, is_deload: false, status: 'projected', period: 'morning', time_slot: null, duration: 90 },
    { date: '2026-03-27', template_name: null, modality: null, mesocycle_id: 1, is_deload: false, status: 'rest', period: null, time_slot: null, duration: null },
    { date: '2026-03-28', template_name: 'Pull A', modality: 'resistance', mesocycle_id: 1, is_deload: false, status: 'projected', period: 'morning', time_slot: null, duration: 90 },
  ]
}

function makeSubjectiveState(overrides: Partial<SubjectiveState> = {}): SubjectiveState {
  return {
    fatigue: 3,
    soreness: 2,
    sleepQuality: 4,
    currentInjuries: 'mild knee pain',
    additionalNotes: 'sleeping better this week',
    ...overrides,
  }
}

function makeFullInput(overrides: Partial<SummaryInput> = {}): SummaryInput {
  return {
    profile: makeProfile(),
    currentPlan: makeCurrentPlan(),
    recentSessions: [makeSession()],
    progressionTrends: makeProgressionTrend(),
    runningProgressionTrends: [],
    subjectiveState: makeSubjectiveState(),
    upcomingDays: makeUpcomingDays(),
    ...overrides,
  }
}

describe('generateCoachingSummary', () => {
  describe('full data', () => {
    it('returns a markdown string with all 6 sections', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('## Athlete Profile')
      expect(md).toContain('## Current Plan')
      expect(md).toContain('## Recent Sessions')
      expect(md).toContain('## Progression Trends')
      expect(md).toContain('## Subjective State')
      expect(md).toContain('## Upcoming Plan')
    })

    it('sections appear in correct order', () => {
      const md = generateCoachingSummary(makeFullInput())

      const profileIdx = md.indexOf('## Athlete Profile')
      const planIdx = md.indexOf('## Current Plan')
      const sessionsIdx = md.indexOf('## Recent Sessions')
      const trendsIdx = md.indexOf('## Progression Trends')
      const subjectiveIdx = md.indexOf('## Subjective State')
      const upcomingIdx = md.indexOf('## Upcoming Plan')

      expect(profileIdx).toBeLessThan(planIdx)
      expect(planIdx).toBeLessThan(sessionsIdx)
      expect(sessionsIdx).toBeLessThan(trendsIdx)
      expect(trendsIdx).toBeLessThan(subjectiveIdx)
      expect(subjectiveIdx).toBeLessThan(upcomingIdx)
    })

    it('includes weekly summary when sessions have data', () => {
      const md = generateCoachingSummary(makeFullInput())
      expect(md).toContain('## Weekly Summary')
    })
  })

  describe('Running support', () => {
    function makeRunningTemplate() {
      return {
        id: 2,
        name: 'Vo2 Max',
        canonical_name: 'vo2-max',
        modality: 'running' as const,
        notes: null,
        run_type: 'interval' as const,
        target_pace: '4:30/km',
        hr_zone: 5,
        target_distance: 8,
        target_duration: 45,
        target_elevation_gain: 150,
        interval_count: 6,
        interval_rest: 90,
        coaching_cues: 'Stay relaxed on recovery',
        planned_duration: null,
        exercise_slots: [],
      }
    }

    function makeRunningSession(): RecentSession {
      return {
        id: 10,
        logDate: '2026-03-20',
        rating: 3,
        notes: null,
        templateSnapshot: {
          version: 1,
          name: 'Vo2 Max',
          modality: 'running',
          run_type: 'interval',
          target_pace: '4:30/km',
          target_distance: 8,
          target_elevation_gain: 150,
          hr_zone: 5,
          actual_distance: 8.2,
          actual_avg_pace: '4:35/km',
          actual_avg_hr: 172,
          actual_elevation_gain: 165,
          interval_data: [
            { rep_number: 1, interval_pace: '4:20/km', interval_avg_hr: 175, interval_notes: null, interval_elevation_gain: 25 },
            { rep_number: 2, interval_pace: '4:25/km', interval_avg_hr: 178, interval_notes: null, interval_elevation_gain: 28 },
          ],
        },
        canonicalName: 'vo2-max',
        exercises: [],
      }
    }

    it('renders running template details in Current Plan', () => {
      const plan = makeCurrentPlan({
        templates: [makeRunningTemplate()],
      })
      const md = generateCoachingSummary(makeFullInput({ currentPlan: plan }))

      expect(md).toContain('Run type: interval')
      expect(md).toContain('Target distance: 8 km')
      expect(md).toContain('Target pace: 4:30/km')
      expect(md).toContain('HR zone: 5')
      expect(md).toContain('Target elevation: 150 m')
      expect(md).toContain('Intervals: 6 reps, 90s rest')
      expect(md).toContain('Cues: Stay relaxed on recovery')
    })

    it('renders running session actual data from snapshot', () => {
      const md = generateCoachingSummary(makeFullInput({
        recentSessions: [makeRunningSession()],
      }))

      expect(md).toContain('**Total distance:** 8.2 km (target: 8 km)')
      expect(md).toContain('**Overall avg pace:** 4:35/km (target: 4:30/km)')
      expect(md).toContain('**Overall avg HR:** 172 bpm (target zone 5)')
      expect(md).toContain('**Total elevation gain:** 165 m (target: 150 m)')
    })

    it('renders interval rep data', () => {
      const md = generateCoachingSummary(makeFullInput({
        recentSessions: [makeRunningSession()],
      }))

      expect(md).toContain('**Interval reps** (2):')
      expect(md).toContain('Rep 1 | pace 4:20/km | HR 175 | elev 25m')
      expect(md).toContain('Rep 2 | pace 4:25/km | HR 178 | elev 28m')
    })

    it('renders running progression trends', () => {
      const md = generateCoachingSummary(makeFullInput({
        runningProgressionTrends: [{
          canonicalName: 'vo2-max',
          templateName: 'Vo2 Max',
          runType: 'interval',
          dataPoints: [
            { date: '2026-03-06', distance: 7.5, avgPace: '4:40/km', avgHr: 168, elevationGain: 140 },
            { date: '2026-03-13', distance: 8.0, avgPace: '4:35/km', avgHr: 170, elevationGain: 155 },
          ],
        }],
      }))

      expect(md).toContain('## Running Progression')
      expect(md).toContain('Vo2 Max (interval)')
      expect(md).toContain('7.5 km')
      expect(md).toContain('4:40/km')
      expect(md).toContain('140 m')
    })

    it('renders MMA template with planned duration', () => {
      const plan = makeCurrentPlan({
        templates: [{
          id: 3,
          name: 'BJJ Gi',
          canonical_name: 'bjj-gi',
          modality: 'mma',
          notes: null,
          run_type: null, target_pace: null, hr_zone: null,
          target_distance: null, target_duration: null, target_elevation_gain: null,
          interval_count: null, interval_rest: null, coaching_cues: null,
          planned_duration: 90,
          exercise_slots: [],
        }],
      })
      const md = generateCoachingSummary(makeFullInput({ currentPlan: plan }))

      expect(md).toContain('Planned duration: 90 min')
    })
  })

  describe('Athlete Profile section', () => {
    it('includes profile key-value pairs', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('**Age:** 30')
      expect(md).toContain('**Weight:** 85.5 kg')
      expect(md).toContain('**Height:** 180 cm')
      expect(md).toContain('**Gender:** male')
      expect(md).toContain('**Training Age:** 5 years')
      expect(md).toContain('**Primary Goal:** hypertrophy')
      expect(md).toContain('**Injury History:** left shoulder impingement')
    })

    it('omits null profile fields', () => {
      const md = generateCoachingSummary(
        makeFullInput({
          profile: makeProfile({ age: null, injury_history: null }),
        })
      )

      expect(md).toContain('## Athlete Profile')
      expect(md).not.toContain('**Age:**')
      expect(md).not.toContain('**Injury History:**')
      // Non-null fields still present
      expect(md).toContain('**Weight:** 85.5 kg')
    })

    it('omits entire section when profile is null', () => {
      const md = generateCoachingSummary(makeFullInput({ profile: null }))

      expect(md).not.toContain('## Athlete Profile')
    })
  })

  describe('Current Plan section', () => {
    it('includes mesocycle name and dates', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('Hypertrophy Block')
      expect(md).toContain('01/03/2026')
      expect(md).toContain('28/03/2026')
    })

    it('includes template names and exercise lists', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('Push A')
      expect(md).toContain('Bench Press')
      expect(md).toContain('OHP')
    })

    it('includes weekly schedule with day names', () => {
      const md = generateCoachingSummary(makeFullInput())

      // day_of_week 0 = Monday, 2 = Wednesday
      expect(md).toContain('Monday')
      expect(md).toContain('Wednesday')
    })

    it('shows fallback when no active mesocycle', () => {
      const md = generateCoachingSummary(makeFullInput({ currentPlan: null }))

      expect(md).toContain('## Current Plan')
      expect(md).toContain('No active mesocycle')
    })
  })

  describe('Recent Sessions section', () => {
    it('includes session date, template name, exercises with sets', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('20/03/2026')
      expect(md).toContain('Bench Press')
      expect(md).toContain('80') // weight
      expect(md).toContain('8') // reps
    })

    it('includes workout rating when present', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('Rating: 4/5')
    })

    it('includes RPE when present', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('RPE 8')
    })

    it('shows fallback when no recent sessions', () => {
      const md = generateCoachingSummary(makeFullInput({ recentSessions: [] }))

      expect(md).toContain('## Recent Sessions')
      expect(md).toContain('No recent sessions')
    })
  })

  describe('Progression Trends section', () => {
    it('includes per-exercise trend data', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('Bench Press')
      expect(md).toContain('75') // first weight
      expect(md).toContain('80') // last weight
    })

    it('omits section when no progression data', () => {
      const md = generateCoachingSummary(makeFullInput({ progressionTrends: [] }))

      expect(md).not.toContain('## Progression Trends')
    })
  })

  describe('Subjective State section', () => {
    it('includes all subjective state fields', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('**Fatigue:** 3/5')
      expect(md).toContain('**Soreness:** 2/5')
      expect(md).toContain('**Sleep Quality:** 4/5')
      expect(md).toContain('**Current Injuries:** mild knee pain')
      expect(md).toContain('**Additional Notes:** sleeping better this week')
    })

    it('omits blank subjective fields', () => {
      const md = generateCoachingSummary(
        makeFullInput({
          subjectiveState: makeSubjectiveState({
            currentInjuries: null,
            additionalNotes: null,
          }),
        })
      )

      expect(md).toContain('## Subjective State')
      expect(md).toContain('**Fatigue:** 3/5')
      expect(md).not.toContain('**Current Injuries:**')
      expect(md).not.toContain('**Additional Notes:**')
    })

    it('omits entire section when all fields blank', () => {
      const md = generateCoachingSummary(
        makeFullInput({
          subjectiveState: {
            fatigue: null,
            soreness: null,
            sleepQuality: null,
            currentInjuries: null,
            additionalNotes: null,
          },
        })
      )

      expect(md).not.toContain('## Subjective State')
    })
  })

  describe('Upcoming Plan section', () => {
    it('includes projected workout days with template names', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('26/03/2026')
      expect(md).toContain('Push A')
      expect(md).toContain('28/03/2026')
      expect(md).toContain('Pull A')
    })

    it('shows rest days', () => {
      const md = generateCoachingSummary(makeFullInput())

      expect(md).toContain('27/03/2026')
      // Rest day indicated somehow
      expect(md).toMatch(/27\/03\/2026[\s\S]*Rest/)
    })

    it('omits section when no upcoming days', () => {
      const md = generateCoachingSummary(makeFullInput({ upcomingDays: [] }))

      expect(md).not.toContain('## Upcoming Plan')
    })

    it('omits section when currentPlan is null (no active meso)', () => {
      const md = generateCoachingSummary(
        makeFullInput({ currentPlan: null, upcomingDays: [] })
      )

      expect(md).not.toContain('## Upcoming Plan')
    })
  })
})
