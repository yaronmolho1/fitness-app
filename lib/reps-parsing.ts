const RANGE_PATTERN = /^\s*(\d+)\s*-\s*(\d+)\s*$/
const SINGLE_INT_PATTERN = /^\s*(\d+)\s*$/

// Extracts lower bound from reps strings: "8-12" → 8, "8" → 8, "AMRAP" → null
export function parseRepsLowerBound(reps: string): number | null {
  if (!reps) return null

  const rangeMatch = reps.match(RANGE_PATTERN)
  if (rangeMatch) return parseInt(rangeMatch[1], 10)

  const singleMatch = reps.match(SINGLE_INT_PATTERN)
  if (singleMatch) return parseInt(singleMatch[1], 10)

  return null
}

// True when reps is a range with different bounds: "8-12" → true, "5-5" → false
export function isRepsRange(reps: string): boolean {
  const match = reps.match(RANGE_PATTERN)
  if (!match) return false
  return match[1] !== match[2]
}
