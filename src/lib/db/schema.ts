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
    enum: ["manual", "summary", "faq", "briefing", "timeline", "memory", "daily_report", "weekly_report"],
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
