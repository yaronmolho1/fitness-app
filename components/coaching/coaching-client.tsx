'use client'

import { useState } from 'react'
import { ProfileForm } from './profile-form'
import { SubjectiveStateForm, type SubjectiveState } from './subjective-state-form'
import { SummaryPreview } from './summary-preview'
import type { athlete_profile } from '@/lib/db/schema'

type AthleteProfile = typeof athlete_profile.$inferSelect

type Props = {
  profile: AthleteProfile | null
}

const INITIAL_STATE: SubjectiveState = {
  fatigue: null,
  soreness: null,
  sleepQuality: null,
  currentInjuries: '',
  notes: '',
}

export function CoachingClient({ profile }: Props) {
  const [subjectiveState, setSubjectiveState] = useState<SubjectiveState>(INITIAL_STATE)

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold">Athlete Profile</h2>
        <ProfileForm profile={profile} />
      </section>

      <section>
        <SubjectiveStateForm value={subjectiveState} onChange={setSubjectiveState} />
      </section>

      <section>
        <SummaryPreview subjectiveState={subjectiveState} />
      </section>
    </div>
  )
}
