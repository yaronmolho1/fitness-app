// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { PageContainer } from './page-container'

afterEach(cleanup)

describe('PageContainer', () => {
  it('renders children', () => {
    render(<PageContainer>Hello</PageContainer>)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('applies max-w-4xl mx-auto when variant="wide"', () => {
    render(<PageContainer variant="wide">wide content</PageContainer>)
    const el = screen.getByText('wide content')
    expect(el.className).toContain('max-w-4xl')
    expect(el.className).toContain('mx-auto')
  })

  it('applies max-w-lg mx-auto when variant="narrow"', () => {
    render(<PageContainer variant="narrow">narrow content</PageContainer>)
    const el = screen.getByText('narrow content')
    expect(el.className).toContain('max-w-lg')
    expect(el.className).toContain('mx-auto')
  })

  it('applies progressive horizontal padding', () => {
    render(<PageContainer>padded content</PageContainer>)
    const el = screen.getByText('padded content')
    expect(el.className).toContain('px-4')
  })

  it('applies vertical padding py-6', () => {
    render(<PageContainer>vertical content</PageContainer>)
    const el = screen.getByText('vertical content')
    expect(el.className).toContain('py-6')
  })

  it('defaults to wide variant', () => {
    render(<PageContainer>default content</PageContainer>)
    const el = screen.getByText('default content')
    expect(el.className).toContain('max-w-4xl')
  })

  it('merges custom className', () => {
    render(<PageContainer className="bg-red-500">custom content</PageContainer>)
    const el = screen.getByText('custom content')
    expect(el.className).toContain('bg-red-500')
  })

  it('prevents horizontal overflow with overflow-x-hidden', () => {
    render(<PageContainer>overflow content</PageContainer>)
    const el = screen.getByText('overflow content')
    expect(el.className).toContain('overflow-x-hidden')
  })
})
