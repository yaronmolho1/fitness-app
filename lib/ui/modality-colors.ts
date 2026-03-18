type ModalityColorConfig = {
  /** Full class string for calendar cells (bg + border + text + dark variants + marker) */
  cell: string
  /** Class string for badge components (bg + text + dark variants) */
  badge: string
  /** Single border-accent class for left-border treatments */
  accent: string
}

export const MODALITY_COLORS: Record<string, ModalityColorConfig> = {
  resistance: {
    cell: 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-200 modality-resistance',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    accent: 'border-l-blue-500',
  },
  running: {
    cell: 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-200 modality-running',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    accent: 'border-l-emerald-500',
  },
  mma: {
    cell: 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200 modality-mma',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    accent: 'border-l-amber-500',
  },
}

const FALLBACK: ModalityColorConfig = {
  cell: 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-900/30 dark:border-gray-700 dark:text-gray-200 modality-unknown',
  badge: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-200',
  accent: 'border-l-gray-500',
}

function resolve(modality: string): ModalityColorConfig {
  return MODALITY_COLORS[modality] ?? FALLBACK
}

/** Full cell classes (bg + border + text + dark + marker) for calendar grid cells */
export function getModalityClasses(modality: string): string {
  return resolve(modality).cell
}

/** Badge classes (bg + text + dark) for inline badges */
export function getModalityBadgeClasses(modality: string): string {
  return resolve(modality).badge
}

/** Single accent class for left-border treatments on cards */
export function getModalityAccentClass(modality: string): string {
  return resolve(modality).accent
}
