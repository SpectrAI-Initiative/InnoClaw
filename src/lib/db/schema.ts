import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
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
    enum: ["manual", "summary", "faq", "briefing", "timeline", "memory"],
  })
    .notNull()
    .default("manual"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

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
