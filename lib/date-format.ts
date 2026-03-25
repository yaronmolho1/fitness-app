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

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Format for retroactive banner: "20/Mar/2026"
export function formatDateBanner(dateStr: string): string {
  const [year, monthNum, day] = dateStr.split('-')
  return `${day}/${MONTH_ABBR[parseInt(monthNum, 10) - 1]}/${year}`
}

// Format for toast notifications: "20/Mar"
export function formatDateToast(dateStr: string): string {
  const [, monthNum, day] = dateStr.split('-')
  return `${day}/${MONTH_ABBR[parseInt(monthNum, 10) - 1]}`
}

// Format with long weekday: "Monday 20/03/2026"
export function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  const [year, month, day] = dateStr.split('-')
  return `${weekday} ${day}/${month}/${year}`
}
