// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { SectionHeading } from './section-heading'

afterEach(cleanup)

describe('SectionHeading', () => {
  it('renders as an h2 element', () => {
    render(<SectionHeading>Templates</SectionHeading>)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Templates')
  })

  it('applies default spacing and typography classes', () => {
    render(<SectionHeading>Templates</SectionHeading>)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.className).toContain('mt-8')
    expect(heading.className).toContain('mb-4')
    expect(heading.className).toContain('text-lg')
    expect(heading.className).toContain('font-semibold')
    expect(heading.className).toContain('tracking-tight')
  })

  it('merges custom className', () => {
    render(<SectionHeading className="custom-class">Templates</SectionHeading>)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.className).toContain('custom-class')
  })
})
