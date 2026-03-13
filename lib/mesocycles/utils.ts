// Compute mesocycle end date from start date, work weeks, and deload flag
export function calculateEndDate(
  startDate: string,
  workWeeks: number,
  hasDeload: boolean
): string {
  const totalDays = workWeeks * 7 + (hasDeload ? 7 : 0) - 1
  const start = new Date(startDate + 'T00:00:00')
  start.setDate(start.getDate() + totalDays)

  const year = start.getFullYear()
  const month = String(start.getMonth() + 1).padStart(2, '0')
  const day = String(start.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
