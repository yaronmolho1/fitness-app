import { describe, it, expect } from 'vitest'
import { navItems } from './nav-items'

describe('navItems', () => {
  it('has 6 items in correct order', () => {
    expect(navItems.map(i => i.label)).toEqual([
      'Today',
      'Exercises',
      'Mesocycles',
      'Calendar',
      'Progression',
      'Routines',
    ])
  })

  it('Progression links to /progression', () => {
    const progression = navItems.find(i => i.label === 'Progression')
    expect(progression).toBeDefined()
    expect(progression!.href).toBe('/progression')
  })

  it('Progression uses TrendingUp icon', async () => {
    const { TrendingUp } = await import('lucide-react')
    const progression = navItems.find(i => i.label === 'Progression')
    expect(progression!.icon).toBe(TrendingUp)
  })
})
