CREATE TABLE `hf_datasets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`repo_id` text NOT NULL,
	`repo_type` text DEFAULT 'dataset' NOT NULL,
	`revision` text,
	`source_config` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`local_path` text,
	`size_bytes` integer,
	`num_files` integer,
	`manifest` text,
	`stats` text,
	`last_sync_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
