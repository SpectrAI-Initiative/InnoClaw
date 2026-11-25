-- Binary collation keeps equality and unique indexes exact, as they were in SQLite.
-- Applies to the connection's current database; tables below inherit it.
ALTER DATABASE CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin;--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` varchar(191) NOT NULL,
	`value` longtext NOT NULL,
	CONSTRAINT `app_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` varchar(191) NOT NULL,
	`workspace_id` varchar(191) NOT NULL,
	`role` varchar(64) NOT NULL,
	`content` longtext NOT NULL,
	`citations` longtext,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chunk_embeddings` (
	`chunk_id` varchar(191) NOT NULL,
	`embedding` mediumblob NOT NULL,
	CONSTRAINT `chunk_embeddings_chunk_id` PRIMARY KEY(`chunk_id`)
);
--> statement-breakpoint
CREATE TABLE `cluster_operations` (
	`id` varchar(191) NOT NULL,
	`workspace_id` varchar(191),
	`tool_name` longtext NOT NULL,
	`subcommand` longtext,
	`job_name` longtext,
	`namespace` longtext,
	`status` varchar(64) NOT NULL,
	`exit_code` int,
	`summary` longtext,
	`input_json` longtext,
	`output_json` longtext,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `cluster_operations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dataset_workspace_links` (
	`id` varchar(191) NOT NULL,
	`dataset_id` varchar(191) NOT NULL,
	`workspace_id` varchar(191) NOT NULL,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `dataset_workspace_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `dataset_workspace_unique_idx` UNIQUE(`dataset_id`,`workspace_id`)
);
--> statement-breakpoint
CREATE TABLE `deep_research_artifacts` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`node_id` varchar(191),
	`artifact_type` varchar(64) NOT NULL,
	`title` longtext NOT NULL,
	`content_json` longtext NOT NULL,
	`provenance_json` longtext,
	`version` int NOT NULL DEFAULT 1,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `deep_research_artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deep_research_events` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`node_id` varchar(191),
	`actor_type` longtext,
	`actor_id` varchar(191),
	`model` longtext,
	`payload_json` longtext,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `deep_research_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deep_research_execution_records` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`node_id` varchar(191) NOT NULL,
	`record_type` varchar(32) NOT NULL DEFAULT 'local',
	`status` varchar(64) NOT NULL DEFAULT 'pending',
	`remote_job_id` varchar(191),
	`remote_host` longtext,
	`command` longtext NOT NULL DEFAULT (''),
	`config_json` longtext,
	`result_json` longtext,
	`submitted_at` varchar(40),
	`started_at` varchar(40),
	`completed_at` varchar(40),
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `deep_research_execution_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deep_research_messages` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`role` varchar(64) NOT NULL,
	`content` longtext NOT NULL,
	`metadata_json` longtext,
	`related_node_id` varchar(191),
	`related_artifact_ids_json` longtext,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `deep_research_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deep_research_nodes` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`parent_id` varchar(191),
	`node_type` varchar(64) NOT NULL,
	`label` longtext NOT NULL,
	`status` varchar(64) NOT NULL DEFAULT 'pending',
	`assigned_role` varchar(64) NOT NULL,
	`assigned_model` longtext,
	`input_json` longtext,
	`output_json` longtext,
	`error` longtext,
	`phase` varchar(64),
	`depends_on_json` longtext,
	`supersedes_id` varchar(191),
	`superseded_by_id` varchar(191),
	`branch_key` longtext,
	`retry_of_id` varchar(191),
	`retry_count` int NOT NULL DEFAULT 0,
	`requirement_version` int NOT NULL DEFAULT 0,
	`requires_confirmation` boolean NOT NULL DEFAULT true,
	`confirmed_at` varchar(40),
	`confirmed_by` longtext,
	`confirmation_outcome` longtext,
	`position_x` int,
	`position_y` int,
	`started_at` varchar(40),
	`completed_at` varchar(40),
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`updated_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `deep_research_nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deep_research_requirements` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`state_json` longtext NOT NULL,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `deep_research_requirements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deep_research_sessions` (
	`id` varchar(191) NOT NULL,
	`workspace_id` varchar(191) NOT NULL,
	`title` longtext NOT NULL,
	`status` varchar(64) NOT NULL DEFAULT 'intake',
	`phase` varchar(64) NOT NULL DEFAULT 'intake',
	`config_json` longtext,
	`budget_json` longtext,
	`pending_checkpoint_id` varchar(191),
	`literature_round` int NOT NULL DEFAULT 0,
	`reviewer_round` int NOT NULL DEFAULT 0,
	`execution_loop` int NOT NULL DEFAULT 0,
	`error` longtext,
	`remote_profile_id` varchar(191),
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`updated_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `deep_research_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `experiment_runs` (
	`id` varchar(191) NOT NULL,
	`workspace_id` varchar(191) NOT NULL,
	`remote_profile_id` varchar(191),
	`status` varchar(64) NOT NULL DEFAULT 'planning',
	`manifest_json` longtext,
	`patch_summary` longtext,
	`sync_summary` longtext,
	`job_id` varchar(191),
	`monitoring_config_json` longtext,
	`last_polled_at` varchar(40),
	`status_snapshot_json` longtext,
	`collect_approved_at` varchar(40),
	`result_summary_json` longtext,
	`recommendation_json` longtext,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`updated_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `experiment_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hf_datasets` (
	`id` varchar(191) NOT NULL,
	`owner_user_id` varchar(191),
	`name` longtext NOT NULL,
	`repo_id` varchar(191) NOT NULL,
	`repo_type` varchar(32) NOT NULL DEFAULT 'dataset',
	`source` varchar(32) NOT NULL DEFAULT 'huggingface',
	`revision` longtext,
	`source_config` longtext,
	`status` varchar(64) NOT NULL DEFAULT 'pending',
	`progress` int NOT NULL DEFAULT 0,
	`last_error` longtext,
	`local_path` longtext,
	`size_bytes` bigint,
	`num_files` int,
	`manifest` longtext,
	`stats` longtext,
	`last_sync_at` varchar(40),
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`updated_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `hf_datasets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` varchar(191) NOT NULL,
	`workspace_id` varchar(191) NOT NULL,
	`title` longtext NOT NULL,
	`content` longtext NOT NULL,
	`type` varchar(64) NOT NULL DEFAULT 'manual',
	`report_date` varchar(40),
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`updated_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `notes_daily_report_unique_idx` UNIQUE(`workspace_id`,`type`,`report_date`)
);
--> statement-breakpoint
CREATE TABLE `remote_profiles` (
	`id` varchar(191) NOT NULL,
	`workspace_id` varchar(191) NOT NULL,
	`name` longtext NOT NULL,
	`host` longtext NOT NULL,
	`port` int NOT NULL DEFAULT 22,
	`username` longtext NOT NULL,
	`remote_path` longtext NOT NULL,
	`scheduler_type` varchar(64) NOT NULL DEFAULT 'shell',
	`ssh_key_ref` longtext,
	`poll_interval_seconds` int NOT NULL DEFAULT 60,
	`rjob_config_json` longtext,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`updated_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `remote_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_tasks` (
	`id` varchar(191) NOT NULL,
	`owner_user_id` varchar(191),
	`name` longtext NOT NULL,
	`task_type` varchar(64) NOT NULL,
	`schedule` longtext NOT NULL,
	`workspace_id` varchar(191),
	`config` longtext,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`last_run_at` varchar(40),
	`last_run_status` varchar(64),
	`last_run_error` longtext,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`updated_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `scheduled_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` varchar(191) NOT NULL,
	`owner_user_id` varchar(191),
	`workspace_id` varchar(191),
	`name` longtext NOT NULL,
	`slug` varchar(191) NOT NULL,
	`description` longtext,
	`system_prompt` longtext NOT NULL,
	`steps` longtext,
	`allowed_tools` longtext,
	`parameters` longtext,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`updated_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `skills_slug_workspace_idx` UNIQUE(`slug`,`workspace_id`)
);
--> statement-breakpoint
CREATE TABLE `source_chunks` (
	`id` varchar(191) NOT NULL,
	`source_id` varchar(191) NOT NULL,
	`workspace_id` varchar(191) NOT NULL,
	`chunk_index` int NOT NULL,
	`content` longtext NOT NULL,
	`start_char` int,
	`end_char` int,
	CONSTRAINT `source_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` varchar(191) NOT NULL,
	`workspace_id` varchar(191) NOT NULL,
	`relative_path` longtext NOT NULL,
	`file_name` longtext NOT NULL,
	`file_type` longtext NOT NULL,
	`file_size` bigint NOT NULL DEFAULT 0,
	`file_hash` longtext NOT NULL,
	`raw_content` longtext NOT NULL,
	`is_processed` boolean NOT NULL DEFAULT false,
	`last_modified` varchar(40) NOT NULL,
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` varchar(191) NOT NULL,
	`user_id` varchar(191) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` varchar(40) NOT NULL,
	`last_seen_at` varchar(40),
	`revoked_at` varchar(40),
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_sessions_token_hash_unique_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(191) NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` longtext NOT NULL,
	`password_hash` longtext NOT NULL,
	`role` varchar(64) NOT NULL DEFAULT 'user',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` varchar(40),
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`updated_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique_idx` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` varchar(191) NOT NULL,
	`owner_user_id` varchar(191),
	`name` longtext NOT NULL,
	`folder_path` varchar(768) NOT NULL,
	`description` longtext,
	`is_git_repo` boolean NOT NULL DEFAULT false,
	`git_remote_url` longtext,
	`last_opened_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`created_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	`updated_at` varchar(40) NOT NULL DEFAULT (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s')),
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaces_folder_path_unique_idx` UNIQUE(`folder_path`)
);
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chunk_embeddings` ADD CONSTRAINT `chunk_embeddings_chunk_id_source_chunks_id_fk` FOREIGN KEY (`chunk_id`) REFERENCES `source_chunks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cluster_operations` ADD CONSTRAINT `cluster_operations_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dataset_workspace_links` ADD CONSTRAINT `dataset_workspace_links_dataset_id_hf_datasets_id_fk` FOREIGN KEY (`dataset_id`) REFERENCES `hf_datasets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dataset_workspace_links` ADD CONSTRAINT `dataset_workspace_links_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deep_research_artifacts` ADD CONSTRAINT `deep_research_artifacts_session_id_deep_research_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `deep_research_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deep_research_artifacts` ADD CONSTRAINT `deep_research_artifacts_node_id_deep_research_nodes_id_fk` FOREIGN KEY (`node_id`) REFERENCES `deep_research_nodes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deep_research_events` ADD CONSTRAINT `deep_research_events_session_id_deep_research_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `deep_research_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deep_research_execution_records` ADD CONSTRAINT `dr_exec_records_session_fk` FOREIGN KEY (`session_id`) REFERENCES `deep_research_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deep_research_messages` ADD CONSTRAINT `deep_research_messages_session_id_deep_research_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `deep_research_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deep_research_nodes` ADD CONSTRAINT `deep_research_nodes_session_id_deep_research_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `deep_research_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deep_research_requirements` ADD CONSTRAINT `dr_requirements_session_fk` FOREIGN KEY (`session_id`) REFERENCES `deep_research_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deep_research_sessions` ADD CONSTRAINT `deep_research_sessions_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deep_research_sessions` ADD CONSTRAINT `deep_research_sessions_remote_profile_id_remote_profiles_id_fk` FOREIGN KEY (`remote_profile_id`) REFERENCES `remote_profiles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `experiment_runs` ADD CONSTRAINT `experiment_runs_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `experiment_runs` ADD CONSTRAINT `experiment_runs_remote_profile_id_remote_profiles_id_fk` FOREIGN KEY (`remote_profile_id`) REFERENCES `remote_profiles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hf_datasets` ADD CONSTRAINT `hf_datasets_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notes` ADD CONSTRAINT `notes_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `remote_profiles` ADD CONSTRAINT `remote_profiles_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduled_tasks` ADD CONSTRAINT `scheduled_tasks_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduled_tasks` ADD CONSTRAINT `scheduled_tasks_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skills` ADD CONSTRAINT `skills_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skills` ADD CONSTRAINT `skills_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_chunks` ADD CONSTRAINT `source_chunks_source_id_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_chunks` ADD CONSTRAINT `source_chunks_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sources` ADD CONSTRAINT `sources_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cluster_ops_ws_created_idx` ON `cluster_operations` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `cluster_ops_created_idx` ON `cluster_operations` (`created_at`);--> statement-breakpoint
CREATE INDEX `dr_artifacts_session_idx` ON `deep_research_artifacts` (`session_id`);--> statement-breakpoint
CREATE INDEX `dr_artifacts_node_idx` ON `deep_research_artifacts` (`node_id`);--> statement-breakpoint
CREATE INDEX `dr_events_session_created_idx` ON `deep_research_events` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `dr_exec_records_session_idx` ON `deep_research_execution_records` (`session_id`);--> statement-breakpoint
CREATE INDEX `dr_exec_records_status_idx` ON `deep_research_execution_records` (`status`);--> statement-breakpoint
CREATE INDEX `dr_exec_records_node_idx` ON `deep_research_execution_records` (`node_id`);--> statement-breakpoint
CREATE INDEX `dr_messages_session_created_idx` ON `deep_research_messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `dr_nodes_session_idx` ON `deep_research_nodes` (`session_id`);--> statement-breakpoint
CREATE INDEX `dr_nodes_status_idx` ON `deep_research_nodes` (`status`);--> statement-breakpoint
CREATE INDEX `dr_requirements_session_idx` ON `deep_research_requirements` (`session_id`);--> statement-breakpoint
CREATE INDEX `dr_requirements_version_idx` ON `deep_research_requirements` (`session_id`,`version`);--> statement-breakpoint
CREATE INDEX `dr_sessions_ws_idx` ON `deep_research_sessions` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `dr_sessions_status_idx` ON `deep_research_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `experiment_runs_ws_idx` ON `experiment_runs` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `experiment_runs_status_idx` ON `experiment_runs` (`status`);--> statement-breakpoint
CREATE INDEX `remote_profiles_ws_idx` ON `remote_profiles` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `scheduled_tasks_enabled_idx` ON `scheduled_tasks` (`is_enabled`);--> statement-breakpoint
CREATE INDEX `user_sessions_user_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_sessions_expires_idx` ON `user_sessions` (`expires_at`);