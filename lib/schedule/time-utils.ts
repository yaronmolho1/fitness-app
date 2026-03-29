import { z } from 'zod'

export type Period = 'morning' | 'afternoon' | 'evening'

// HH:MM 24h format, zero-padded, 00:00-23:59
export const timeSlotSchema = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d$/,
  'time_slot must be HH:MM format (00:00-23:59)'
)

// Positive integer minutes
export const durationSchema = z.number().int().positive('duration must be a positive integer')

// Derive display period from time slot
export function derivePeriod(timeSlot: string): Period {
  const hour = parseInt(timeSlot.split(':')[0], 10)
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

// Calculate end time, wrapping past midnight
export function getEndTime(timeSlot: string, durationMinutes: number): string {
  const [h, m] = timeSlot.split(':').map(Number)
  const totalMin = h * 60 + m + durationMinutes
  const endH = Math.floor(totalMin / 60) % 24
  const endM = totalMin % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

// Check if a new workout overlaps any existing entry's time range
export function checkOverlap(
  existingEntries: { time_slot: string; duration: number }[],
  newTimeSlot: string,
  newDuration: number
): boolean {
  const toMinutes = (ts: string) => {
    const [h, m] = ts.split(':').map(Number)
    return h * 60 + m
  }
  const newStart = toMinutes(newTimeSlot)
  const newEnd = newStart + newDuration
  return existingEntries.some(e => {
    const start = toMinutes(e.time_slot)
    const end = start + e.duration
    return newStart < end && newEnd > start
  })
}
