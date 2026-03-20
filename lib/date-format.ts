// Format YYYY-MM-DD as "dd/mm/yyyy"
export function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

// Format with weekday: "Mon 20/03/2026"
export function formatDateWithWeekday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  const [year, month, day] = dateStr.split('-')
  return `${weekday} ${day}/${month}/${year}`
}

// Format with long weekday: "Monday 20/03/2026"
export function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  const [year, month, day] = dateStr.split('-')
  return `${weekday} ${day}/${month}/${year}`
}
