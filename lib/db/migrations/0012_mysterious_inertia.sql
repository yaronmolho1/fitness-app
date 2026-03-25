CREATE TABLE `athlete_profile` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`age` integer,
	`weight_kg` real,
	`height_cm` real,
	`gender` text,
	`training_age_years` integer,
	`primary_goal` text,
	`injury_history` text,
	`created_at` integer,
	`updated_at` integer
);
