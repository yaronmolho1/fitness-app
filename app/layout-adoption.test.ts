import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const root = resolve(__dirname, '..')

function readPage(relPath: string): string {
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

// Pages that use PageHeader (form pages excluded — they have breadcrumb+title layout)
const headerPages = [
  { path: 'app/(app)/page.tsx', title: 'Today' },
  { path: 'app/(app)/exercises/page.tsx', title: 'Exercises' },
  { path: 'app/(app)/mesocycles/page.tsx', title: 'Mesocycles' },
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

describe('Layout adoption: PageContainer', () => {
  for (const { path: p, title } of narrowPages) {
    it(`${title} page uses PageContainer with narrow variant`, () => {
      const src = readPage(p)
      expect(src).toContain("from '@/components/layout/page-container'")
      expect(src).toContain('<PageContainer')
      expect(src).toMatch(/variant=["']narrow["']/)
    })
  }

  for (const { path: p, title } of widePages) {
    it(`${title} page uses PageContainer with wide variant`, () => {
      const src = readPage(p)
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
      const src = readPage(p)
      // Should not have manual max-w-* mx-auto px-* py-* on a wrapper div
      expect(src).not.toMatch(/className="[^"]*max-w-(lg|4xl)[^"]*mx-auto/)
      expect(src).not.toMatch(/className="[^"]*mx-auto[^"]*max-w-(lg|4xl)/)
    })
  }
})

describe('Layout adoption: PageHeader', () => {
  for (const { path: p, title } of headerPages) {
    it(`${title} page uses PageHeader`, () => {
      const src = readPage(p)
      expect(src).toContain("from '@/components/layout/page-header'")
      expect(src).toContain('<PageHeader')
    })
  }

  for (const { path: p, title } of headerPages) {
    it(`${title} page does not have ad-hoc h1 elements`, () => {
      const src = readPage(p)
      expect(src).not.toContain('<h1')
    })
  }
})

describe('Layout adoption: spacing normalization', () => {
  it('Calendar page uses container system (AC 13)', () => {
    const src = readPage('app/(app)/calendar/page.tsx')
    expect(src).toContain('<PageContainer')
  })

  it('Progression page uses container system (AC 14)', () => {
    const src = readPage('app/(app)/progression/page.tsx')
    expect(src).toContain('<PageContainer')
  })

  for (const { path: p, title } of allPages) {
    it(`${title} page uses space-y-6 for content sections (AC 11)`, () => {
      const src = readPage(p)
      expect(src).toContain('space-y-6')
    })
  }
})
