import { db } from '@/lib/db'
import { getTemplatesForMesocycle, type TemplateOption } from '@/lib/schedule/queries'
import { getSectionsForTemplate, type TemplateSectionRow } from '@/lib/templates/section-queries'
import { getSlotsByTemplate, type SlotWithExercise } from '@/lib/templates/slot-queries'
import { getWeekOverrides, mergeSlotWithOverride, computeDeloadDefaults, computeRunningDeloadDefaults, computeMmaDeloadDefaults } from '@/lib/progression/week-overrides'
import { getTemplateWeekOverrides } from '@/lib/progression/template-week-overrides'

export type MergedResistanceWeek = {
  weekNumber: number
  isDeload: boolean
  weight: number | null
  sets: number
  reps: string
  rpe: number | null
  duration: number | null
}

export type MergedRunningWeek = {
  weekNumber: number
  isDeload: boolean
  distance: number | null
  duration: number | null
  pace: string | null
  interval_count: number | null
  interval_rest: number | null
  elevation_gain: number | null
}

export type MergedMmaWeek = {
  weekNumber: number
  isDeload: boolean
  planned_duration: number | null
}

export type ResistanceSlotProjection = {
  slot: SlotWithExercise
  weeks: MergedResistanceWeek[]
}

export type ResistanceGroup = {
  template: TemplateOption
  slots: ResistanceSlotProjection[]
}

export type RunningGroup = {
  template: TemplateOption
  section: TemplateSectionRow
  weeks: MergedRunningWeek[]
}

export type MmaGroup = {
  template: TemplateOption
  section: TemplateSectionRow
  weeks: MergedMmaWeek[]
}

export type ProjectedData = {
  mesocycle: { id: number; name: string; workWeeks: number; hasDeload: boolean }
  resistanceGroups: ResistanceGroup[]
  runningGroups: RunningGroup[]
  mmaGroups: MmaGroup[]
}

async function buildResistanceSlotProjection(
  slot: SlotWithExercise,
  workWeeks: number,
  hasDeload: boolean
): Promise<ResistanceSlotProjection> {
  const overrides = await getWeekOverrides(db, slot.id)
  const overrideMap = new Map(overrides.map((o) => [o.week_number, o]))

  const weeks: MergedResistanceWeek[] = []

  for (let w = 1; w <= workWeeks; w++) {
    const merged = mergeSlotWithOverride(slot, overrideMap.get(w) ?? null)
    weeks.push({
      weekNumber: w,
      isDeload: false,
      weight: merged.weight ?? null,
      sets: merged.sets,
      reps: merged.reps,
      rpe: merged.rpe ?? null,
      duration: merged.duration ?? null,
    })
  }

  if (hasDeload) {
    const deloadOverride = overrideMap.get(workWeeks + 1)
    if (deloadOverride) {
      const merged = mergeSlotWithOverride(slot, deloadOverride)
      weeks.push({
        weekNumber: workWeeks + 1,
        isDeload: true,
        weight: merged.weight ?? null,
        sets: merged.sets,
        reps: merged.reps,
        rpe: merged.rpe ?? null,
        duration: merged.duration ?? null,
      })
    } else {
      const defaults = computeDeloadDefaults({ weight: slot.weight, sets: slot.sets, rpe: slot.rpe })
      weeks.push({
        weekNumber: workWeeks + 1,
        isDeload: true,
        weight: defaults.weight,
        sets: defaults.sets,
        reps: slot.reps,
        rpe: defaults.rpe,
        duration: slot.duration ?? null,
      })
    }
  }

  return { slot, weeks }
}

async function buildRunningWeeks(
  template: TemplateOption,
  section: TemplateSectionRow,
  workWeeks: number,
  hasDeload: boolean
): Promise<MergedRunningWeek[]> {
  const overrides = await getTemplateWeekOverrides(db, template.id, section.id)
  const overrideMap = new Map(overrides.map((o) => [o.week_number, o]))

  const base = {
    distance: section.target_distance ?? template.target_distance ?? null,
    duration: section.target_duration ?? template.target_duration ?? null,
    pace: section.target_pace ?? template.target_pace ?? null,
    interval_count: section.interval_count ?? template.interval_count ?? null,
    interval_rest: section.interval_rest ?? template.interval_rest ?? null,
  }

  const weeks: MergedRunningWeek[] = []

  for (let w = 1; w <= workWeeks; w++) {
    const override = overrideMap.get(w)
    weeks.push({
      weekNumber: w,
      isDeload: false,
      distance: override?.distance ?? base.distance,
      duration: override?.duration ?? base.duration,
      pace: override?.pace ?? base.pace,
      interval_count: override?.interval_count ?? base.interval_count,
      interval_rest: override?.interval_rest ?? base.interval_rest,
      elevation_gain: override?.elevation_gain ?? null,
    })
  }

  if (hasDeload) {
    const deloadOverride = overrideMap.get(workWeeks + 1)
    if (deloadOverride) {
      weeks.push({
        weekNumber: workWeeks + 1,
        isDeload: true,
        distance: deloadOverride.distance ?? base.distance,
        duration: deloadOverride.duration ?? base.duration,
        pace: deloadOverride.pace ?? base.pace,
        interval_count: deloadOverride.interval_count ?? base.interval_count,
        interval_rest: deloadOverride.interval_rest ?? base.interval_rest,
        elevation_gain: deloadOverride.elevation_gain ?? null,
      })
    } else {
      const defaults = computeRunningDeloadDefaults({ distance: base.distance, duration: base.duration, pace: base.pace })
      weeks.push({
        weekNumber: workWeeks + 1,
        isDeload: true,
        distance: defaults.distance,
        duration: defaults.duration,
        pace: defaults.pace,
        interval_count: base.interval_count,
        interval_rest: base.interval_rest,
        elevation_gain: null,
      })
    }
  }

  return weeks
}

async function buildMmaWeeks(
  template: TemplateOption,
  section: TemplateSectionRow,
  workWeeks: number,
  hasDeload: boolean
): Promise<MergedMmaWeek[]> {
  const overrides = await getTemplateWeekOverrides(db, template.id, section.id)
  const overrideMap = new Map(overrides.map((o) => [o.week_number, o]))

  const baseDuration = section.planned_duration ?? template.planned_duration ?? null

  const weeks: MergedMmaWeek[] = []

  for (let w = 1; w <= workWeeks; w++) {
    const override = overrideMap.get(w)
    weeks.push({
      weekNumber: w,
      isDeload: false,
      planned_duration: override?.planned_duration ?? baseDuration,
    })
  }

  if (hasDeload) {
    const deloadOverride = overrideMap.get(workWeeks + 1)
    if (deloadOverride) {
      weeks.push({
        weekNumber: workWeeks + 1,
        isDeload: true,
        planned_duration: deloadOverride.planned_duration ?? baseDuration,
      })
    } else {
      const defaults = computeMmaDeloadDefaults({ planned_duration: baseDuration })
      weeks.push({
        weekNumber: workWeeks + 1,
        isDeload: true,
        planned_duration: defaults.planned_duration,
      })
    }
  }

  return weeks
}

export async function getProjectedData(
  mesocycleId: number,
  mesocycleName: string,
  workWeeks: number,
  hasDeload: boolean
): Promise<ProjectedData> {
  const templates = await getTemplatesForMesocycle(mesocycleId)

  const resistanceGroups: ResistanceGroup[] = []
  const runningGroups: RunningGroup[] = []
  const mmaGroups: MmaGroup[] = []

  for (const template of templates) {
    if (template.modality === 'resistance') {
      const slots = getSlotsByTemplate(template.id)
      if (slots.length > 0) {
        const slotProjections = await Promise.all(
          slots.map((slot) => buildResistanceSlotProjection(slot, workWeeks, hasDeload))
        )
        resistanceGroups.push({ template, slots: slotProjections })
      }
    } else if (template.modality === 'running') {
      const sections = getSectionsForTemplate(template.id)
      if (sections.length > 0) {
        for (const section of sections) {
          const weeks = await buildRunningWeeks(template, section, workWeeks, hasDeload)
          runningGroups.push({ template, section, weeks })
        }
      } else {
        // Template-level running (no sections) — use a synthetic section
        const syntheticSection: TemplateSectionRow = {
          id: 0,
          section_name: template.name,
          modality: 'running',
          order: 0,
          run_type: template.run_type ?? null,
          target_pace: template.target_pace ?? null,
          hr_zone: template.hr_zone ?? null,
          interval_count: template.interval_count ?? null,
          interval_rest: template.interval_rest ?? null,
          coaching_cues: template.coaching_cues ?? null,
          target_distance: template.target_distance ?? null,
          target_duration: template.target_duration ?? null,
          planned_duration: null,
        }
        const weeks = await buildRunningWeeks(template, syntheticSection, workWeeks, hasDeload)
        runningGroups.push({ template, section: syntheticSection, weeks })
      }
    } else if (template.modality === 'mma') {
      const sections = getSectionsForTemplate(template.id)
      if (sections.length > 0) {
        for (const section of sections) {
          const weeks = await buildMmaWeeks(template, section, workWeeks, hasDeload)
          mmaGroups.push({ template, section, weeks })
        }
      } else {
        const syntheticSection: TemplateSectionRow = {
          id: 0,
          section_name: template.name,
          modality: 'mma',
          order: 0,
          run_type: null,
          target_pace: null,
          hr_zone: null,
          interval_count: null,
          interval_rest: null,
          coaching_cues: null,
          target_distance: null,
          target_duration: null,
          planned_duration: template.planned_duration ?? null,
        }
        const weeks = await buildMmaWeeks(template, syntheticSection, workWeeks, hasDeload)
        mmaGroups.push({ template, section: syntheticSection, weeks })
      }
    } else if (template.modality === 'mixed') {
      // Mixed templates: split by section modality
      const sections = getSectionsForTemplate(template.id)
      const slots = getSlotsByTemplate(template.id)

      // Resistance slots grouped by their section
      const resistanceSlots = slots.filter((s) => {
        if (!s.section_id) return true // slots without section default to resistance
        const section = sections.find((sec) => sec.id === s.section_id)
        return !section || section.modality === 'resistance'
      })

      if (resistanceSlots.length > 0) {
        const slotProjections = await Promise.all(
          resistanceSlots.map((slot) => buildResistanceSlotProjection(slot, workWeeks, hasDeload))
        )
        resistanceGroups.push({ template, slots: slotProjections })
      }

      // Running/MMA sections
      for (const section of sections) {
        if (section.modality === 'running') {
          const weeks = await buildRunningWeeks(template, section, workWeeks, hasDeload)
          runningGroups.push({ template, section, weeks })
        } else if (section.modality === 'mma') {
          const weeks = await buildMmaWeeks(template, section, workWeeks, hasDeload)
          mmaGroups.push({ template, section, weeks })
        }
      }
    }
  }

  return {
    mesocycle: { id: mesocycleId, name: mesocycleName, workWeeks, hasDeload },
    resistanceGroups,
    runningGroups,
    mmaGroups,
  }
}
