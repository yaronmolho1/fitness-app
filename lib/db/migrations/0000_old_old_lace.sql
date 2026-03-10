CREATE TABLE `exercise_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`sets` integer,
	`reps` text,
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
CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`modality` text NOT NULL,
	`muscle_group` text,
	`equipment` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_name_unique` ON `exercises` (`name`);--> statement-breakpoint
CREATE TABLE `logged_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`logged_workout_id` integer NOT NULL,
	`exercise_id` integer,
	`exercise_name` text NOT NULL,
	`order` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`logged_workout_id`) REFERENCES `logged_workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `logged_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`logged_exercise_id` integer NOT NULL,
	`set_number` integer NOT NULL,
	`actual_reps` integer,
	`actual_weight` real,
	`actual_rpe` real,
	`created_at` integer,
	FOREIGN KEY (`logged_exercise_id`) REFERENCES `logged_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `logged_workouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer,
	`canonical_name` text,
	`logged_at` integer NOT NULL,
	`rating` integer,
	`notes` text,
	`template_snapshot` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `mesocycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`work_weeks` integer NOT NULL,
	`has_deload` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `routine_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`has_weight` integer DEFAULT false NOT NULL,
	`has_length` integer DEFAULT false NOT NULL,
	`has_duration` integer DEFAULT false NOT NULL,
	`has_sets` integer DEFAULT false NOT NULL,
	`has_reps` integer DEFAULT false NOT NULL,
	`frequency_target` integer NOT NULL,
	`scope` text NOT NULL,
	`mesocycle_id` integer,
	`start_date` text,
	`end_date` text,
	`skip_on_deload` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`mesocycle_id`) REFERENCES `mesocycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `routine_logs` (
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
	FOREIGN KEY (`routine_item_id`) REFERENCES `routine_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_logs_item_date_idx` ON `routine_logs` (`routine_item_id`,`log_date`);--> statement-breakpoint
CREATE TABLE `weekly_schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mesocycle_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`template_id` integer,
	`week_type` text DEFAULT 'normal' NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`mesocycle_id`) REFERENCES `mesocycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_schedule_meso_day_type_idx` ON `weekly_schedule` (`mesocycle_id`,`day_of_week`,`week_type`);--> statement-breakpoint
CREATE TABLE `workout_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mesocycle_id` integer NOT NULL,
	`name` text NOT NULL,
	`canonical_name` text NOT NULL,
	`modality` text NOT NULL,
	`notes` text,
	`created_at` integer,
	FOREIGN KEY (`mesocycle_id`) REFERENCES `mesocycles`(`id`) ON UPDATE no action ON DELETE cascade
);
