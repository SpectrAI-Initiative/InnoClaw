CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`system_prompt` text NOT NULL,
	`steps` text,
	`allowed_tools` text,
	`parameters` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `skills_slug_workspace_id_unique`
	ON `skills`(`slug`, `workspace_id`)
	WHERE `workspace_id` IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS `skills_slug_global_unique`
	ON `skills`(`slug`)
	WHERE `workspace_id` IS NULL;
