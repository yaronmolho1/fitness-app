import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  exercises,
  mesocycles,
  workout_templates,
  exercise_slots,
  weekly_schedule,
  logged_workouts,
  logged_exercises,
  logged_sets,
} from '@/lib/db/schema'

type SeedExercise = { name: string; modality: string }

type SeedSlot = {
  exercise_name: string
  sets: number
  reps: string
  weight?: number
  rpe?: number
  rest_seconds?: number
  order: number
  is_main?: boolean
}

type SeedTemplate = {
  name: string
  canonical_name: string
  modality: 'resistance' | 'running' | 'mma' | 'mixed'
  notes?: string
  slots?: SeedSlot[]
}

type SeedScheduleEntry = {
  day_of_week: number
  template_name?: string // null = rest
  week_type?: 'normal' | 'deload'
  period?: 'morning' | 'afternoon' | 'evening'
}

type SeedLoggedWorkout = {
  template_name: string
  log_date: string
  rating?: number
  notes?: string
  exercises?: {
    exercise_name: string
    order: number
    actual_rpe?: number
    sets: { set_number: number; actual_reps?: number; actual_weight?: number }[]
  }[]
}

type SeedMesocycle = {
  name: string
  start_date: string
  end_date: string
  work_weeks: number
  has_deload?: boolean
  status?: 'planned' | 'active' | 'completed'
  templates?: SeedTemplate[]
  schedule?: SeedScheduleEntry[]
  logged_workouts?: SeedLoggedWorkout[]
}

type ResetBody = {
  seed?: SeedExercise[]
  mesocycle?: SeedMesocycle
}

function clearAllTables() {
  db.run(sql`DELETE FROM logged_sets`)
  db.run(sql`DELETE FROM logged_exercises`)
  db.run(sql`DELETE FROM logged_workouts`)
  db.run(sql`DELETE FROM exercise_slots`)
  db.run(sql`DELETE FROM weekly_schedule`)
  db.run(sql`DELETE FROM workout_templates`)
  db.run(sql`DELETE FROM mesocycles`)
  db.run(sql`DELETE FROM exercises`)
}

export async function POST(request: Request) {
  if (process.env.E2E_TEST !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  let body: ResetBody = {}
  try {
    body = await request.json()
  } catch {
    // no body = just reset
  }

  // Full reset only when seeding a mesocycle; otherwise just exercises
  if (body.mesocycle) {
    clearAllTables()
  } else {
    db.run(sql`DELETE FROM exercises`)
  }

  // Seed exercises
  const exerciseIdMap = new Map<string, number>()
  if (body.seed?.length) {
    for (const ex of body.seed) {
      const result = db.insert(exercises)
        .values({
          name: ex.name,
          modality: ex.modality as 'resistance' | 'running' | 'mma',
          created_at: new Date(),
        })
        .returning()
        .get()
      exerciseIdMap.set(ex.name, result.id)
    }
  }

  // Seed mesocycle with templates, slots, schedule
  if (body.mesocycle) {
    const meso = body.mesocycle
    const mesoResult = db.insert(mesocycles)
      .values({
        name: meso.name,
        start_date: meso.start_date,
        end_date: meso.end_date,
        work_weeks: meso.work_weeks,
        has_deload: meso.has_deload ?? false,
        status: meso.status ?? 'active',
        created_at: new Date(),
      })
      .returning()
      .get()

    const templateIdMap = new Map<string, number>()

    // Create templates and their exercise slots
    if (meso.templates) {
      for (const tmpl of meso.templates) {
        const tmplResult = db.insert(workout_templates)
          .values({
            mesocycle_id: mesoResult.id,
            name: tmpl.name,
            canonical_name: tmpl.canonical_name,
            modality: tmpl.modality,
            notes: tmpl.notes ?? null,
            created_at: new Date(),
          })
          .returning()
          .get()
        templateIdMap.set(tmpl.name, tmplResult.id)

        if (tmpl.slots) {
          for (const slot of tmpl.slots) {
            let exerciseId = exerciseIdMap.get(slot.exercise_name)
            // Auto-create exercise if not in seed list
            if (!exerciseId) {
              const exResult = db.insert(exercises)
                .values({
                  name: slot.exercise_name,
                  modality: 'resistance',
                  created_at: new Date(),
                })
                .returning()
                .get()
              exerciseId = exResult.id
              exerciseIdMap.set(slot.exercise_name, exerciseId)
            }

            db.insert(exercise_slots)
              .values({
                template_id: tmplResult.id,
                exercise_id: exerciseId,
                sets: slot.sets,
                reps: slot.reps,
                weight: slot.weight ?? null,
                rpe: slot.rpe ?? null,
                rest_seconds: slot.rest_seconds ?? null,
                order: slot.order,
                is_main: slot.is_main ?? false,
                created_at: new Date(),
              })
              .run()
          }
        }
      }
    }

    // Create weekly schedule
    if (meso.schedule) {
      for (const entry of meso.schedule) {
        const templateId = entry.template_name
          ? templateIdMap.get(entry.template_name) ?? null
          : null
        db.insert(weekly_schedule)
          .values({
            mesocycle_id: mesoResult.id,
            day_of_week: entry.day_of_week,
            template_id: templateId,
            week_type: entry.week_type ?? 'normal',
            period: entry.period ?? 'morning',
            created_at: new Date(),
          })
          .run()
      }
    }

    // Create logged workouts
    if (meso.logged_workouts) {
      for (const lw of meso.logged_workouts) {
        const templateId = templateIdMap.get(lw.template_name) ?? null
        const lwResult = db.insert(logged_workouts)
          .values({
            template_id: templateId,
            canonical_name: lw.template_name.toLowerCase().replace(/\s+/g, '-'),
            log_date: lw.log_date,
            logged_at: new Date(),
            rating: lw.rating ?? null,
            notes: lw.notes ?? null,
            template_snapshot: { version: 1, name: lw.template_name, modality: 'resistance' },
            created_at: new Date(),
          })
          .returning()
          .get()

        if (lw.exercises) {
          for (const ex of lw.exercises) {
            const leResult = db.insert(logged_exercises)
              .values({
                logged_workout_id: lwResult.id,
                exercise_id: exerciseIdMap.get(ex.exercise_name) ?? null,
                exercise_name: ex.exercise_name,
                order: ex.order,
                actual_rpe: ex.actual_rpe ?? null,
                created_at: new Date(),
              })
              .returning()
              .get()

            for (const set of ex.sets) {
              db.insert(logged_sets)
                .values({
                  logged_exercise_id: leResult.id,
                  set_number: set.set_number,
                  actual_reps: set.actual_reps ?? null,
                  actual_weight: set.actual_weight ?? null,
                  created_at: new Date(),
                })
                .run()
            }
          }
        }
      }
    }
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/exercises')

  const count = db.select().from(exercises).all().length
  return NextResponse.json({ success: true, exerciseCount: count })
}
