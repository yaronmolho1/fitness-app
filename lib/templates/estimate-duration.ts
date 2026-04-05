// Workout duration estimation — pure functions, no DB access

const SECONDS_PER_SET = 45

const BUFFERS: Record<string, number> = {
  resistance: 10, // warm-up only
  running: 20,    // 15 warm-up + 5 cool-down
  mma: 15,        // 10 warm-up + 5 cool-down
}

export function snapDuration(mins: number): number {
  const snapped = Math.round(mins / 15) * 15
  return Math.max(15, Math.min(300, snapped))
}

export type SlotForEstimate = {
  sets: number
  rest_seconds: number | null
  group_id: number | null
  group_rest_seconds: number | null
}

export function estimateResistanceDuration(slots: SlotForEstimate[]): number {
  if (slots.length === 0) return 0

  let totalSeconds = 0

  // Group slots by group_id
  const standalone: SlotForEstimate[] = []
  const groups = new Map<number, SlotForEstimate[]>()

  for (const slot of slots) {
    if (slot.group_id == null) {
      standalone.push(slot)
    } else {
      const group = groups.get(slot.group_id) ?? []
      group.push(slot)
      groups.set(slot.group_id, group)
    }
  }

  // Standalone slots: working time + rest between sets
  for (const slot of standalone) {
    const workTime = slot.sets * SECONDS_PER_SET
    const restTime = (slot.rest_seconds ?? 0) * Math.max(0, slot.sets - 1)
    totalSeconds += workTime + restTime
  }

  // Superset groups: all slots share rounds
  for (const group of groups.values()) {
    const maxSets = Math.max(...group.map(s => s.sets))
    // Working time: each slot contributes its sets × working time
    const workTime = group.reduce((sum, s) => sum + s.sets * SECONDS_PER_SET, 0)
    // Rest between rounds uses group_rest_seconds from any slot in group (they're all the same)
    const groupRest = group[0].group_rest_seconds ?? 0
    const restTime = groupRest * Math.max(0, maxSets - 1)
    totalSeconds += workTime + restTime
  }

  const minutes = totalSeconds / 60
  return snapDuration(minutes + BUFFERS.resistance)
}

export function estimateRunningDuration(targetDuration: number | null): number | null {
  if (targetDuration == null) return null
  return snapDuration(targetDuration + BUFFERS.running)
}

export function estimateMmaDuration(plannedDuration: number | null): number | null {
  if (plannedDuration == null) return null
  return snapDuration(plannedDuration + BUFFERS.mma)
}

export type SectionForEstimate = {
  modality: string
  target_duration: number | null
  planned_duration: number | null
}

export function estimateMixedDuration(
  sections: SectionForEstimate[],
  slotsBySection: Map<number, SlotForEstimate[]>,
  sectionIds: number[],
): number | null {
  if (sections.length === 0) return null

  let totalMinutes = 0
  let hasAnyEstimate = false
  const modalities = new Set<string>()

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const sectionId = sectionIds[i]
    modalities.add(section.modality)

    if (section.modality === 'resistance') {
      const slots = slotsBySection.get(sectionId) ?? []
      if (slots.length > 0) {
        // Raw minutes without buffer — we add buffer once at the end
        const raw = estimateResistanceDuration(slots) - BUFFERS.resistance
        totalMinutes += raw
        hasAnyEstimate = true
      }
    } else if (section.modality === 'running') {
      if (section.target_duration != null) {
        totalMinutes += section.target_duration
        hasAnyEstimate = true
      }
    } else if (section.modality === 'mma') {
      if (section.planned_duration != null) {
        totalMinutes += section.planned_duration
        hasAnyEstimate = true
      }
    }
  }

  if (!hasAnyEstimate) return null

  // Use the max buffer from component modalities
  const maxBuffer = Math.max(...[...modalities].map(m => BUFFERS[m] ?? 0))
  return snapDuration(totalMinutes + maxBuffer)
}

export type TemplateForEstimate = {
  modality: string
  target_duration: number | null
  planned_duration: number | null
}

export function estimateTemplateDuration(
  template: TemplateForEstimate,
  slots: SlotForEstimate[],
  sections?: SectionForEstimate[],
  sectionIds?: number[],
  slotsBySection?: Map<number, SlotForEstimate[]>,
): number | null {
  switch (template.modality) {
    case 'resistance':
      return slots.length > 0 ? estimateResistanceDuration(slots) : null
    case 'running':
      return estimateRunningDuration(template.target_duration)
    case 'mma':
      return estimateMmaDuration(template.planned_duration)
    case 'mixed':
      if (sections && sectionIds && slotsBySection) {
        return estimateMixedDuration(sections, slotsBySection, sectionIds)
      }
      return null
    default:
      return null
  }
}

// Week-aware estimation: applies overrides before computing
export type SlotWeekOverride = {
  exercise_slot_id: number
  sets: number | null
  rest_seconds?: number | null
}

export type TemplateWeekOverride = {
  section_id: number | null
  duration: number | null
  planned_duration: number | null
}

export type SlotWithId = SlotForEstimate & { id: number; section_id?: number | null }

export function applySlotOverrides(
  slots: SlotWithId[],
  overrides: SlotWeekOverride[],
): SlotForEstimate[] {
  const overrideMap = new Map(overrides.map(o => [o.exercise_slot_id, o]))
  return slots.map(slot => {
    const override = overrideMap.get(slot.id)
    if (!override) return slot
    return {
      sets: override.sets ?? slot.sets,
      rest_seconds: slot.rest_seconds,
      group_id: slot.group_id,
      group_rest_seconds: slot.group_rest_seconds,
    }
  })
}

export function applySectionOverrides(
  sections: SectionForEstimate[],
  sectionIds: number[],
  overrides: TemplateWeekOverride[],
): SectionForEstimate[] {
  const overrideMap = new Map(
    overrides.filter(o => o.section_id != null).map(o => [o.section_id!, o])
  )
  const templateOverride = overrides.find(o => o.section_id == null)

  return sections.map((section, i) => {
    const sectionId = sectionIds[i]
    const override = overrideMap.get(sectionId) ?? templateOverride
    if (!override) return section
    return {
      modality: section.modality,
      target_duration: override.duration ?? section.target_duration,
      planned_duration: override.planned_duration ?? section.planned_duration,
    }
  })
}

export function applyTemplateOverrides(
  template: TemplateForEstimate,
  overrides: TemplateWeekOverride[],
): TemplateForEstimate {
  const override = overrides.find(o => o.section_id == null)
  if (!override) return template
  return {
    modality: template.modality,
    target_duration: override.duration ?? template.target_duration,
    planned_duration: override.planned_duration ?? template.planned_duration,
  }
}
