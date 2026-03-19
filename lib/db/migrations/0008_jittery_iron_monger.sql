DROP INDEX `weekly_schedule_meso_day_type_idx`;--> statement-breakpoint
ALTER TABLE `weekly_schedule` ADD `period` text DEFAULT 'morning' NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_schedule` ADD `time_slot` text;--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_schedule_meso_day_type_period_idx` ON `weekly_schedule` (`mesocycle_id`,`day_of_week`,`week_type`,`period`);