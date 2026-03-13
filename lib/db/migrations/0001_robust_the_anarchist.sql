PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exercise_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`sets` integer NOT NULL,
	`reps` text NOT NULL,
	`weight` real,
	`rpe` real,
	`rest_seconds` integer,
	`guidelines` text,
	`order` integer NOT NULL,
	`is_main` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_exercise_slots`("id", "template_id", "exercise_id", "sets", "reps", "weight", "rpe", "rest_seconds", "guidelines", "order", "is_main", "created_at") SELECT "id", "template_id", "exercise_id", "sets", "reps", "weight", "rpe", "rest_seconds", "guidelines", "order", "is_main", "created_at" FROM `exercise_slots`;--> statement-breakpoint
DROP TABLE `exercise_slots`;--> statement-breakpoint
ALTER TABLE `__new_exercise_slots` RENAME TO `exercise_slots`;--> statement-breakpoint
PRAGMA foreign_keys=ON;