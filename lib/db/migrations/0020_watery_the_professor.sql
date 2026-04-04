PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mesocycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`work_weeks` integer NOT NULL,
	`has_deload` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_mesocycles`("id", "name", "start_date", "end_date", "work_weeks", "has_deload", "status", "created_at") SELECT "id", "name", "start_date", "end_date", "work_weeks", "has_deload", "status", "created_at" FROM `mesocycles`;--> statement-breakpoint
DROP TABLE `mesocycles`;--> statement-breakpoint
ALTER TABLE `__new_mesocycles` RENAME TO `mesocycles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;