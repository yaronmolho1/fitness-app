import { describe, it, expect } from 'vitest'
import { navItems } from './nav-items'

describe('navItems', () => {
  it('has 8 items in correct order', () => {
    expect(navItems.map(i => i.label)).toEqual([
      'Today',
      'Exercises',
      'Mesocycles',
      'Calendar',
      'Progression',
      'Routines',
      'Coaching',
      'Settings',
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

  it('Coaching links to /coaching', () => {
    const coaching = navItems.find(i => i.label === 'Coaching')
    expect(coaching).toBeDefined()
    expect(coaching!.href).toBe('/coaching')
  })

  it('Coaching uses BrainCircuit icon', async () => {
    const { BrainCircuit } = await import('lucide-react')
    const coaching = navItems.find(i => i.label === 'Coaching')
    expect(coaching!.icon).toBe(BrainCircuit)
  })

  it('Coaching appears after Routines', () => {
    const labels = navItems.map(i => i.label)
    const routinesIdx = labels.indexOf('Routines')
    const coachingIdx = labels.indexOf('Coaching')
    expect(coachingIdx).toBe(routinesIdx + 1)
  })

  it('Settings links to /settings', () => {
    const settings = navItems.find(i => i.label === 'Settings')
    expect(settings).toBeDefined()
    expect(settings!.href).toBe('/settings')
  })

  it('Settings uses Settings icon', async () => {
    const { Settings } = await import('lucide-react')
    const settings = navItems.find(i => i.label === 'Settings')
    expect(settings!.icon).toBe(Settings)
  })

  it('Settings appears after Coaching', () => {
    const labels = navItems.map(i => i.label)
    const coachingIdx = labels.indexOf('Coaching')
    const settingsIdx = labels.indexOf('Settings')
    expect(settingsIdx).toBe(coachingIdx + 1)
  })
})
