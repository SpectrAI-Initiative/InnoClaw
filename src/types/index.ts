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
  type: "manual" | "summary" | "faq" | "briefing" | "timeline";
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
