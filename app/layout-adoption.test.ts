import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const root = resolve(__dirname, '..')

function readSource(relPath: string): string {
  return readFileSync(resolve(root, relPath), 'utf-8')
}

// Page paths and their expected variants
const narrowPages = [
  { path: 'app/(app)/page.tsx', title: 'Today' },
  { path: 'app/(app)/routines/page.tsx', title: 'Routines' },
]

const widePages = [
  { path: 'app/(app)/exercises/page.tsx', title: 'Exercises' },
  { path: 'app/(app)/mesocycles/page.tsx', title: 'Mesocycles' },
  { path: 'app/(app)/mesocycles/[id]/page.tsx', title: 'Mesocycle Detail' },
  { path: 'app/(app)/calendar/page.tsx', title: 'Calendar' },
  { path: 'app/(app)/progression/page.tsx', title: 'Progression' },
]

// ALL pages must use PageHeader — no raw <h1> anywhere
const headerPages = [
  { path: 'app/(app)/page.tsx', title: 'Today' },
  { path: 'app/(app)/exercises/page.tsx', title: 'Exercises' },
  { path: 'app/(app)/mesocycles/page.tsx', title: 'Mesocycles' },
  { path: 'app/(app)/mesocycles/[id]/page.tsx', title: 'Mesocycle Detail' },
  { path: 'app/(app)/mesocycles/new/page.tsx', title: 'New Mesocycle' },
  { path: 'app/(app)/mesocycles/[id]/clone/page.tsx', title: 'Clone Mesocycle' },
  { path: 'app/(app)/calendar/page.tsx', title: 'Calendar' },
  { path: 'app/(app)/progression/page.tsx', title: 'Progression' },
  { path: 'app/(app)/routines/page.tsx', title: 'Routines' },
]

const allPages = [
  ...narrowPages,
  ...widePages,
  { path: 'app/(app)/mesocycles/new/page.tsx', title: 'New Mesocycle' },
  { path: 'app/(app)/mesocycles/[id]/clone/page.tsx', title: 'Clone Mesocycle' },
]

// Components with section headings (h2) that should use SectionHeading
const sectionHeadingComponents = [
  { path: 'components/template-section.tsx', title: 'TemplateSection' },
  { path: 'components/schedule-tabs.tsx', title: 'ScheduleTabs' },
  { path: 'components/mixed-logging-form.tsx', title: 'MixedLoggingForm' },
  { path: 'components/running-logging-form.tsx', title: 'RunningLoggingForm' },
  { path: 'components/mma-logging-form.tsx', title: 'MmaLoggingForm' },
  { path: 'components/workout-logging-form.tsx', title: 'WorkoutLoggingForm' },
  { path: 'components/calendar-grid.tsx', title: 'CalendarGrid' },
  { path: 'components/today-workout.tsx', title: 'TodayWorkout' },
]

describe('Layout adoption: PageContainer', () => {
  for (const { path: p, title } of narrowPages) {
    it(`${title} page uses PageContainer with narrow variant`, () => {
      const src = readSource(p)
      expect(src).toContain("from '@/components/layout/page-container'")
      expect(src).toContain('<PageContainer')
      expect(src).toMatch(/variant=["']narrow["']/)
    })
  }

  for (const { path: p, title } of widePages) {
    it(`${title} page uses PageContainer with wide variant`, () => {
      const src = readSource(p)
      expect(src).toContain("from '@/components/layout/page-container'")
      expect(src).toContain('<PageContainer')
      // wide is default, so either explicit or omitted is fine
      if (src.includes('variant=')) {
        expect(src).toMatch(/variant=["']wide["']/)
      }
    })
  }

  for (const { path: p, title } of allPages) {
    it(`${title} page does not have ad-hoc container classes`, () => {
      const src = readSource(p)
      expect(src).not.toMatch(/className="[^"]*max-w-(lg|4xl)[^"]*mx-auto/)
      expect(src).not.toMatch(/className="[^"]*mx-auto[^"]*max-w-(lg|4xl)/)
    })
  }
})

describe('Layout adoption: PageHeader', () => {
  for (const { path: p, title } of headerPages) {
    it(`${title} page uses PageHeader`, () => {
      const src = readSource(p)
      expect(src).toContain("from '@/components/layout/page-header'")
      expect(src).toContain('<PageHeader')
    })
  }

  for (const { path: p, title } of headerPages) {
    it(`${title} page does not have ad-hoc h1 elements`, () => {
      const src = readSource(p)
      expect(src).not.toContain('<h1')
    })
  }
})

describe('Layout adoption: SectionHeading standardization', () => {
  for (const { path: p, title } of sectionHeadingComponents) {
    it(`${title} uses SectionHeading for h2 headings`, () => {
      const src = readSource(p)
      expect(src).toContain("from '@/components/layout/section-heading'")
      expect(src).toContain('<SectionHeading')
      expect(src).not.toContain('<h2')
    })
  }
})

describe('Layout adoption: spacing normalization', () => {
  it('Calendar page uses container system (AC 13)', () => {
    const src = readSource('app/(app)/calendar/page.tsx')
    expect(src).toContain('<PageContainer')
  })

  it('Progression page uses container system (AC 14)', () => {
    const src = readSource('app/(app)/progression/page.tsx')
    expect(src).toContain('<PageContainer')
  })

  for (const { path: p, title } of allPages) {
    it(`${title} page uses space-y-6 for content sections (AC 11)`, () => {
      const src = readSource(p)
      expect(src).toContain('space-y-6')
    })
  }
})

describe('Layout adoption: mobile top offset', () => {
  it('App layout applies pt-14 on mobile for fixed TopHeader offset', () => {
    const src = readSource('app/(app)/layout.tsx')
    expect(src).toContain('pt-14')
  })

  it('App layout removes top padding on desktop (md:pt-0)', () => {
    const src = readSource('app/(app)/layout.tsx')
    expect(src).toContain('md:pt-0')
  })
})

describe('Layout adoption: touch targets', () => {
  it('BottomBar nav links have min 44px touch target', () => {
    const src = readSource('components/bottom-bar.tsx')
    expect(src).toContain('min-h-[44px]')
  })
})
