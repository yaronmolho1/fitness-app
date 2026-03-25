CREATE TABLE `template_week_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`section_id` integer,
	`week_number` integer NOT NULL,
	`distance` real,
	`duration` integer,
	`pace` text,
	`planned_duration` integer,
	`is_deload` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `template_sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_week_overrides_tmpl_sec_week_idx` ON `template_week_overrides` (`template_id`,`section_id`,`week_number`);