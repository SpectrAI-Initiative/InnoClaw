import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============================================================
// WORKSPACES
// ============================================================
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  folderPath: text("folder_path").notNull(),
  description: text("description"),
  isGitRepo: integer("is_git_repo", { mode: "boolean" })
    .notNull()
    .default(false),
  gitRemoteUrl: text("git_remote_url"),
  lastOpenedAt: text("last_opened_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================
// SOURCES (tracked files in workspace)
// ============================================================
export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  relativePath: text("relative_path").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  fileHash: text("file_hash").notNull(),
  rawContent: text("raw_content").notNull(),
  isProcessed: integer("is_processed", { mode: "boolean" })
    .notNull()
    .default(false),
  lastModified: text("last_modified").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================
// SOURCE CHUNKS (for RAG)
// ============================================================
export const sourceChunks = sqliteTable("source_chunks", {
  id: text("id").primaryKey(),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  startChar: integer("start_char"),
  endChar: integer("end_char"),
});

// ============================================================
// CHAT MESSAGES
// ============================================================
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  citations: text("citations"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================
// NOTES
// ============================================================
export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type", {
    enum: ["manual", "summary", "faq", "briefing", "timeline", "memory", "daily_report", "weekly_report", "paper_discussion", "research_ideation"],
  })
    .notNull()
    .default("manual"),
  reportDate: text("report_date"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  // Only daily_report rows set reportDate, so the constraint effectively
  // scopes to that type — SQLite treats NULLs as distinct in unique indexes.
  uniqueIndex("notes_daily_report_unique_idx").on(table.workspaceId, table.type, table.reportDate),
]);

// ============================================================
// APP SETTINGS
// ============================================================
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ============================================================
// SKILLS (custom AI agent workflows)
// ============================================================
export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }), // null = global skill
  name: text("name").notNull(),
  slug: text("slug").notNull(), // slash command trigger, e.g. "code-review"
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  steps: text("steps"), // JSON: SkillStep[]
  allowedTools: text("allowed_tools"), // JSON: string[] | null (null = all tools)
  parameters: text("parameters"), // JSON: SkillParameter[]
  isEnabled: integer("is_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("skills_slug_workspace_idx").on(table.slug, table.workspaceId),
]);

// ============================================================
// SCHEDULED TASKS (user-defined cron/interval tasks)
// ============================================================
export const scheduledTasks = sqliteTable("scheduled_tasks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  taskType: text("task_type", {
    enum: ["daily_report", "weekly_report", "git_sync", "source_sync", "custom"],
  }).notNull(),
  schedule: text("schedule").notNull(), // cron expression, e.g. "0 0 * * *"
  workspaceId: text("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }), // null = global task
  config: text("config"), // JSON for task-specific configuration
  isEnabled: integer("is_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  lastRunAt: text("last_run_at"),
  lastRunStatus: text("last_run_status", {
    enum: ["success", "error", "running"],
  }),
  lastRunError: text("last_run_error"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("scheduled_tasks_enabled_idx").on(table.isEnabled),
]);

// ============================================================
// CLUSTER OPERATIONS (agent cluster action history)
// ============================================================
export const clusterOperations = sqliteTable("cluster_operations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  toolName: text("tool_name").notNull(), // "kubectl" | "submitK8sJob" | "collectJobResults"
  subcommand: text("subcommand"), // e.g. "get pods -n default"
  jobName: text("job_name"), // for submitK8sJob / collectJobResults
  namespace: text("namespace"),
  status: text("status", {
    enum: ["success", "error", "blocked"],
  }).notNull(),
  exitCode: integer("exit_code"),
  summary: text("summary"), // human-readable one-liner
  inputJson: text("input_json"), // JSON of tool input params
  outputJson: text("output_json"), // JSON of truncated tool output
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("cluster_ops_ws_created_idx").on(table.workspaceId, table.createdAt),
  index("cluster_ops_created_idx").on(table.createdAt),
]);

// ============================================================
// HF DATASETS (HuggingFace dataset/model/space downloads)
// ============================================================
export const hfDatasets = sqliteTable("hf_datasets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  repoId: text("repo_id").notNull(),
  repoType: text("repo_type").notNull().default("dataset"), // dataset | model | space
  source: text("source").notNull().default("huggingface"), // huggingface | modelscope | local
  revision: text("revision"), // branch/tag, null = default
  sourceConfig: text("source_config"), // JSON: { allowPatterns, ignorePatterns }
  status: text("status", {
    enum: ["pending", "downloading", "paused", "ready", "failed", "cancelled"],
  })
    .notNull()
    .default("pending"),
  progress: integer("progress").notNull().default(0), // 0-100
  lastError: text("last_error"),
  localPath: text("local_path"),
  sizeBytes: integer("size_bytes"),
  numFiles: integer("num_files"),
  manifest: text("manifest"), // JSON: file list with splits/formats
  stats: text("stats"), // JSON: format counts, row counts
  lastSyncAt: text("last_sync_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================
// DATASET-WORKSPACE LINKS (many-to-many)
// ============================================================
export const datasetWorkspaceLinks = sqliteTable("dataset_workspace_links", {
  id: text("id").primaryKey(),
  datasetId: text("dataset_id")
    .notNull()
    .references(() => hfDatasets.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("dataset_workspace_unique_idx").on(table.datasetId, table.workspaceId),
]);
