-- T197: Time scheduling migration (3-phase)
-- Phase 1: Add new columns and tables
-- Phase 2: Backfill time_slot and duration
-- Phase 3: Table recreation with NOT NULL constraints + new indexes

-- ============================================================================
-- PHASE 1: Add new columns and create new tables
-- ============================================================================

-- New tables for Google Calendar integration
CREATE TABLE `google_calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`google_event_id` text NOT NULL,
	`mesocycle_id` integer NOT NULL,
	`schedule_entry_id` integer,
	`override_entry_id` integer,
	`event_date` text NOT NULL,
	`summary` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`last_synced_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`mesocycle_id`) REFERENCES `mesocycles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_calendar_events_google_event_id_idx` ON `google_calendar_events` (`google_event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `google_calendar_events_schedule_date_idx` ON `google_calendar_events` (`schedule_entry_id`,`event_date`);--> statement-breakpoint
CREATE TABLE `google_credentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`token_type` text DEFAULT 'Bearer' NOT NULL,
	`expiry_date` integer NOT NULL,
	`scope` text,
	`calendar_id` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
-- New columns on existing tables
ALTER TABLE `athlete_profile` ADD `timezone` text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_templates` ADD `estimated_duration` integer;--> statement-breakpoint

-- Add duration column (nullable) to schedule tables before backfill
ALTER TABLE `weekly_schedule` ADD `duration` integer;--> statement-breakpoint
ALTER TABLE `schedule_week_overrides` ADD `duration` integer;--> statement-breakpoint

-- ============================================================================
-- PHASE 2: Backfill time_slot from period and duration from template modality
-- ============================================================================

-- Backfill time_slot on weekly_schedule where null
UPDATE `weekly_schedule` SET `time_slot` = '07:00' WHERE `time_slot` IS NULL AND `period` = 'morning';--> statement-breakpoint
UPDATE `weekly_schedule` SET `time_slot` = '13:00' WHERE `time_slot` IS NULL AND `period` = 'afternoon';--> statement-breakpoint
UPDATE `weekly_schedule` SET `time_slot` = '18:00' WHERE `time_slot` IS NULL AND `period` = 'evening';--> statement-breakpoint

-- Backfill time_slot on schedule_week_overrides where null
UPDATE `schedule_week_overrides` SET `time_slot` = '07:00' WHERE `time_slot` IS NULL AND `period` = 'morning';--> statement-breakpoint
UPDATE `schedule_week_overrides` SET `time_slot` = '13:00' WHERE `time_slot` IS NULL AND `period` = 'afternoon';--> statement-breakpoint
UPDATE `schedule_week_overrides` SET `time_slot` = '18:00' WHERE `time_slot` IS NULL AND `period` = 'evening';--> statement-breakpoint

-- Backfill duration on weekly_schedule: resistance/mixed -> 90, running -> target_duration or 60, mma -> planned_duration or 90, null template -> 60
UPDATE `weekly_schedule` SET `duration` = 90
  WHERE `template_id` IS NOT NULL AND `template_id` IN (
    SELECT `id` FROM `workout_templates` WHERE `modality` IN ('resistance', 'mixed')
  );--> statement-breakpoint
UPDATE `weekly_schedule` SET `duration` = COALESCE(
    (SELECT `target_duration` FROM `workout_templates` WHERE `workout_templates`.`id` = `weekly_schedule`.`template_id`),
    60
  )
  WHERE `template_id` IS NOT NULL AND `template_id` IN (
    SELECT `id` FROM `workout_templates` WHERE `modality` = 'running'
  );--> statement-breakpoint
UPDATE `weekly_schedule` SET `duration` = COALESCE(
    (SELECT `planned_duration` FROM `workout_templates` WHERE `workout_templates`.`id` = `weekly_schedule`.`template_id`),
    90
  )
  WHERE `template_id` IS NOT NULL AND `template_id` IN (
    SELECT `id` FROM `workout_templates` WHERE `modality` = 'mma'
  );--> statement-breakpoint
UPDATE `weekly_schedule` SET `duration` = 60 WHERE `template_id` IS NULL;--> statement-breakpoint

-- Backfill duration on schedule_week_overrides: same rules
UPDATE `schedule_week_overrides` SET `duration` = 90
  WHERE `template_id` IS NOT NULL AND `template_id` IN (
    SELECT `id` FROM `workout_templates` WHERE `modality` IN ('resistance', 'mixed')
  );--> statement-breakpoint
UPDATE `schedule_week_overrides` SET `duration` = COALESCE(
    (SELECT `target_duration` FROM `workout_templates` WHERE `workout_templates`.`id` = `schedule_week_overrides`.`template_id`),
    60
  )
  WHERE `template_id` IS NOT NULL AND `template_id` IN (
    SELECT `id` FROM `workout_templates` WHERE `modality` = 'running'
  );--> statement-breakpoint
UPDATE `schedule_week_overrides` SET `duration` = COALESCE(
    (SELECT `planned_duration` FROM `workout_templates` WHERE `workout_templates`.`id` = `schedule_week_overrides`.`template_id`),
    90
  )
  WHERE `template_id` IS NOT NULL AND `template_id` IN (
    SELECT `id` FROM `workout_templates` WHERE `modality` = 'mma'
  );--> statement-breakpoint
UPDATE `schedule_week_overrides` SET `duration` = 60 WHERE `template_id` IS NULL;--> statement-breakpoint

-- ============================================================================
-- PHASE 3: Table recreation with NOT NULL constraints + new unique indexes
-- ============================================================================

PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- Recreate schedule_week_overrides with NOT NULL + defaults on time_slot and duration
CREATE TABLE `__new_schedule_week_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mesocycle_id` integer NOT NULL,
	`week_number` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`period` text NOT NULL,
	`template_id` integer,
	`time_slot` text DEFAULT '07:00' NOT NULL,
	`duration` integer DEFAULT 90 NOT NULL,
	`override_group` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`mesocycle_id`) REFERENCES `mesocycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_schedule_week_overrides`("id", "mesocycle_id", "week_number", "day_of_week", "period", "template_id", "time_slot", "duration", "override_group", "created_at") SELECT "id", "mesocycle_id", "week_number", "day_of_week", "period", "template_id", "time_slot", "duration", "override_group", "created_at" FROM `schedule_week_overrides`;--> statement-breakpoint
DROP TABLE `schedule_week_overrides`;--> statement-breakpoint
ALTER TABLE `__new_schedule_week_overrides` RENAME TO `schedule_week_overrides`;--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_week_overrides_meso_week_day_timeslot_template_idx` ON `schedule_week_overrides` (`mesocycle_id`,`week_number`,`day_of_week`,`time_slot`,`template_id`);--> statement-breakpoint

-- Recreate weekly_schedule with NOT NULL + defaults on time_slot and duration
CREATE TABLE `__new_weekly_schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mesocycle_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`template_id` integer,
	`week_type` text DEFAULT 'normal' NOT NULL,
	`period` text DEFAULT 'morning' NOT NULL,
	`time_slot` text DEFAULT '07:00' NOT NULL,
	`duration` integer DEFAULT 90 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`mesocycle_id`) REFERENCES `mesocycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_weekly_schedule`("id", "mesocycle_id", "day_of_week", "template_id", "week_type", "period", "time_slot", "duration", "created_at") SELECT "id", "mesocycle_id", "day_of_week", "template_id", "week_type", "period", "time_slot", "duration", "created_at" FROM `weekly_schedule`;--> statement-breakpoint
DROP TABLE `weekly_schedule`;--> statement-breakpoint
ALTER TABLE `__new_weekly_schedule` RENAME TO `weekly_schedule`;--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_schedule_meso_day_type_timeslot_template_idx` ON `weekly_schedule` (`mesocycle_id`,`day_of_week`,`week_type`,`time_slot`,`template_id`);--> statement-breakpoint

PRAGMA foreign_keys=ON;
