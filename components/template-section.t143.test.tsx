// T143: Mixed template section editing UI tests
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Capture SlotList props to verify section context is passed through
const slotListMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/components/running-template-form', () => ({
  RunningTemplateForm: () => <div data-testid="mock-running-template-form" />,
}))
vi.mock('@/components/mma-bjj-template-form', () => ({
  MmaBjjTemplateForm: () => <div data-testid="mock-mma-template-form" />,
}))
vi.mock('@/components/mixed-template-form', () => ({
  MixedTemplateForm: () => <div data-testid="mock-mixed-template-form" />,
}))
vi.mock('@/components/slot-list', () => ({
  SlotList: (props: Record<string, unknown>) => {
    slotListMock(props)
    return <div data-testid="mock-slot-list" data-section-id={props.sectionId} data-modality={props.modality}>SlotList</div>
  },
}))
vi.mock('@/components/cascade-scope-selector', () => ({
  CascadeScopeSelector: ({ updates }: { updates: Record<string, unknown> }) => (
    <div data-testid="mock-cascade">
      <span data-testid="cascade-updates">{JSON.stringify(updates)}</span>
    </div>
  ),
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

const updateSectionMock = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/templates/section-actions', () => ({
  updateSection: (...args: unknown[]) => updateSectionMock(...args),
}))

import { TemplateSection } from './template-section'
import type { TemplateOption } from '@/lib/schedule/queries'
import type { TemplateSectionRow } from '@/lib/templates/section-queries'

function makeTemplate(overrides: Partial<TemplateOption> = {}): TemplateOption {
  return {
    id: 1,
    name: 'Full Body',
    canonical_name: 'full-body',
    modality: 'mixed',
    notes: null,
    ...overrides,
  }
}

function makeSection(overrides: Partial<TemplateSectionRow> & Pick<TemplateSectionRow, 'id' | 'section_name' | 'modality' | 'order'>): TemplateSectionRow {
  return {
    run_type: null,
    target_pace: null,
    hr_zone: null,
    interval_count: null,
    interval_rest: null,
    coaching_cues: null,
    target_distance: null,
    target_duration: null,
    planned_duration: null,
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

describe('T143 — mixed template section inline editing', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(cleanup)

  // AC3: Resistance section renders SlotList with section_id context
  describe('resistance section', () => {
    it('passes sectionId to SlotList', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({ id: 10, section_name: 'Strength', modality: 'resistance', order: 1 })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
          slotsByTemplate={{ 1: [{ id: 1, section_id: 10 } as never] }}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Strength'))

      expect(slotListMock).toHaveBeenCalledWith(
        expect.objectContaining({ sectionId: 10 })
      )
    })

    // AC6: SlotList receives section modality, not hardcoded
    it('passes section modality to SlotList', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({ id: 10, section_name: 'Strength', modality: 'resistance', order: 1 })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
          slotsByTemplate={{ 1: [{ id: 1, section_id: 10 } as never] }}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Strength'))

      expect(slotListMock).toHaveBeenCalledWith(
        expect.objectContaining({ modality: 'resistance' })
      )
    })

    it('filters slots by section_id for the SlotList', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [
          makeSection({ id: 10, section_name: 'Upper', modality: 'resistance', order: 1 }),
          makeSection({ id: 11, section_name: 'Lower', modality: 'resistance', order: 2 }),
        ],
      }
      const slotsByTemplate = {
        1: [
          { id: 1, section_id: 10, exercise_name: 'Bench Press' } as never,
          { id: 2, section_id: 11, exercise_name: 'Squat' } as never,
        ],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
          slotsByTemplate={slotsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Upper'))

      // SlotList should receive only the slots for section 10
      expect(slotListMock).toHaveBeenCalledWith(
        expect.objectContaining({
          slots: [expect.objectContaining({ id: 1, section_id: 10 })],
        })
      )
    })
  })

  // AC4: Running section renders editable fields
  describe('running section', () => {
    it('renders all running-specific editable fields', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 20, section_name: 'Cardio', modality: 'running', order: 1,
          run_type: 'easy', target_pace: '5:30/km', hr_zone: 2,
          target_distance: 5, target_duration: 30,
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Cardio'))

      expect(screen.getByLabelText('Run Type')).toBeInTheDocument()
      expect(screen.getByLabelText('Target Pace')).toHaveValue('5:30/km')
      expect(screen.getByLabelText('HR Zone')).toHaveValue('2')
      expect(screen.getByLabelText('Target Distance (km)')).toHaveValue('5')
      expect(screen.getByLabelText('Target Duration (min)')).toHaveValue('30')
    })

    it('renders coaching cues textarea', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 20, section_name: 'Cardio', modality: 'running', order: 1,
          run_type: 'easy', coaching_cues: 'Keep heart rate low',
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Cardio'))

      expect(screen.getByLabelText('Coaching Cues')).toHaveValue('Keep heart rate low')
    })

    it('renders interval fields when run_type is interval', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 20, section_name: 'Speed Work', modality: 'running', order: 1,
          run_type: 'interval', interval_count: 6, interval_rest: 90,
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Speed Work'))

      expect(screen.getByLabelText('Intervals')).toHaveValue('6')
      expect(screen.getByLabelText('Rest (seconds)')).toHaveValue('90')
    })

    it('saves running section changes via updateSection', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 20, section_name: 'Cardio', modality: 'running', order: 1,
          run_type: 'easy', target_distance: null,
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Cardio'))
      await user.type(screen.getByLabelText('Target Distance (km)'), '10')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(updateSectionMock).toHaveBeenCalledWith(20, expect.objectContaining({
        target_distance: 10,
      }))
    })

    it('shows save/cancel buttons when not completed', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 20, section_name: 'Cardio', modality: 'running', order: 1,
          run_type: 'easy',
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Cardio'))

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('disables running fields when mesocycle is completed', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 20, section_name: 'Cardio', modality: 'running', order: 1,
          run_type: 'easy',
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
          isCompleted
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Cardio'))

      expect(screen.getByLabelText('Run Type')).toBeDisabled()
      expect(screen.getByLabelText('Target Pace')).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })
  })

  // AC5: MMA section renders editable duration
  describe('mma section', () => {
    it('renders editable duration field', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 30, section_name: 'Sparring', modality: 'mma', order: 1,
          planned_duration: 60,
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Sparring'))

      expect(screen.getByLabelText('Planned Duration (minutes)')).toHaveValue('60')
    })

    it('saves mma section changes via updateSection', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 30, section_name: 'Sparring', modality: 'mma', order: 1,
          planned_duration: 60,
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Sparring'))
      await user.clear(screen.getByLabelText('Planned Duration (minutes)'))
      await user.type(screen.getByLabelText('Planned Duration (minutes)'), '90')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(updateSectionMock).toHaveBeenCalledWith(30, expect.objectContaining({
        planned_duration: 90,
      }))
    })

    it('shows save/cancel for mma section when not completed', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 30, section_name: 'Sparring', modality: 'mma', order: 1,
          planned_duration: 60,
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Sparring'))

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('disables mma fields when completed', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 30, section_name: 'Sparring', modality: 'mma', order: 1,
          planned_duration: 60,
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
          isCompleted
        />
      )

      await user.click(screen.getByText('Full Body'))
      await user.click(screen.getByText('Sparring'))

      expect(screen.getByLabelText('Planned Duration (minutes)')).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })
  })

  // AC8: Editing one section doesn't affect another
  describe('section isolation', () => {
    it('expanding one section does not expand another', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [
          makeSection({ id: 10, section_name: 'Strength', modality: 'resistance', order: 1 }),
          makeSection({ id: 20, section_name: 'Cardio', modality: 'running', order: 2, run_type: 'easy' }),
          makeSection({ id: 30, section_name: 'Sparring', modality: 'mma', order: 3, planned_duration: 60 }),
        ],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
          slotsByTemplate={{ 1: [] }}
        />
      )

      // Expand mixed template
      await user.click(screen.getByText('Full Body'))

      // Only expand running section
      await user.click(screen.getByText('Cardio'))

      // Running fields visible
      expect(screen.getByLabelText('Run Type')).toBeInTheDocument()
      // MMA duration not visible (Sparring section not expanded)
      expect(screen.queryByLabelText('Planned Duration (minutes)')).not.toBeInTheDocument()
      // SlotList not visible (Strength section not expanded)
      expect(screen.queryByTestId('mock-slot-list')).not.toBeInTheDocument()
    })
  })

  // AC9: Pure resistance templates still work without sectionId
  describe('pure resistance template (no sections)', () => {
    it('renders SlotList without sectionId for non-mixed resistance template', async () => {
      const user = userEvent.setup()
      const templates = [{
        id: 1,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance' as const,
        notes: null,
      }]
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          slotsByTemplate={{ 1: [] }}
        />
      )

      await user.click(screen.getByText('Push A'))

      expect(slotListMock).toHaveBeenCalledWith(
        expect.not.objectContaining({ sectionId: expect.anything() })
      )
    })
  })

  // Section summary badges in collapsed state
  describe('section summary badges', () => {
    it('shows exercise count for resistance section', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({ id: 10, section_name: 'Strength', modality: 'resistance', order: 1 })],
      }
      const slotsByTemplate = {
        1: [
          { id: 1, section_id: 10 } as never,
          { id: 2, section_id: 10 } as never,
        ],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
          slotsByTemplate={slotsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))

      expect(screen.getByText('2 exercises')).toBeInTheDocument()
    })

    it('shows modality badge for each section', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [
          makeSection({ id: 10, section_name: 'Strength', modality: 'resistance', order: 1 }),
          makeSection({ id: 20, section_name: 'Cardio', modality: 'running', order: 2, run_type: 'easy', target_distance: 3 }),
          makeSection({ id: 30, section_name: 'Sparring', modality: 'mma', order: 3, planned_duration: 60 }),
        ],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
          slotsByTemplate={{ 1: [] }}
        />
      )

      await user.click(screen.getByText('Full Body'))

      // Each section shows its modality badge
      expect(screen.getByText('resistance')).toBeInTheDocument()
      expect(screen.getByText('running')).toBeInTheDocument()
      expect(screen.getByText('mma')).toBeInTheDocument()
    })

    it('shows running summary in collapsed section row', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 20, section_name: 'Cardio', modality: 'running', order: 1,
          run_type: 'easy', target_distance: 5,
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))

      // Summary text visible in collapsed state
      expect(screen.getByText(/easy/)).toBeInTheDocument()
      expect(screen.getByText(/5km/)).toBeInTheDocument()
    })

    it('shows mma duration summary in collapsed section row', async () => {
      const user = userEvent.setup()
      const templates = [makeTemplate()]
      const sectionsByTemplate = {
        1: [makeSection({
          id: 30, section_name: 'Sparring', modality: 'mma', order: 1,
          planned_duration: 60,
        })],
      }
      render(
        <TemplateSection
          {...defaultProps}
          templates={templates}
          sectionsByTemplate={sectionsByTemplate}
        />
      )

      await user.click(screen.getByText('Full Body'))

      expect(screen.getByText('60 min')).toBeInTheDocument()
    })
  })
})
