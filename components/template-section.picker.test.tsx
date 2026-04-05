// @vitest-environment jsdom
// Tests for the new Add Template picker integration in TemplateSection
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

// Mock useIsMobile (desktop by default)
const mockUseIsMobile = vi.fn(() => false)
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}))

// Mock child components
vi.mock('@/components/running-template-form', () => ({
  RunningTemplateForm: (_props: { mesocycleId: number }) => (
    <div data-testid="mock-running-template-form">RunningTemplateForm</div>
  ),
}))
vi.mock('@/components/mma-bjj-template-form', () => ({
  MmaBjjTemplateForm: (_props: { mesocycleId: number }) => (
    <div data-testid="mock-mma-template-form">MmaBjjTemplateForm</div>
  ),
}))
vi.mock('@/components/mixed-template-form', () => ({
  MixedTemplateForm: (_props: { mesocycleId: number }) => (
    <div data-testid="mock-mixed-template-form">MixedTemplateForm</div>
  ),
}))
vi.mock('@/components/slot-list', () => ({
  SlotList: () => <div data-testid="mock-slot-list">SlotList</div>,
}))
vi.mock('@/components/cascade-scope-selector', () => ({
  CascadeScopeSelector: () => <div data-testid="mock-cascade">CascadeScopeSelector</div>,
}))
vi.mock('@/components/layout/section-heading', () => ({
  SectionHeading: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}))
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
  sortableKeyboardCoordinates: vi.fn(),
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const a = [...arr]; a.splice(to, 0, ...a.splice(from, 1)); return a
  }),
}))
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}))
vi.mock('@/lib/templates/actions', () => ({
  createResistanceTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  reorderTemplates: vi.fn(),
}))
vi.mock('@/lib/templates/copy-actions', () => ({
  copyTemplateToMesocycle: vi.fn(),
}))
vi.mock('@/lib/templates/browse-queries', () => ({
  getBrowseTemplates: vi.fn().mockResolvedValue([]),
}))

import { TemplateSection } from './template-section'
import type { TemplateOption } from '@/lib/schedule/queries'

function makeTemplate(overrides: Partial<TemplateOption> = {}): TemplateOption {
  return {
    id: 1,
    name: 'Push A',
    canonical_name: 'push-a',
    modality: 'resistance',
    notes: null,
    ...overrides,
  }
}

const defaultProps = {
  mesocycleId: 1,
  templates: [] as TemplateOption[],
  exercises: [],
  slotsByTemplate: {},
  isCompleted: false,
  workWeeks: 4,
  hasDeload: false,
}

describe('TemplateSection — picker integration (T138)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseIsMobile.mockReturnValue(false)
  })

  afterEach(cleanup)

  // AC1: Single "Add Template" button replaces 4 type buttons
  it('renders single "Add Template" button instead of 4 type buttons', () => {
    render(<TemplateSection {...defaultProps} />)

    expect(screen.getByRole('button', { name: /add template/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Resistance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Running' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ MMA/BJJ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Mixed Workout' })).not.toBeInTheDocument()
  })

  // AC3: Selecting a type from picker opens the correct creation form
  it('opens resistance form when Resistance selected from picker', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Resistance'))

    expect(screen.getByText('New Resistance Template')).toBeInTheDocument()
  })

  it('opens running form when Running selected from picker', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Running'))

    expect(screen.getByText('New Running Template')).toBeInTheDocument()
  })

  it('opens MMA form when MMA/BJJ selected from picker', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('MMA/BJJ'))

    expect(screen.getByText('New MMA/BJJ Template')).toBeInTheDocument()
  })

  it('opens mixed form when Mixed Workout selected from picker', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Mixed Workout'))

    expect(screen.getByText('New Mixed Template')).toBeInTheDocument()
  })

  // AC5: Button hidden on completed mesocycles
  it('hides "Add Template" button when mesocycle is completed', () => {
    render(<TemplateSection {...defaultProps} isCompleted={true} />)
    expect(screen.queryByRole('button', { name: /add template/i })).not.toBeInTheDocument()
  })

  // AC: Button hidden when form is open
  it('hides "Add Template" button when a creation form is open', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Resistance'))

    expect(screen.queryByRole('button', { name: /add template/i })).not.toBeInTheDocument()
  })

  // AC: Cancel form restores the Add Template button
  it('restores "Add Template" button when creation form is cancelled', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Resistance'))
    expect(screen.getByText('New Resistance Template')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: /add template/i })).toBeInTheDocument()
  })
})
