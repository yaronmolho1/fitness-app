CREATE TABLE `schedule_week_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mesocycle_id` integer NOT NULL,
	`week_number` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`period` text NOT NULL,
	`template_id` integer,
	`time_slot` text,
	`override_group` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`mesocycle_id`) REFERENCES `mesocycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_week_overrides_meso_week_day_period_idx` ON `schedule_week_overrides` (`mesocycle_id`,`week_number`,`day_of_week`,`period`);