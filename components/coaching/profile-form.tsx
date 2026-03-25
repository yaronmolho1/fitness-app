'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveAthleteProfile } from '@/lib/coaching/actions'
import type { athlete_profile } from '@/lib/db/schema'

type AthleteProfile = typeof athlete_profile.$inferSelect

type ProfileFormProps = {
  profile: AthleteProfile | null
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

export function ProfileForm({ profile }: ProfileFormProps) {
  const [age, setAge] = useState(profile?.age?.toString() ?? '')
  const [weightKg, setWeightKg] = useState(profile?.weight_kg?.toString() ?? '')
  const [heightCm, setHeightCm] = useState(profile?.height_cm?.toString() ?? '')
  const [gender, setGender] = useState(profile?.gender ?? '')
  const [trainingAge, setTrainingAge] = useState(profile?.training_age_years?.toString() ?? '')
  const [primaryGoal, setPrimaryGoal] = useState(profile?.primary_goal ?? '')
  const [injuryHistory, setInjuryHistory] = useState(profile?.injury_history ?? '')
  const [, startTransition] = useTransition()

  // Track last-saved values to skip no-op saves
  const savedRef = useRef({
    age: profile?.age?.toString() ?? '',
    weight_kg: profile?.weight_kg?.toString() ?? '',
    height_cm: profile?.height_cm?.toString() ?? '',
    gender: profile?.gender ?? '',
    training_age_years: profile?.training_age_years?.toString() ?? '',
    primary_goal: profile?.primary_goal ?? '',
    injury_history: profile?.injury_history ?? '',
  })

  // Map field names to their state setters for revert on failure
  const setterMap: Record<string, (v: string) => void> = {
    age: setAge,
    weight_kg: setWeightKg,
    height_cm: setHeightCm,
    gender: setGender,
    training_age_years: setTrainingAge,
    primary_goal: setPrimaryGoal,
    injury_history: setInjuryHistory,
  }

  function saveField(field: string, rawValue: string) {
    const savedKey = field as keyof typeof savedRef.current
    if (savedRef.current[savedKey] === rawValue) return

    const previousValue = savedRef.current[savedKey]

    const numericFields = ['age', 'weight_kg', 'height_cm', 'training_age_years']
    let value: string | number | null

    if (numericFields.includes(field)) {
      value = rawValue === '' ? null : Number(rawValue)
    } else {
      value = rawValue || null
    }

    startTransition(async () => {
      const result = await saveAthleteProfile({ [field]: value })
      if (result.success) {
        savedRef.current[savedKey] = rawValue
      } else {
        // Revert UI to last-saved value
        setterMap[field]?.(previousValue)
        toast.error(result.error)
      }
    })
  }

  function handleGenderChange(value: string) {
    setGender(value)
    saveField('gender', value)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="profile-age">Age</Label>
        <Input
          id="profile-age"
          type="number"
          min={1}
          max={120}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          onBlur={() => saveField('age', age)}
          placeholder="Years"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-weight">Weight (kg)</Label>
        <Input
          id="profile-weight"
          type="number"
          min={1}
          max={500}
          step={0.1}
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          onBlur={() => saveField('weight_kg', weightKg)}
          placeholder="kg"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-height">Height (cm)</Label>
        <Input
          id="profile-height"
          type="number"
          min={1}
          max={300}
          step={0.1}
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          onBlur={() => saveField('height_cm', heightCm)}
          placeholder="cm"
        />
      </div>

      <div className="space-y-2">
        <Label>Gender</Label>
        <Select value={gender} onValueChange={handleGenderChange}>
          <SelectTrigger data-testid="gender-select">
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            {GENDER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-training-age">Training Age (years)</Label>
        <Input
          id="profile-training-age"
          type="number"
          min={0}
          max={80}
          value={trainingAge}
          onChange={(e) => setTrainingAge(e.target.value)}
          onBlur={() => saveField('training_age_years', trainingAge)}
          placeholder="Years training"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-primary-goal">Primary Goal</Label>
        <Input
          id="profile-primary-goal"
          type="text"
          value={primaryGoal}
          onChange={(e) => setPrimaryGoal(e.target.value)}
          onBlur={() => saveField('primary_goal', primaryGoal)}
          placeholder="e.g. Hypertrophy, Strength"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="profile-injury-history">Injury History</Label>
        <Textarea
          id="profile-injury-history"
          value={injuryHistory}
          onChange={(e) => setInjuryHistory(e.target.value)}
          onBlur={() => saveField('injury_history', injuryHistory)}
          placeholder="Describe any past or current injuries"
          rows={3}
        />
      </div>
    </div>
  )
}
