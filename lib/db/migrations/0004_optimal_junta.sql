PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_routine_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_item_id` integer NOT NULL,
	`log_date` text NOT NULL,
	`status` text NOT NULL,
	`value_weight` real,
	`value_length` real,
	`value_duration` real,
	`value_sets` integer,
	`value_reps` integer,
	`created_at` integer,
	FOREIGN KEY (`routine_item_id`) REFERENCES `routine_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_routine_logs`("id", "routine_item_id", "log_date", "status", "value_weight", "value_length", "value_duration", "value_sets", "value_reps", "created_at") SELECT "id", "routine_item_id", "log_date", "status", "value_weight", "value_length", "value_duration", "value_sets", "value_reps", "created_at" FROM `routine_logs`;--> statement-breakpoint
DROP TABLE `routine_logs`;--> statement-breakpoint
ALTER TABLE `__new_routine_logs` RENAME TO `routine_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `routine_logs_item_date_idx` ON `routine_logs` (`routine_item_id`,`log_date`);