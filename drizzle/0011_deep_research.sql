CREATE TABLE IF NOT EXISTS `deep_research_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `status` text NOT NULL DEFAULT 'intake',
  `phase` text NOT NULL DEFAULT 'intake',
  `config_json` text,
  `budget_json` text,
  `pending_checkpoint_id` text,
  `error` text,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dr_sessions_ws_idx` ON `deep_research_sessions` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dr_sessions_status_idx` ON `deep_research_sessions` (`status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deep_research_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `deep_research_sessions`(`id`) ON DELETE CASCADE,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `metadata_json` text,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dr_messages_session_created_idx` ON `deep_research_messages` (`session_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deep_research_nodes` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `deep_research_sessions`(`id`) ON DELETE CASCADE,
  `parent_id` text,
  `node_type` text NOT NULL,
  `label` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `assigned_role` text NOT NULL,
  `assigned_model` text,
  `input_json` text,
  `output_json` text,
  `error` text,
  `depends_on_json` text,
  `supersedes_id` text,
  `superseded_by_id` text,
  `branch_key` text,
  `retry_of_id` text,
  `retry_count` integer NOT NULL DEFAULT 0,
  `requires_confirmation` integer NOT NULL DEFAULT 1,
  `confirmed_at` text,
  `confirmed_by` text,
  `confirmation_outcome` text,
  `position_x` real,
  `position_y` real,
  `started_at` text,
  `completed_at` text,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dr_nodes_session_idx` ON `deep_research_nodes` (`session_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dr_nodes_status_idx` ON `deep_research_nodes` (`status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deep_research_artifacts` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `deep_research_sessions`(`id`) ON DELETE CASCADE,
  `node_id` text REFERENCES `deep_research_nodes`(`id`) ON DELETE SET NULL,
  `artifact_type` text NOT NULL,
  `title` text NOT NULL,
  `content_json` text NOT NULL,
  `provenance_json` text,
  `version` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dr_artifacts_session_idx` ON `deep_research_artifacts` (`session_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dr_artifacts_node_idx` ON `deep_research_artifacts` (`node_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deep_research_events` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `deep_research_sessions`(`id`) ON DELETE CASCADE,
  `event_type` text NOT NULL,
  `node_id` text,
  `actor_type` text,
  `actor_id` text,
  `model` text,
  `payload_json` text,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dr_events_session_created_idx` ON `deep_research_events` (`session_id`, `created_at`);
