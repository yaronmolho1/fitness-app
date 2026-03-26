import { relations } from 'drizzle-orm'
import {
  mesocycles,
  workout_templates,
  template_sections,
  weekly_schedule,
  routine_items,
  exercise_slots,
  slot_week_overrides,
  template_week_overrides,
  schedule_week_overrides,
  exercises,
  logged_workouts,
  logged_exercises,
  logged_sets,
  routine_logs,
} from './schema'

export const mesocyclesRelations = relations(mesocycles, ({ many }) => ({
  workout_templates: many(workout_templates),
  weekly_schedule: many(weekly_schedule),
  routine_items: many(routine_items),
  schedule_week_overrides: many(schedule_week_overrides),
}))

export const workout_templatesRelations = relations(
  workout_templates,
  ({ many, one }) => ({
    exercise_slots: many(exercise_slots),
    template_sections: many(template_sections),
    template_week_overrides: many(template_week_overrides),
    mesocycle: one(mesocycles, {
      fields: [workout_templates.mesocycle_id],
      references: [mesocycles.id],
    }),
  })
)

export const template_sectionsRelations = relations(
  template_sections,
  ({ many, one }) => ({
    template: one(workout_templates, {
      fields: [template_sections.template_id],
      references: [workout_templates.id],
    }),
    exercise_slots: many(exercise_slots),
    template_week_overrides: many(template_week_overrides),
  })
)

export const exercise_slotsRelations = relations(
  exercise_slots,
  ({ one, many }) => ({
    template: one(workout_templates, {
      fields: [exercise_slots.template_id],
      references: [workout_templates.id],
    }),
    exercise: one(exercises, {
      fields: [exercise_slots.exercise_id],
      references: [exercises.id],
    }),
    section: one(template_sections, {
      fields: [exercise_slots.section_id],
      references: [template_sections.id],
    }),
    slot_week_overrides: many(slot_week_overrides),
  })
)

export const slot_week_overridesRelations = relations(
  slot_week_overrides,
  ({ one }) => ({
    exercise_slot: one(exercise_slots, {
      fields: [slot_week_overrides.exercise_slot_id],
      references: [exercise_slots.id],
    }),
  })
)

export const exercisesRelations = relations(exercises, ({ many }) => ({
  exercise_slots: many(exercise_slots),
}))

export const weekly_scheduleRelations = relations(
  weekly_schedule,
  ({ one }) => ({
    mesocycle: one(mesocycles, {
      fields: [weekly_schedule.mesocycle_id],
      references: [mesocycles.id],
    }),
    template: one(workout_templates, {
      fields: [weekly_schedule.template_id],
      references: [workout_templates.id],
    }),
  })
)

export const routine_itemsRelations = relations(
  routine_items,
  ({ many, one }) => ({
    routine_logs: many(routine_logs),
    mesocycle: one(mesocycles, {
      fields: [routine_items.mesocycle_id],
      references: [mesocycles.id],
    }),
  })
)

export const logged_workoutsRelations = relations(
  logged_workouts,
  ({ many }) => ({
    logged_exercises: many(logged_exercises),
  })
)

export const logged_exercisesRelations = relations(
  logged_exercises,
  ({ many, one }) => ({
    logged_sets: many(logged_sets),
    logged_workout: one(logged_workouts, {
      fields: [logged_exercises.logged_workout_id],
      references: [logged_workouts.id],
    }),
  })
)

export const logged_setsRelations = relations(logged_sets, ({ one }) => ({
  logged_exercise: one(logged_exercises, {
    fields: [logged_sets.logged_exercise_id],
    references: [logged_exercises.id],
  }),
}))

export const routine_logsRelations = relations(routine_logs, ({ one }) => ({
  routine_item: one(routine_items, {
    fields: [routine_logs.routine_item_id],
    references: [routine_items.id],
  }),
}))

export const schedule_week_overridesRelations = relations(
  schedule_week_overrides,
  ({ one }) => ({
    mesocycle: one(mesocycles, {
      fields: [schedule_week_overrides.mesocycle_id],
      references: [mesocycles.id],
    }),
    template: one(workout_templates, {
      fields: [schedule_week_overrides.template_id],
      references: [workout_templates.id],
    }),
  })
)

export const template_week_overridesRelations = relations(
  template_week_overrides,
  ({ one }) => ({
    template: one(workout_templates, {
      fields: [template_week_overrides.template_id],
      references: [workout_templates.id],
    }),
    section: one(template_sections, {
      fields: [template_week_overrides.section_id],
      references: [template_sections.id],
    }),
  })
)
