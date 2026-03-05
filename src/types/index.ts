export interface Workspace {
  id: string;
  name: string;
  folderPath: string;
  description: string | null;
  isGitRepo: boolean;
  gitRemoteUrl: string | null;
  lastOpenedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  id: string;
  workspaceId: string;
  relativePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  rawContent: string;
  isProcessed: boolean;
  lastModified: string;
  createdAt: string;
}

export interface SourceChunk {
  id: string;
  sourceId: string;
  workspaceId: string;
  chunkIndex: number;
  content: string;
  startChar: number | null;
  endChar: number | null;
}

export interface ChatMessage {
  id: string;
  workspaceId: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  createdAt: string;
}

export interface Citation {
  sourceId: string;
  chunkId: string;
  fileName: string;
  excerpt: string;
}

export interface Note {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  type: "manual" | "summary" | "faq" | "briefing" | "timeline" | "memory";
  createdAt: string;
  updatedAt: string;
}

export interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  modified: string;
  path: string;
}

export interface GitStatus {
  isGitRepo: boolean;
  branch: string | null;
  clean: boolean;
  ahead: number;
  behind: number;
  modified: string[];
}

export interface SyncResult {
  newCount: number;
  updatedCount: number;
  removedCount: number;
}

export interface LLMProvider {
  id: string;
  name: string;
  models: LLMModel[];
  envKey: string;
}

export interface LLMModel {
  id: string;
  name: string;
  contextWindow: number;
}

// ---- Skills ----

export interface Skill {
  id: string;
  workspaceId: string | null;
  name: string;
  slug: string;
  description: string | null;
  systemPrompt: string;
  steps: SkillStep[] | null;
  allowedTools: string[] | null;
  parameters: SkillParameter[] | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillStep {
  order: number;
  instruction: string;
  toolHint?: string;
}

export interface SkillParameter {
  name: string;
  label: string;
  type: "string" | "number" | "boolean" | "select";
  required: boolean;
  defaultValue?: string;
  options?: string[];
  placeholder?: string;
}

// ---- HuggingFace Datasets ----

export type HfDatasetStatus = "pending" | "downloading" | "paused" | "ready" | "failed" | "cancelled";
export type HfRepoType = "dataset" | "model" | "space";
export type DatasetSource = "huggingface" | "modelscope" | "local";

export interface HfDataset {
  id: string;
  name: string;
  source: DatasetSource;
  repoId: string;
  repoType: HfRepoType;
  revision: string | null;
  sourceConfig: HfDatasetSourceConfig | null;
  status: HfDatasetStatus;
  progress: number;
  lastError: string | null;
  localPath: string | null;
  sizeBytes: number | null;
  numFiles: number | null;
  manifest: HfDatasetManifest | null;
  stats: HfDatasetStats | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HfDatasetSourceConfig {
  allowPatterns?: string[];
  ignorePatterns?: string[];
}

export interface HfDatasetManifest {
  version: number;
  splits: Record<string, HfDatasetSplit>;
}

export interface HfDatasetSplit {
  root: string;
  files: {
    path: string;
    format: string;
    sizeBytes: number;
    rows: number | null;
  }[];
  numFiles: number;
  numRows: number | null;
}

export interface HfDatasetStats {
  sizeBytes: number;
  splits: Record<string, {
    numFiles: number;
    numRows: number | null;
    formats: Record<string, number>;
  }>;
}

export interface HfRepoInfo {
  repoId: string;
  repoType: HfRepoType;
  description: string | null;
  totalSize: number | null;
  totalFiles: number;
  lastModified: string | null;
}

export interface HfDownloadProgress {
  datasetId: string;
  status: HfDatasetStatus;
  progress: number;
  phase: "downloading" | "building_manifest" | "computing_stats" | "done";
  downloadedBytes: number;
  totalBytes: number;
  downloadedFiles: number;
  totalFiles: number;
  speedBytesPerSecond?: number;
  estimatedSecondsRemaining?: number;
}

export interface DatasetWorkspaceLink {
  id: string;
  datasetId: string;
  workspaceId: string;
  createdAt: string;
}

// Portable format for sharing skills (no internal IDs or timestamps)
export interface SkillExportData {
  name: string;
  slug: string;
  description: string | null;
  systemPrompt: string;
  steps: SkillStep[] | null;
  allowedTools: string[] | null;
  parameters: SkillParameter[] | null;
  version?: string;
}
