import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { exercise_slots, exercises } from '@/lib/db/schema'

export type SlotWithExercise = typeof exercise_slots.$inferSelect & {
  exercise_name: string
}

export function getSlotsByTemplate(templateId: number): SlotWithExercise[] {
  const rows = db
    .select({
      id: exercise_slots.id,
      template_id: exercise_slots.template_id,
      exercise_id: exercise_slots.exercise_id,
      section_id: exercise_slots.section_id,
      sets: exercise_slots.sets,
      reps: exercise_slots.reps,
      weight: exercise_slots.weight,
      rpe: exercise_slots.rpe,
      rest_seconds: exercise_slots.rest_seconds,
      group_id: exercise_slots.group_id,
      group_rest_seconds: exercise_slots.group_rest_seconds,
      guidelines: exercise_slots.guidelines,
      order: exercise_slots.order,
      is_main: exercise_slots.is_main,
      created_at: exercise_slots.created_at,
      exercise_name: exercises.name,
    })
    .from(exercise_slots)
    .innerJoin(exercises, eq(exercise_slots.exercise_id, exercises.id))
    .where(eq(exercise_slots.template_id, templateId))
    .orderBy(asc(exercise_slots.order))
    .all()

  return rows
}
