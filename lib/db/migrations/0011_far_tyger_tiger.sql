CREATE TABLE `slot_week_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exercise_slot_id` integer NOT NULL,
	`week_number` integer NOT NULL,
	`weight` real,
	`reps` text,
	`sets` integer,
	`rpe` real,
	`distance` real,
	`duration` integer,
	`pace` text,
	`is_deload` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`exercise_slot_id`) REFERENCES `exercise_slots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slot_week_overrides_slot_week_idx` ON `slot_week_overrides` (`exercise_slot_id`,`week_number`);
