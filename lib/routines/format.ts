type InputFieldFlags = {
  has_weight: boolean
  has_length: boolean
  has_duration: boolean
  has_sets: boolean
  has_reps: boolean
}

const FIELD_LABELS: [keyof InputFieldFlags, string][] = [
  ['has_weight', 'weight'],
  ['has_length', 'length'],
  ['has_duration', 'duration'],
  ['has_sets', 'sets'],
  ['has_reps', 'reps'],
]

export function formatInputFields(item: InputFieldFlags): string {
  return FIELD_LABELS.filter(([key]) => item[key])
    .map(([, label]) => label)
    .join(', ')
}

export function formatScopeSummary(
  scope: string,
  skipOnDeload: boolean,
  mesocycleName: string | null,
  startDate: string | null,
  endDate: string | null
): string {
  if (skipOnDeload) return 'Skip on deload'

  if (scope === 'mesocycle' && mesocycleName) {
    return `Mesocycle: ${mesocycleName}`
  }

  if (scope === 'date_range' && startDate && endDate) {
    const fmt = (d: string) => {
      const [, month, day] = d.split('-')
      return `${day}/${month}`
    }
    return `${fmt(startDate)} – ${fmt(endDate)}`
  }

  return 'Global'
}
