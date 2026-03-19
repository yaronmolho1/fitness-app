# Mixed-Modality Templates
**Status:** planned
**Epic:** Template System
**Depends:** specs/create-resistance-templates.md, specs/running-templates.md, specs/mma-bjj-template-support.md

## Description
Support workout templates containing multiple modalities (e.g., resistance + running) as ordered sections within a single template, enabling combined sessions like strength + conditioning finishers.

## Acceptance Criteria

### Schema: template_sections table
- [ ] New `template_sections` table with columns: `id` (integer PK), `template_id` (FK → workout_templates, CASCADE delete), `modality` (text, enum: 'resistance' | 'running' | 'mma'), `section_name` (text, NOT NULL), `order` (integer, NOT NULL), `created_at` (timestamp)
- [ ] Running section fields: `run_type`, `target_pace`, `hr_zone`, `interval_count`, `interval_rest`, `coaching_cues` stored on the section row (not on workout_templates for mixed)
- [ ] MMA section fields: `planned_duration` stored on the section row
- [ ] `exercise_slots` gains optional `section_id` FK → template_sections (nullable for backward compat with pure resistance templates)
- [ ] Modality enum on `workout_templates` extended with `'mixed'`
- [ ] Migration generated via `drizzle-kit generate`

### Mixed template creation
- [ ] A 4th button "+ Mixed Workout" appears in the template creation section alongside Resistance, Running, MMA/BJJ
- [ ] Clicking opens a form to name the template
- [ ] After naming, a "Add Section" button allows adding ordered sections
- [ ] Each section requires: name (e.g., "Main Lift", "Cooldown Run"), modality selection
- [ ] Resistance sections then allow adding exercise slots (reuses existing slot editor)
- [ ] Running sections show running-specific fields (run_type, pace, HR, intervals, cues)
- [ ] MMA sections show planned_duration field
- [ ] Sections are drag-reorderable
- [ ] At least 2 sections required to save a mixed template (otherwise use a single-modality template)
- [ ] Mixed templates must contain at least 2 different modalities

### Display on Today page
- [ ] Mixed workouts render sections in order, each with a section header showing name + modality badge
- [ ] Resistance sections render exercise slots with all targets
- [ ] Running sections render run plan details
- [ ] MMA sections render duration target
- [ ] Visual separator between sections

### Logging mixed workouts
- [ ] Logging form renders section-by-section, each with modality-specific inputs
- [ ] Resistance sections: pre-filled sets/reps/weight per exercise (existing logging form, embedded)
- [ ] Running sections: distance, pace, HR inputs (existing running logging form, embedded)
- [ ] MMA sections: duration, feeling inputs (existing MMA logging form, embedded)
- [ ] A single "Save Workout" button saves all sections atomically
- [ ] Template snapshot includes all sections with their modality-specific data
- [ ] `logged_workouts` entry has modality='mixed' and snapshot version bumped to 2

### Backward compatibility
- [ ] Existing single-modality templates continue to work unchanged
- [ ] `exercise_slots` with null `section_id` behave as before (pure resistance templates)
- [ ] Calendar, progression, and schedule grid handle mixed templates correctly
- [ ] Clone mesocycle copies template_sections and their associated slots/fields

### Schedule & Calendar
- [ ] Mixed templates are assignable to schedule days like any other template
- [ ] Calendar displays mixed templates with a combined modality badge (e.g., multi-colored dot)
- [ ] Canonical name for mixed templates works the same as single-modality

## Edge Cases
- Converting existing single-modality template to mixed: not supported in V1 (create new mixed template instead)
- Mixed template with only 1 section: validation error, must have 2+ with different modalities
- Cascade edits on mixed templates: name cascade works; section-level cascade follows slot cascade rules per section
- Deleting a section from a mixed template: if only 1 remains, prompt to convert to single-modality or add another

## Test Requirements
- Schema migration creates template_sections with correct FKs and constraints
- Mixed template creation validates 2+ sections with different modalities
- Today page renders all sections in correct order
- Logging saves all section data atomically
- Snapshot includes section structure (version 2)
- Clone preserves sections, their order, and all modality-specific fields
- Existing single-modality templates unaffected by migration
- Calendar/schedule correctly display mixed templates
