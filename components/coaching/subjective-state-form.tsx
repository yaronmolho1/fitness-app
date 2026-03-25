import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type SubjectiveState = {
  fatigue: number | null
  soreness: number | null
  sleepQuality: number | null
  currentInjuries: string
  notes: string
}

type Props = {
  value: SubjectiveState
  onChange: (state: SubjectiveState) => void
}

const RATINGS = [1, 2, 3, 4, 5] as const

type RatingKey = 'fatigue' | 'soreness' | 'sleepQuality'

const RATING_FIELDS: { key: RatingKey; label: string }[] = [
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'soreness', label: 'Soreness' },
  { key: 'sleepQuality', label: 'Sleep Quality' },
]

function RatingGroup({
  fieldKey,
  label,
  value,
  onSelect,
}: {
  fieldKey: string
  label: string
  value: number | null
  onSelect: (val: number | null) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        data-testid={`rating-${fieldKey}`}
        role="group"
        aria-label={label}
        className="flex gap-1.5"
      >
        {RATINGS.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n}`}
            aria-pressed={value === n}
            onClick={() => onSelect(value === n ? null : n)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition-colors',
              value === n
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SubjectiveStateForm({ value, onChange }: Props) {
  const handleRating = (key: RatingKey, val: number | null) => {
    onChange({ ...value, [key]: val })
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Subjective State</h3>

      <div className="grid gap-4 sm:grid-cols-3">
        {RATING_FIELDS.map(({ key, label }) => (
          <RatingGroup
            key={key}
            fieldKey={key}
            label={label}
            value={value[key]}
            onSelect={(val) => handleRating(key, val)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="current-injuries">Current Injuries</Label>
        <Input
          id="current-injuries"
          value={value.currentInjuries}
          onChange={(e) => onChange({ ...value, currentInjuries: e.target.value })}
          placeholder="e.g. Left knee tendinitis"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="Any additional context for the coach..."
          rows={3}
        />
      </div>
    </div>
  )
}
