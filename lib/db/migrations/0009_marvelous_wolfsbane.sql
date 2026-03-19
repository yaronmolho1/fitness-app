ALTER TABLE `routine_items` ADD `frequency_mode` text DEFAULT 'weekly_target' NOT NULL;--> statement-breakpoint
ALTER TABLE `routine_items` ADD `frequency_days` text;