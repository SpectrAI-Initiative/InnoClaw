CREATE TABLE `cluster_operations` (
`id` text PRIMARY KEY NOT NULL,
`workspace_id` text,
`tool_name` text NOT NULL,
`subcommand` text,
`job_name` text,
`namespace` text,
`status` text NOT NULL,
`exit_code` integer,
`summary` text,
`input_json` text,
`output_json` text,
`created_at` text DEFAULT (datetime('now')) NOT NULL,
FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cluster_ops_ws_created_idx` ON `cluster_operations` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `cluster_ops_created_idx` ON `cluster_operations` (`created_at`);
