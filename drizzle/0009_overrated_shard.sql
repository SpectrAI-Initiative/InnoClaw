CREATE TABLE `experiment_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`remote_profile_id` text,
	`status` text DEFAULT 'planning' NOT NULL,
	`manifest_json` text,
	`patch_summary` text,
	`sync_summary` text,
	`job_id` text,
	`result_summary_json` text,
	`recommendation_json` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`remote_profile_id`) REFERENCES `remote_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `experiment_runs_ws_idx` ON `experiment_runs` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `experiment_runs_status_idx` ON `experiment_runs` (`status`);--> statement-breakpoint
CREATE TABLE `remote_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`host` text NOT NULL,
	`port` integer DEFAULT 22 NOT NULL,
	`username` text NOT NULL,
	`remote_path` text NOT NULL,
	`scheduler_type` text DEFAULT 'shell' NOT NULL,
	`ssh_key_ref` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `remote_profiles_ws_idx` ON `remote_profiles` (`workspace_id`);--> statement-breakpoint
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