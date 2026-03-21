ALTER TABLE `exercise_slots` ADD `group_id` integer;--> statement-breakpoint
ALTER TABLE `exercise_slots` ADD `group_rest_seconds` integer;--> statement-breakpoint
ALTER TABLE `template_sections` ADD `target_distance` real;--> statement-breakpoint
ALTER TABLE `template_sections` ADD `target_duration` integer;--> statement-breakpoint
ALTER TABLE `workout_templates` ADD `target_distance` real;--> statement-breakpoint
ALTER TABLE `workout_templates` ADD `target_duration` integer;