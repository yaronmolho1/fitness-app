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
    cell: 'bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-900/20 dark:border-slate-600 dark:text-slate-200 modality-resistance',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
    accent: 'border-l-slate-500 dark:border-l-slate-400',
  },
  running: {
    cell: 'bg-teal-50 border-teal-300 text-teal-900 dark:bg-teal-900/20 dark:border-teal-600 dark:text-teal-200 modality-running',
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-800/50 dark:text-teal-300',
    accent: 'border-l-teal-500 dark:border-l-teal-400',
  },
  mma: {
    cell: 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-900/20 dark:border-rose-600 dark:text-rose-200 modality-mma',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-800/50 dark:text-rose-300',
    accent: 'border-l-rose-500 dark:border-l-rose-400',
  },
  mixed: {
    cell: 'bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-900/20 dark:border-indigo-600 dark:text-indigo-200 modality-mixed',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800/50 dark:text-indigo-300',
    accent: 'border-l-indigo-500 dark:border-l-indigo-400',
  },
}

const FALLBACK: ModalityColorConfig = {
  cell: 'bg-zinc-50 border-zinc-300 text-zinc-900 dark:bg-zinc-900/20 dark:border-zinc-600 dark:text-zinc-200 modality-unknown',
  badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400',
  accent: 'border-l-zinc-400 dark:border-l-zinc-500',
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
