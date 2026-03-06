CREATE TABLE dataset_workspace_links (
  id text PRIMARY KEY NOT NULL,
  dataset_id text NOT NULL REFERENCES hf_datasets(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at text NOT NULL DEFAULT (datetime('now'))
);

--> statement-breakpoint
CREATE UNIQUE INDEX dataset_workspace_unique_idx ON dataset_workspace_links(dataset_id, workspace_id);
