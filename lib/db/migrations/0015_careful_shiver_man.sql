ALTER TABLE `slot_week_overrides` ADD `elevation_gain` integer;--> statement-breakpoint
ALTER TABLE `template_sections` ADD `target_elevation_gain` integer;--> statement-breakpoint
ALTER TABLE `template_week_overrides` ADD `elevation_gain` integer;--> statement-breakpoint
ALTER TABLE `workout_templates` ADD `target_elevation_gain` integer;