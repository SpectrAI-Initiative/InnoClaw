import type {
  DeepResearchConfig,
  BudgetUsage,
} from "./config-types";
import type {
  ArtifactType,
  ContextTag,
  EventType,
  MessageRole,
  ModelRole,
  NodeStatus,
  NodeType,
  SessionStatus,
  ConfirmationOutcome,
} from "./status-types";

export interface ArtifactProvenance {
  sourceNodeId: string;
  sourceArtifactIds: string[];
  model: string;
  generatedAt: string;
}

export interface DeepResearchSession {
  id: string;
  workspaceId: string;
  title: string;
  status: SessionStatus;
  contextTag: ContextTag;
  config: DeepResearchConfig;
  budget: BudgetUsage;
  pendingCheckpointId: string | null;
  literatureRound: number;
  reviewerRound: number;
  executionLoop: number;
  error: string | null;
  remoteProfileId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeepResearchMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  relatedNodeId: string | null;
  relatedArtifactIds: string[];
  createdAt: string;
}

export interface DeepResearchNode {
  id: string;
  sessionId: string;
  parentId: string | null;
  nodeType: NodeType;
  label: string;
  status: NodeStatus;
  assignedRole: ModelRole;
  assignedModel: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  dependsOn: string[];
  supersedesId: string | null;
  supersededById: string | null;
  branchKey: string | null;
  retryOfId: string | null;
  retryCount: number;
  contextTag: ContextTag;
  stageNumber: number;
  requiresConfirmation: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmationOutcome: ConfirmationOutcome | null;
  positionX: number | null;
  positionY: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeepResearchArtifact {
  id: string;
  sessionId: string;
  nodeId: string | null;
  artifactType: ArtifactType;
  title: string;
  content: Record<string, unknown>;
  provenance: ArtifactProvenance | null;
  version: number;
  createdAt: string;
}

export interface DeepResearchEvent {
  id: string;
  sessionId: string;
  eventType: EventType;
  nodeId: string | null;
  actorType: string | null;
  actorId: string | null;
  model: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}
