CREATE TABLE `template_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`modality` text NOT NULL,
	`section_name` text NOT NULL,
	`order` integer NOT NULL,
	`run_type` text,
	`target_pace` text,
	`hr_zone` integer,
	`interval_count` integer,
	`interval_rest` integer,
	`coaching_cues` text,
	`planned_duration` integer,
	`created_at` integer,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `exercise_slots` ADD `section_id` integer REFERENCES template_sections(id);