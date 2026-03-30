import {
  integer,
  real,
  text,
  sqliteTable,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

// ============================================================================
// PLANNING LAYER (6 tables)
// ============================================================================

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  modality: text('modality', {
    enum: ['resistance', 'running', 'mma'],
  }).notNull(),
  muscle_group: text('muscle_group'),
  equipment: text('equipment'),
  created_at: integer('created_at', { mode: 'timestamp' }),
})

export const mesocycles = sqliteTable('mesocycles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  start_date: text('start_date').notNull(), // YYYY-MM-DD
  end_date: text('end_date').notNull(), // YYYY-MM-DD
  work_weeks: integer('work_weeks').notNull(),
  has_deload: integer('has_deload', { mode: 'boolean' })
    .notNull()
    .default(false),
  status: text('status', {
    enum: ['planned', 'active', 'completed'],
  })
    .notNull()
    .default('planned'),
  created_at: integer('created_at', { mode: 'timestamp' }),
})

export const workout_templates = sqliteTable('workout_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mesocycle_id: integer('mesocycle_id')
    .notNull()
    .references(() => mesocycles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  canonical_name: text('canonical_name').notNull(),
  modality: text('modality', {
    enum: ['resistance', 'running', 'mma', 'mixed'],
  }).notNull(),
  notes: text('notes'),
  // Running-specific fields (null for non-running templates)
  run_type: text('run_type', {
    enum: ['easy', 'tempo', 'interval', 'long', 'race'],
  }),
  target_pace: text('target_pace'),
  hr_zone: integer('hr_zone'),
  interval_count: integer('interval_count'),
  interval_rest: integer('interval_rest'),
  coaching_cues: text('coaching_cues'),
  target_distance: real('target_distance'), // km, nullable
  target_duration: integer('target_duration'), // minutes, nullable
  target_elevation_gain: integer('target_elevation_gain'), // meters, nullable
  // MMA/BJJ-specific (null for non-mma templates)
  planned_duration: integer('planned_duration'),
  estimated_duration: integer('estimated_duration'), // minutes, nullable — computed from modality
  created_at: integer('created_at', { mode: 'timestamp' }),
})

export const template_sections = sqliteTable('template_sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  template_id: integer('template_id')
    .notNull()
    .references(() => workout_templates.id, { onDelete: 'cascade' }),
  modality: text('modality', {
    enum: ['resistance', 'running', 'mma'],
  }).notNull(),
  section_name: text('section_name').notNull(),
  order: integer('order').notNull(),
  // Running-specific fields
  run_type: text('run_type', {
    enum: ['easy', 'tempo', 'interval', 'long', 'race'],
  }),
  target_pace: text('target_pace'),
  hr_zone: integer('hr_zone'),
  interval_count: integer('interval_count'),
  interval_rest: integer('interval_rest'),
  coaching_cues: text('coaching_cues'),
  target_distance: real('target_distance'), // km, nullable
  target_duration: integer('target_duration'), // minutes, nullable
  target_elevation_gain: integer('target_elevation_gain'), // meters, nullable
  // MMA-specific
  planned_duration: integer('planned_duration'),
  created_at: integer('created_at', { mode: 'timestamp' }),
})

export const exercise_slots = sqliteTable('exercise_slots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  template_id: integer('template_id')
    .notNull()
    .references(() => workout_templates.id, { onDelete: 'cascade' }),
  exercise_id: integer('exercise_id')
    .notNull()
    .references(() => exercises.id), // NO cascade
  section_id: integer('section_id').references(() => template_sections.id), // nullable for backward compat
  sets: integer('sets').notNull(),
  reps: text('reps').notNull(),
  weight: real('weight'),
  rpe: real('rpe'),
  rest_seconds: integer('rest_seconds'),
  duration: integer('duration'), // seconds, nullable — alternative to reps for isometric exercises
  group_id: integer('group_id'), // superset grouping, nullable
  group_rest_seconds: integer('group_rest_seconds'), // rest after full superset round, nullable
  guidelines: text('guidelines'),
  order: integer('order').notNull(),
  is_main: integer('is_main', { mode: 'boolean' })
    .notNull()
    .default(false),
  created_at: integer('created_at', { mode: 'timestamp' }),
})

export const slot_week_overrides = sqliteTable(
  'slot_week_overrides',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    exercise_slot_id: integer('exercise_slot_id')
      .notNull()
      .references(() => exercise_slots.id, { onDelete: 'cascade' }),
    week_number: integer('week_number').notNull(),
    weight: real('weight'),
    reps: text('reps'),
    sets: integer('sets'),
    rpe: real('rpe'),
    distance: real('distance'),
    duration: integer('duration'),
    pace: text('pace'),
    elevation_gain: integer('elevation_gain'), // meters, nullable
    is_deload: integer('is_deload').notNull().default(0),
    created_at: integer('created_at', { mode: 'timestamp' }),
  },
  (t) => ({
    uniq: uniqueIndex('slot_week_overrides_slot_week_idx').on(
      t.exercise_slot_id,
      t.week_number
    ),
  })
)

export const template_week_overrides = sqliteTable(
  'template_week_overrides',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    template_id: integer('template_id')
      .notNull()
      .references(() => workout_templates.id, { onDelete: 'cascade' }),
    section_id: integer('section_id')
      .references(() => template_sections.id, { onDelete: 'cascade' }),
    week_number: integer('week_number').notNull(),
    distance: real('distance'),
    duration: integer('duration'),
    pace: text('pace'),
    planned_duration: integer('planned_duration'),
    interval_count: integer('interval_count'),
    interval_rest: integer('interval_rest'),
    elevation_gain: integer('elevation_gain'), // meters, nullable
    is_deload: integer('is_deload').notNull().default(0),
    created_at: integer('created_at', { mode: 'timestamp' }),
  },
  (t) => ({
    uniq: uniqueIndex('template_week_overrides_tmpl_sec_week_idx').on(
      t.template_id,
      t.section_id,
      t.week_number
    ),
  })
)

export const weekly_schedule = sqliteTable(
  'weekly_schedule',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mesocycle_id: integer('mesocycle_id')
      .notNull()
      .references(() => mesocycles.id, { onDelete: 'cascade' }),
    day_of_week: integer('day_of_week').notNull(), // 0-6
    template_id: integer('template_id').references(
      () => workout_templates.id
    ), // nullable = rest day
    week_type: text('week_type', {
      enum: ['normal', 'deload'],
    })
      .notNull()
      .default('normal'),
    period: text('period', {
      enum: ['morning', 'afternoon', 'evening'],
    })
      .notNull()
      .default('morning'),
    time_slot: text('time_slot').notNull().default('07:00'), // "HH:MM" format
    duration: integer('duration').notNull().default(90), // minutes
    created_at: integer('created_at', { mode: 'timestamp' }),
  },
  (t) => ({
    uniq: uniqueIndex('weekly_schedule_meso_day_type_timeslot_template_idx').on(
      t.mesocycle_id,
      t.day_of_week,
      t.week_type,
      t.time_slot,
      t.template_id
    ),
  })
)

export const routine_items = sqliteTable('routine_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category'),
  has_weight: integer('has_weight', { mode: 'boolean' })
    .notNull()
    .default(false),
  has_length: integer('has_length', { mode: 'boolean' })
    .notNull()
    .default(false),
  has_duration: integer('has_duration', { mode: 'boolean' })
    .notNull()
    .default(false),
  has_sets: integer('has_sets', { mode: 'boolean' })
    .notNull()
    .default(false),
  has_reps: integer('has_reps', { mode: 'boolean' })
    .notNull()
    .default(false),
  frequency_target: integer('frequency_target').notNull(),
  scope: text('scope', {
    enum: ['global', 'mesocycle', 'date_range'],
  }).notNull(),
  mesocycle_id: integer('mesocycle_id').references(() => mesocycles.id), // nullable
  start_date: text('start_date'), // nullable, YYYY-MM-DD
  end_date: text('end_date'), // nullable, YYYY-MM-DD
  skip_on_deload: integer('skip_on_deload', { mode: 'boolean' })
    .notNull()
    .default(false),
  frequency_mode: text('frequency_mode', {
    enum: ['daily', 'specific_days', 'weekly_target'],
  })
    .notNull()
    .default('weekly_target'),
  frequency_days: text('frequency_days', { mode: 'json' }).$type<number[]>(),
  created_at: integer('created_at', { mode: 'timestamp' }),
})

export const schedule_week_overrides = sqliteTable(
  'schedule_week_overrides',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mesocycle_id: integer('mesocycle_id')
      .notNull()
      .references(() => mesocycles.id, { onDelete: 'cascade' }),
    week_number: integer('week_number').notNull(),
    day_of_week: integer('day_of_week').notNull(), // 0-6
    period: text('period', {
      enum: ['morning', 'afternoon', 'evening'],
    }).notNull(),
    template_id: integer('template_id').references(
      () => workout_templates.id
    ), // nullable — null = rest/removed
    time_slot: text('time_slot').notNull().default('07:00'), // "HH:MM" format
    duration: integer('duration').notNull().default(90), // minutes
    override_group: text('override_group').notNull(),
    created_at: integer('created_at', { mode: 'timestamp' }),
  },
  (t) => ({
    uniq: uniqueIndex('schedule_week_overrides_meso_week_day_timeslot_template_idx').on(
      t.mesocycle_id,
      t.week_number,
      t.day_of_week,
      t.time_slot,
      t.template_id
    ),
  })
)

// ============================================================================
// PROFILE LAYER (1 table) — single-row athlete profile
// ============================================================================

export const athlete_profile = sqliteTable('athlete_profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  age: integer('age'),
  weight_kg: real('weight_kg'),
  height_cm: real('height_cm'),
  gender: text('gender'),
  training_age_years: integer('training_age_years'),
  primary_goal: text('primary_goal'),
  injury_history: text('injury_history'),
  athletic_background: text('athletic_background'),
  timezone: text('timezone').notNull().default('UTC'),
  created_at: integer('created_at', { mode: 'timestamp' }),
  updated_at: integer('updated_at', { mode: 'timestamp' }),
})

// ============================================================================
// LOGGING LAYER (4 tables) — immutable snapshots
// ============================================================================

export const logged_workouts = sqliteTable('logged_workouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  template_id: integer('template_id'), // soft reference, NO FK constraint
  canonical_name: text('canonical_name'),
  log_date: text('log_date').notNull(), // YYYY-MM-DD
  logged_at: integer('logged_at', { mode: 'timestamp' }).notNull(),
  rating: integer('rating'),
  notes: text('notes'),
  template_snapshot: text('template_snapshot', { mode: 'json' }).$type<{
    version: number
    [key: string]: unknown
  }>().notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }),
})

export const logged_exercises = sqliteTable('logged_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  logged_workout_id: integer('logged_workout_id')
    .notNull()
    .references(() => logged_workouts.id, { onDelete: 'cascade' }),
  exercise_id: integer('exercise_id'), // soft reference, NO FK constraint
  exercise_name: text('exercise_name').notNull(),
  order: integer('order').notNull(),
  actual_rpe: real('actual_rpe'),
  created_at: integer('created_at', { mode: 'timestamp' }),
})

export const logged_sets = sqliteTable('logged_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  logged_exercise_id: integer('logged_exercise_id')
    .notNull()
    .references(() => logged_exercises.id, { onDelete: 'cascade' }),
  set_number: integer('set_number').notNull(),
  actual_reps: integer('actual_reps'),
  actual_weight: real('actual_weight'),
  created_at: integer('created_at', { mode: 'timestamp' }),
})

export const routine_logs = sqliteTable(
  'routine_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routine_item_id: integer('routine_item_id')
      .notNull()
      .references(() => routine_items.id, { onDelete: 'restrict' }),
    log_date: text('log_date').notNull(), // YYYY-MM-DD
    status: text('status', { enum: ['done', 'skipped'] }).notNull(),
    value_weight: real('value_weight'),
    value_length: real('value_length'),
    value_duration: real('value_duration'),
    value_sets: integer('value_sets'),
    value_reps: integer('value_reps'),
    created_at: integer('created_at', { mode: 'timestamp' }),
  },
  (t) => ({
    uniq: uniqueIndex('routine_logs_item_date_idx').on(
      t.routine_item_id,
      t.log_date
    ),
  })
)

// ============================================================================
// GOOGLE CALENDAR INTEGRATION (2 tables)
// ============================================================================

export const google_credentials = sqliteTable('google_credentials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token').notNull(),
  token_type: text('token_type').notNull().default('Bearer'),
  expiry_date: integer('expiry_date', { mode: 'timestamp' }).notNull(),
  scope: text('scope'),
  calendar_id: text('calendar_id'), // selected calendar for syncing
  created_at: integer('created_at', { mode: 'timestamp' }),
  updated_at: integer('updated_at', { mode: 'timestamp' }),
})

export const google_calendar_events = sqliteTable(
  'google_calendar_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    google_event_id: text('google_event_id').notNull(),
    mesocycle_id: integer('mesocycle_id')
      .notNull()
      .references(() => mesocycles.id, { onDelete: 'cascade' }),
    schedule_entry_id: integer('schedule_entry_id'), // weekly_schedule.id, nullable
    override_entry_id: integer('override_entry_id'), // schedule_week_overrides.id, nullable
    event_date: text('event_date').notNull(), // YYYY-MM-DD
    summary: text('summary').notNull(),
    start_time: text('start_time').notNull(), // HH:MM
    end_time: text('end_time').notNull(), // HH:MM
    sync_status: text('sync_status', {
      enum: ['synced', 'pending', 'error'],
    })
      .notNull()
      .default('pending'),
    last_synced_at: integer('last_synced_at', { mode: 'timestamp' }),
    created_at: integer('created_at', { mode: 'timestamp' }),
    updated_at: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => ({
    uniqGoogleEvent: uniqueIndex('google_calendar_events_google_event_id_idx').on(
      t.google_event_id
    ),
    uniqScheduleDate: uniqueIndex('google_calendar_events_schedule_date_idx').on(
      t.schedule_entry_id,
      t.event_date
    ),
  })
)
