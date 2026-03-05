CREATE TABLE `scheduled_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`task_type` text NOT NULL,
	`schedule` text NOT NULL,
	`workspace_id` text,
	`config` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`last_run_at` text,
	`last_run_status` text,
	`last_run_error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scheduled_tasks_enabled_idx` ON `scheduled_tasks` (`is_enabled`);
