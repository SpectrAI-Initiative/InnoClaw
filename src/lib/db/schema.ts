import {
  mysqlTable,
  varchar,
  longtext,
  int,
  bigint,
  boolean,
  customType,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// ------------------------------------------------------------
// Column helpers
//
// The schema was ported from SQLite. To keep application behaviour identical,
// timestamps stay strings: rows default to the same UTC "YYYY-MM-DD HH:MM:SS"
// text SQLite's datetime('now') produced, and code that writes ISO strings
// keeps doing so. Identifiers and other indexed strings are VARCHAR because
// MySQL cannot index unbounded TEXT; free-form content is LONGTEXT.
// ------------------------------------------------------------

/** Primary and foreign keys (nanoid / UUID values). */
const id = (name: string) => varchar(name, { length: 191 });
/** Timestamp-like strings: ISO 8601 or "YYYY-MM-DD HH:MM:SS" (UTC). */
const ts = (name: string) => varchar(name, { length: 40 });
/** UTC now in SQLite datetime('now') format. Requires MySQL 8.0.13+. */
const NOW_UTC = sql`(DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s'))`;

/** Raw binary for Float32 embeddings (up to 16 MB per row). */
export const mediumBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "mediumblob";
  },
});

// ============================================================
// USERS / SESSIONS
// ============================================================
export const users = mysqlTable("users", {
  id: id("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  name: longtext("name").notNull(),
  passwordHash: longtext("password_hash").notNull(),
  role: varchar("role", { length: 64, enum: ["admin", "user"] }).notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: ts("last_login_at"),
  createdAt: ts("created_at").notNull().default(NOW_UTC),
  updatedAt: ts("updated_at").notNull().default(NOW_UTC),
}, (table) => [
  uniqueIndex("users_email_unique_idx").on(table.email),
]);

export const userSessions = mysqlTable("user_sessions", {
  id: id("id").primaryKey(),
  userId: id("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  expiresAt: ts("expires_at").notNull(),
  lastSeenAt: ts("last_seen_at"),
  revokedAt: ts("revoked_at"),
  createdAt: ts("created_at").notNull().default(NOW_UTC),
}, (table) => [
  uniqueIndex("user_sessions_token_hash_unique_idx").on(table.tokenHash),
  index("user_sessions_user_idx").on(table.userId),
  index("user_sessions_expires_idx").on(table.expiresAt),
]);

// ============================================================
// WORKSPACES
// ============================================================
export const workspaces = mysqlTable("workspaces", {
  id: id("id").primaryKey(),
  ownerUserId: id("owner_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  name: longtext("name").notNull(),
  folderPath: varchar("folder_path", { length: 768 }).notNull(),
  description: longtext("description"),
  isGitRepo: boolean("is_git_repo")
    .notNull()
    .default(false),
  gitRemoteUrl: longtext("git_remote_url"),
  lastOpenedAt: ts("last_opened_at")
    .notNull()
    .default(NOW_UTC),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
  updatedAt: ts("updated_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  uniqueIndex("workspaces_folder_path_unique_idx").on(table.folderPath),
]);

// ============================================================
// SOURCES (tracked files in workspace)
// ============================================================
export const sources = mysqlTable("sources", {
  id: id("id").primaryKey(),
  workspaceId: id("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  relativePath: longtext("relative_path").notNull(),
  fileName: longtext("file_name").notNull(),
  fileType: longtext("file_type").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull().default(0),
  fileHash: longtext("file_hash").notNull(),
  rawContent: longtext("raw_content").notNull(),
  isProcessed: boolean("is_processed")
    .notNull()
    .default(false),
  lastModified: ts("last_modified").notNull(),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
});

// ============================================================
// SOURCE CHUNKS (for RAG)
// ============================================================
export const sourceChunks = mysqlTable("source_chunks", {
  id: id("id").primaryKey(),
  sourceId: id("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  workspaceId: id("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  chunkIndex: int("chunk_index").notNull(),
  content: longtext("content").notNull(),
  startChar: int("start_char"),
  endChar: int("end_char"),
});

// ============================================================
// CHUNK EMBEDDINGS (RAG vectors, Float32 little-endian)
// Previously created ad hoc by the SQLite vector store; now part of the schema.
// ============================================================
export const chunkEmbeddings = mysqlTable("chunk_embeddings", {
  chunkId: id("chunk_id")
    .primaryKey()
    .references(() => sourceChunks.id, { onDelete: "cascade" }),
  embedding: mediumBlob("embedding").notNull(),
});

// ============================================================
// CHAT MESSAGES
// ============================================================
export const chatMessages = mysqlTable("chat_messages", {
  id: id("id").primaryKey(),
  workspaceId: id("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 64, enum: ["user", "assistant"] }).notNull(),
  content: longtext("content").notNull(),
  citations: longtext("citations"),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
});

// ============================================================
// NOTES
// ============================================================
export const notes = mysqlTable("notes", {
  id: id("id").primaryKey(),
  workspaceId: id("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: longtext("title").notNull(),
  content: longtext("content").notNull(),
  type: varchar("type", { length: 64,
    enum: ["manual", "summary", "faq", "briefing", "timeline", "memory", "daily_report", "weekly_report", "paper_discussion", "research_ideation", "experiment_analysis"],
  })
    .notNull()
    .default("manual"),
  reportDate: ts("report_date"),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
  updatedAt: ts("updated_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  // Only daily_report rows set reportDate, so the constraint effectively
  // scopes to that type — MySQL (like SQLite) treats NULLs as distinct in unique indexes.
  uniqueIndex("notes_daily_report_unique_idx").on(table.workspaceId, table.type, table.reportDate),
]);

// ============================================================
// APP SETTINGS
// ============================================================
export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 191 }).primaryKey(),
  value: longtext("value").notNull(),
});

// ============================================================
// SKILLS (custom AI agent workflows)
// ============================================================
export const skills = mysqlTable("skills", {
  id: id("id").primaryKey(),
  ownerUserId: id("owner_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  workspaceId: id("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }), // null = global skill
  name: longtext("name").notNull(),
  slug: varchar("slug", { length: 191 }).notNull(), // slash command trigger, e.g. "code-review"
  description: longtext("description"),
  systemPrompt: longtext("system_prompt").notNull(),
  steps: longtext("steps"), // JSON: SkillStep[]
  allowedTools: longtext("allowed_tools"), // JSON: string[] | null (null = all tools)
  parameters: longtext("parameters"), // JSON: SkillParameter[]
  isEnabled: boolean("is_enabled")
    .notNull()
    .default(true),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
  updatedAt: ts("updated_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  uniqueIndex("skills_slug_workspace_idx").on(table.slug, table.workspaceId),
]);

// ============================================================
// SCHEDULED TASKS (user-defined cron/interval tasks)
// ============================================================
export const scheduledTasks = mysqlTable("scheduled_tasks", {
  id: id("id").primaryKey(),
  ownerUserId: id("owner_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  name: longtext("name").notNull(),
  taskType: varchar("task_type", { length: 64,
    enum: ["daily_report", "weekly_report", "git_sync", "source_sync", "custom"],
  }).notNull(),
  schedule: longtext("schedule").notNull(), // cron expression, e.g. "0 0 * * *"
  workspaceId: id("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }), // null = global task
  config: longtext("config"), // JSON for task-specific configuration
  isEnabled: boolean("is_enabled")
    .notNull()
    .default(true),
  lastRunAt: ts("last_run_at"),
  lastRunStatus: varchar("last_run_status", { length: 64,
    enum: ["success", "error", "running"],
  }),
  lastRunError: longtext("last_run_error"),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
  updatedAt: ts("updated_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  index("scheduled_tasks_enabled_idx").on(table.isEnabled),
]);

// ============================================================
// CLUSTER OPERATIONS (agent cluster action history)
// ============================================================
export const clusterOperations = mysqlTable("cluster_operations", {
  id: id("id").primaryKey(),
  workspaceId: id("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  toolName: longtext("tool_name").notNull(), // "kubectl" | "submitK8sJob" | "collectJobResults"
  subcommand: longtext("subcommand"), // e.g. "get pods -n default"
  jobName: longtext("job_name"), // for submitK8sJob / collectJobResults
  namespace: longtext("namespace"),
  status: varchar("status", { length: 64,
    enum: ["success", "error", "blocked"],
  }).notNull(),
  exitCode: int("exit_code"),
  summary: longtext("summary"), // human-readable one-liner
  inputJson: longtext("input_json"), // JSON of tool input params
  outputJson: longtext("output_json"), // JSON of truncated tool output
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  index("cluster_ops_ws_created_idx").on(table.workspaceId, table.createdAt),
  index("cluster_ops_created_idx").on(table.createdAt),
]);

// ============================================================
// HF DATASETS (HuggingFace dataset/model/space downloads)
// ============================================================
export const hfDatasets = mysqlTable("hf_datasets", {
  id: id("id").primaryKey(),
  ownerUserId: id("owner_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  name: longtext("name").notNull(),
  repoId: id("repo_id").notNull(),
  repoType: varchar("repo_type", { length: 32 }).notNull().default("dataset"), // dataset | model | space
  source: varchar("source", { length: 32 }).notNull().default("huggingface"), // huggingface | modelscope | local
  revision: longtext("revision"), // branch/tag, null = default
  sourceConfig: longtext("source_config"), // JSON: { allowPatterns, ignorePatterns }
  status: varchar("status", { length: 64,
    enum: ["pending", "downloading", "paused", "ready", "failed", "cancelled"],
  })
    .notNull()
    .default("pending"),
  progress: int("progress").notNull().default(0), // 0-100
  lastError: longtext("last_error"),
  localPath: longtext("local_path"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  numFiles: int("num_files"),
  manifest: longtext("manifest"), // JSON: file list with splits/formats
  stats: longtext("stats"), // JSON: format counts, row counts
  lastSyncAt: ts("last_sync_at"),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
  updatedAt: ts("updated_at")
    .notNull()
    .default(NOW_UTC),
});

// ============================================================
// DATASET-WORKSPACE LINKS (many-to-many)
// ============================================================
export const datasetWorkspaceLinks = mysqlTable("dataset_workspace_links", {
  id: id("id").primaryKey(),
  datasetId: id("dataset_id")
    .notNull()
    .references(() => hfDatasets.id, { onDelete: "cascade" }),
  workspaceId: id("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  uniqueIndex("dataset_workspace_unique_idx").on(table.datasetId, table.workspaceId),
]);

// ============================================================
// REMOTE EXECUTION PROFILES (SSH targets for research exec)
// ============================================================
export const remoteProfiles = mysqlTable("remote_profiles", {
  id: id("id").primaryKey(),
  workspaceId: id("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: longtext("name").notNull(),
  host: longtext("host").notNull(),
  port: int("port").notNull().default(22),
  username: longtext("username").notNull(),
  remotePath: longtext("remote_path").notNull(),
  schedulerType: varchar("scheduler_type", { length: 64,
    enum: ["shell", "slurm", "rjob"],
  })
    .notNull()
    .default("shell"),
  sshKeyRef: longtext("ssh_key_ref"), // path to SSH key file, never raw key
  pollIntervalSeconds: int("poll_interval_seconds").notNull().default(60),
  rjobConfigJson: longtext("rjob_config_json"), // JSON: RJobProfileConfig | null
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
  updatedAt: ts("updated_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  index("remote_profiles_ws_idx").on(table.workspaceId),
]);

// ============================================================
// EXPERIMENT RUNS (research execution workflow runs)
// ============================================================
export const experimentRuns = mysqlTable("experiment_runs", {
  id: id("id").primaryKey(),
  workspaceId: id("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  remoteProfileId: id("remote_profile_id").references(
    () => remoteProfiles.id,
    { onDelete: "set null" },
  ),
  status: varchar("status", { length: 64,
    enum: [
      "planning", "patching", "syncing", "submitted",
      "monitoring", "queued", "running", "collecting", "analyzing", "completed",
      "failed", "cancelled", "timed_out", "needs_attention", "unknown",
    ],
  })
    .notNull()
    .default("planning"),
  manifestJson: longtext("manifest_json"), // JSON: ExperimentManifest
  patchSummary: longtext("patch_summary"),
  syncSummary: longtext("sync_summary"),
  jobId: id("job_id"),
  monitoringConfigJson: longtext("monitoring_config_json"), // JSON: JobMonitoringConfig
  lastPolledAt: ts("last_polled_at"),
  statusSnapshotJson: longtext("status_snapshot_json"), // JSON: RunStatusSnapshot
  collectApprovedAt: ts("collect_approved_at"),
  resultSummaryJson: longtext("result_summary_json"), // JSON: ExperimentResultSummary
  recommendationJson: longtext("recommendation_json"), // JSON: AnalysisRecommendation
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
  updatedAt: ts("updated_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  index("experiment_runs_ws_idx").on(table.workspaceId),
  index("experiment_runs_status_idx").on(table.status),
]);

// ============================================================
// DEEP RESEARCH SESSIONS
// ============================================================
export const deepResearchSessions = mysqlTable("deep_research_sessions", {
  id: id("id").primaryKey(),
  workspaceId: id("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: longtext("title").notNull(),
  status: varchar("status", { length: 64 }).notNull().default("intake"),
  phase: varchar("phase", { length: 64 }).notNull().default("intake"),
  configJson: longtext("config_json"), // JSON: DeepResearchConfig
  budgetJson: longtext("budget_json"), // JSON: BudgetUsage
  pendingCheckpointId: id("pending_checkpoint_id"),
  literatureRound: int("literature_round").notNull().default(0),
  reviewerRound: int("reviewer_round").notNull().default(0),
  executionLoop: int("execution_loop").notNull().default(0),
  error: longtext("error"),
  remoteProfileId: id("remote_profile_id").references(() => remoteProfiles.id, { onDelete: "set null" }),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
  updatedAt: ts("updated_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  index("dr_sessions_ws_idx").on(table.workspaceId),
  index("dr_sessions_status_idx").on(table.status),
]);

// ============================================================
// DEEP RESEARCH MESSAGES
// ============================================================
export const deepResearchMessages = mysqlTable("deep_research_messages", {
  id: id("id").primaryKey(),
  sessionId: id("session_id")
    .notNull()
    .references(() => deepResearchSessions.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 64 }).notNull(), // user | main_brain | system
  content: longtext("content").notNull(),
  metadataJson: longtext("metadata_json"), // JSON: Record<string, unknown>
  relatedNodeId: id("related_node_id"),
  relatedArtifactIdsJson: longtext("related_artifact_ids_json"), // JSON: string[]
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  index("dr_messages_session_created_idx").on(table.sessionId, table.createdAt),
]);

// ============================================================
// DEEP RESEARCH NODES (task graph)
// ============================================================
export const deepResearchNodes = mysqlTable("deep_research_nodes", {
  id: id("id").primaryKey(),
  sessionId: id("session_id")
    .notNull()
    .references(() => deepResearchSessions.id, { onDelete: "cascade" }),
  parentId: id("parent_id"),
  nodeType: varchar("node_type", { length: 64 }).notNull(),
  label: longtext("label").notNull(),
  status: varchar("status", { length: 64 }).notNull().default("pending"),
  assignedRole: varchar("assigned_role", { length: 64 }).notNull(),
  assignedModel: longtext("assigned_model"),
  inputJson: longtext("input_json"), // JSON: Record<string, unknown>
  outputJson: longtext("output_json"), // JSON: Record<string, unknown>
  error: longtext("error"),
  phase: varchar("phase", { length: 64 }), // which phase spawned this node
  dependsOnJson: longtext("depends_on_json"), // JSON: string[]
  supersedesId: id("supersedes_id"),
  supersededById: id("superseded_by_id"),
  branchKey: longtext("branch_key"),
  retryOfId: id("retry_of_id"),
  retryCount: int("retry_count").notNull().default(0),
  requirementVersion: int("requirement_version").notNull().default(0),
  requiresConfirmation: boolean("requires_confirmation")
    .notNull()
    .default(true),
  confirmedAt: ts("confirmed_at"),
  confirmedBy: longtext("confirmed_by"),
  confirmationOutcome: longtext("confirmation_outcome"),
  positionX: int("position_x"),
  positionY: int("position_y"),
  startedAt: ts("started_at"),
  completedAt: ts("completed_at"),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
  updatedAt: ts("updated_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  index("dr_nodes_session_idx").on(table.sessionId),
  index("dr_nodes_status_idx").on(table.status),
]);

// ============================================================
// DEEP RESEARCH ARTIFACTS
// ============================================================
export const deepResearchArtifacts = mysqlTable("deep_research_artifacts", {
  id: id("id").primaryKey(),
  sessionId: id("session_id")
    .notNull()
    .references(() => deepResearchSessions.id, { onDelete: "cascade" }),
  nodeId: id("node_id").references(() => deepResearchNodes.id, {
    onDelete: "set null",
  }),
  artifactType: varchar("artifact_type", { length: 64 }).notNull(),
  title: longtext("title").notNull(),
  contentJson: longtext("content_json").notNull(), // JSON: artifact content
  provenanceJson: longtext("provenance_json"), // JSON: ArtifactProvenance
  version: int("version").notNull().default(1),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  index("dr_artifacts_session_idx").on(table.sessionId),
  index("dr_artifacts_node_idx").on(table.nodeId),
]);

// ============================================================
// DEEP RESEARCH EVENTS
// ============================================================
export const deepResearchEvents = mysqlTable("deep_research_events", {
  id: id("id").primaryKey(),
  sessionId: id("session_id")
    .notNull()
    .references(() => deepResearchSessions.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  nodeId: id("node_id"),
  actorType: longtext("actor_type"),
  actorId: id("actor_id"),
  model: longtext("model"),
  payloadJson: longtext("payload_json"), // JSON: Record<string, unknown>
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  index("dr_events_session_created_idx").on(table.sessionId, table.createdAt),
]);

// ============================================================
// DEEP RESEARCH REQUIREMENTS (Phase 1)
// ============================================================
export const deepResearchRequirements = mysqlTable("deep_research_requirements", {
  id: id("id").primaryKey(),
  sessionId: id("session_id").notNull(),
  version: int("version").notNull().default(1),
  stateJson: longtext("state_json").notNull(),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  // Explicit name: the generated one exceeds MySQL's 64-character identifier limit.
  foreignKey({
    name: "dr_requirements_session_fk",
    columns: [table.sessionId],
    foreignColumns: [deepResearchSessions.id],
  }).onDelete("cascade"),
  index("dr_requirements_session_idx").on(table.sessionId),
  index("dr_requirements_version_idx").on(table.sessionId, table.version),
]);

// ============================================================
// DEEP RESEARCH EXECUTION RECORDS (Phase 5)
// ============================================================
export const deepResearchExecutionRecords = mysqlTable("deep_research_execution_records", {
  id: id("id").primaryKey(),
  sessionId: id("session_id").notNull(),
  nodeId: id("node_id").notNull(),
  recordType: varchar("record_type", { length: 32 }).notNull().default("local"),
  status: varchar("status", { length: 64 }).notNull().default("pending"),
  remoteJobId: id("remote_job_id"),
  remoteHost: longtext("remote_host"),
  command: longtext("command").notNull().default(sql`('')`),
  configJson: longtext("config_json"),
  resultJson: longtext("result_json"),
  submittedAt: ts("submitted_at"),
  startedAt: ts("started_at"),
  completedAt: ts("completed_at"),
  createdAt: ts("created_at")
    .notNull()
    .default(NOW_UTC),
}, (table) => [
  // Explicit name: the generated one exceeds MySQL's 64-character identifier limit.
  foreignKey({
    name: "dr_exec_records_session_fk",
    columns: [table.sessionId],
    foreignColumns: [deepResearchSessions.id],
  }).onDelete("cascade"),
  index("dr_exec_records_session_idx").on(table.sessionId),
  index("dr_exec_records_status_idx").on(table.status),
  index("dr_exec_records_node_idx").on(table.nodeId),
]);
