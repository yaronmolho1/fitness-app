// Display: Sun=0, Mon=1, ..., Sat=6 (matches JS getDay())
// Internal: Mon=0, Tue=1, ..., Sun=6 (ISO convention, used in DB)

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

// Internal (0=Mon) → display index (0=Sun)
export function internalToDisplay(d: number): number {
  return (d + 1) % 7
}

// Display index (0=Sun) → internal (0=Mon)
export function displayToInternal(i: number): number {
  return (i + 6) % 7
}
