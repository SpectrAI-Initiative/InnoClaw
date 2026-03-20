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
    enum: ["manual", "summary", "faq", "briefing", "timeline", "memory", "daily_report", "weekly_report", "paper_discussion", "research_ideation", "experiment_analysis"],
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

// ============================================================
// REMOTE EXECUTION PROFILES (SSH targets for research exec)
// ============================================================
export const remoteProfiles = sqliteTable("remote_profiles", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(22),
  username: text("username").notNull(),
  remotePath: text("remote_path").notNull(),
  schedulerType: text("scheduler_type", {
    enum: ["shell", "slurm", "rjob"],
  })
    .notNull()
    .default("shell"),
  sshKeyRef: text("ssh_key_ref"), // path to SSH key file, never raw key
  pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(60),
  rjobConfigJson: text("rjob_config_json"), // JSON: RJobProfileConfig | null
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("remote_profiles_ws_idx").on(table.workspaceId),
]);

// ============================================================
// EXPERIMENT RUNS (research execution workflow runs)
// ============================================================
export const experimentRuns = sqliteTable("experiment_runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  remoteProfileId: text("remote_profile_id").references(
    () => remoteProfiles.id,
    { onDelete: "set null" },
  ),
  status: text("status", {
    enum: [
      "planning", "patching", "syncing", "submitted",
      "monitoring", "queued", "running", "collecting", "analyzing", "completed",
      "failed", "cancelled", "timed_out", "needs_attention", "unknown",
    ],
  })
    .notNull()
    .default("planning"),
  manifestJson: text("manifest_json"), // JSON: ExperimentManifest
  patchSummary: text("patch_summary"),
  syncSummary: text("sync_summary"),
  jobId: text("job_id"),
  monitoringConfigJson: text("monitoring_config_json"), // JSON: JobMonitoringConfig
  lastPolledAt: text("last_polled_at"),
  statusSnapshotJson: text("status_snapshot_json"), // JSON: RunStatusSnapshot
  collectApprovedAt: text("collect_approved_at"),
  resultSummaryJson: text("result_summary_json"), // JSON: ExperimentResultSummary
  recommendationJson: text("recommendation_json"), // JSON: AnalysisRecommendation
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("experiment_runs_ws_idx").on(table.workspaceId),
  index("experiment_runs_status_idx").on(table.status),
]);

// ============================================================
// DEEP RESEARCH SESSIONS
// ============================================================
export const deepResearchSessions = sqliteTable("deep_research_sessions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("intake"),
  phase: text("phase").notNull().default("intake"),
  configJson: text("config_json"), // JSON: DeepResearchConfig
  budgetJson: text("budget_json"), // JSON: BudgetUsage
  pendingCheckpointId: text("pending_checkpoint_id"),
  literatureRound: integer("literature_round").notNull().default(0),
  reviewerRound: integer("reviewer_round").notNull().default(0),
  executionLoop: integer("execution_loop").notNull().default(0),
  error: text("error"),
  remoteProfileId: text("remote_profile_id").references(() => remoteProfiles.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("dr_sessions_ws_idx").on(table.workspaceId),
  index("dr_sessions_status_idx").on(table.status),
]);

// ============================================================
// DEEP RESEARCH MESSAGES
// ============================================================
export const deepResearchMessages = sqliteTable("deep_research_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => deepResearchSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | main_brain | system
  content: text("content").notNull(),
  metadataJson: text("metadata_json"), // JSON: Record<string, unknown>
  relatedNodeId: text("related_node_id"),
  relatedArtifactIdsJson: text("related_artifact_ids_json"), // JSON: string[]
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("dr_messages_session_created_idx").on(table.sessionId, table.createdAt),
]);

// ============================================================
// DEEP RESEARCH NODES (task graph)
// ============================================================
export const deepResearchNodes = sqliteTable("deep_research_nodes", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => deepResearchSessions.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  nodeType: text("node_type").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull().default("pending"),
  assignedRole: text("assigned_role").notNull(),
  assignedModel: text("assigned_model"),
  inputJson: text("input_json"), // JSON: Record<string, unknown>
  outputJson: text("output_json"), // JSON: Record<string, unknown>
  error: text("error"),
  phase: text("phase"), // which phase spawned this node
  dependsOnJson: text("depends_on_json"), // JSON: string[]
  supersedesId: text("supersedes_id"),
  supersededById: text("superseded_by_id"),
  branchKey: text("branch_key"),
  retryOfId: text("retry_of_id"),
  retryCount: integer("retry_count").notNull().default(0),
  requirementVersion: integer("requirement_version").notNull().default(0),
  requiresConfirmation: integer("requires_confirmation", { mode: "boolean" })
    .notNull()
    .default(true),
  confirmedAt: text("confirmed_at"),
  confirmedBy: text("confirmed_by"),
  confirmationOutcome: text("confirmation_outcome"),
  positionX: integer("position_x"),
  positionY: integer("position_y"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("dr_nodes_session_idx").on(table.sessionId),
  index("dr_nodes_status_idx").on(table.status),
]);

// ============================================================
// DEEP RESEARCH ARTIFACTS
// ============================================================
export const deepResearchArtifacts = sqliteTable("deep_research_artifacts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => deepResearchSessions.id, { onDelete: "cascade" }),
  nodeId: text("node_id").references(() => deepResearchNodes.id, {
    onDelete: "set null",
  }),
  artifactType: text("artifact_type").notNull(),
  title: text("title").notNull(),
  contentJson: text("content_json").notNull(), // JSON: artifact content
  provenanceJson: text("provenance_json"), // JSON: ArtifactProvenance
  version: integer("version").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("dr_artifacts_session_idx").on(table.sessionId),
  index("dr_artifacts_node_idx").on(table.nodeId),
]);

// ============================================================
// DEEP RESEARCH EVENTS
// ============================================================
export const deepResearchEvents = sqliteTable("deep_research_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => deepResearchSessions.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  nodeId: text("node_id"),
  actorType: text("actor_type"),
  actorId: text("actor_id"),
  model: text("model"),
  payloadJson: text("payload_json"), // JSON: Record<string, unknown>
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("dr_events_session_created_idx").on(table.sessionId, table.createdAt),
]);

// ============================================================
// DEEP RESEARCH REQUIREMENTS (Phase 1)
// ============================================================
export const deepResearchRequirements = sqliteTable("deep_research_requirements", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => deepResearchSessions.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  stateJson: text("state_json").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("dr_requirements_session_idx").on(table.sessionId),
  index("dr_requirements_version_idx").on(table.sessionId, table.version),
]);

// ============================================================
// DEEP RESEARCH EXECUTION RECORDS (Phase 5)
// ============================================================
export const deepResearchExecutionRecords = sqliteTable("deep_research_execution_records", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => deepResearchSessions.id, { onDelete: "cascade" }),
  nodeId: text("node_id").notNull(),
  recordType: text("record_type").notNull().default("local"),
  status: text("status").notNull().default("pending"),
  remoteJobId: text("remote_job_id"),
  remoteHost: text("remote_host"),
  command: text("command").notNull().default(""),
  configJson: text("config_json"),
  resultJson: text("result_json"),
  submittedAt: text("submitted_at"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index("dr_exec_records_session_idx").on(table.sessionId),
  index("dr_exec_records_status_idx").on(table.status),
  index("dr_exec_records_node_idx").on(table.nodeId),
]);
