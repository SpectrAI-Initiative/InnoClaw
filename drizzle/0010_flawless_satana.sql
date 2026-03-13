ALTER TABLE `experiment_runs` ADD `monitoring_config_json` text;--> statement-breakpoint
ALTER TABLE `experiment_runs` ADD `last_polled_at` text;--> statement-breakpoint
ALTER TABLE `experiment_runs` ADD `status_snapshot_json` text;--> statement-breakpoint
ALTER TABLE `experiment_runs` ADD `collect_approved_at` text;--> statement-breakpoint
ALTER TABLE `remote_profiles` ADD `poll_interval_seconds` integer DEFAULT 60 NOT NULL;