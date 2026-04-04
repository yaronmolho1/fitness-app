DROP INDEX `weekly_schedule_meso_day_type_timeslot_template_idx`;--> statement-breakpoint
ALTER TABLE `weekly_schedule` ADD `cycle_length` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_schedule` ADD `cycle_position` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_schedule_meso_day_type_timeslot_position_idx` ON `weekly_schedule` (`mesocycle_id`,`day_of_week`,`week_type`,`time_slot`,`cycle_position`);--> statement-breakpoint
ALTER TABLE `google_calendar_events` DROP COLUMN `override_entry_id`;