import { getStructuredPromptForNode, getStructuredRoleDisplayName } from "./role-registry";
import type {
  ContextTag,
  DeepResearchArtifact,
  DeepResearchNode,
  MainBrainAudit,
  NodeCreationSpec,
  StructuredPromptKind,
} from "./types";

type RecommendedDispatch = {
  roleId: NodeCreationSpec["assignedRole"];
  roleName: string;
  nodeType: NodeCreationSpec["nodeType"];
  label: string;
  promptUsed?: {
    title: string;
    kind: StructuredPromptKind;
    objective: string;
  };
};

export function getRecommendedDispatch(
  freshNodes: DeepResearchNode[],
  plannedSpecs: NodeCreationSpec[],
): RecommendedDispatch | null {
  const pendingNode = freshNodes
    .filter((node) => node.status === "pending" || node.status === "queued")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  const candidate = pendingNode
    ? {
        assignedRole: pendingNode.assignedRole,
        nodeType: pendingNode.nodeType,
        label: pendingNode.label,
      }
    : plannedSpecs[0];

  if (!candidate) {
    return null;
  }

  const prompt = getStructuredPromptForNode(candidate.assignedRole, candidate.nodeType);
  return {
    roleId: candidate.assignedRole,
    roleName: getStructuredRoleDisplayName(candidate.assignedRole, candidate.nodeType),
    nodeType: candidate.nodeType,
    label: candidate.label,
    promptUsed: prompt
      ? {
          title: prompt.title,
          kind: prompt.kind,
          objective: prompt.objective,
        }
      : undefined,
  };
}

export function getCheckpointReviewArtifacts(
  contextTag: ContextTag,
  completedNode: DeepResearchNode,
  nodes: DeepResearchNode[],
  artifacts: DeepResearchArtifact[],
): DeepResearchArtifact[] {
  if (!isLiteratureExecutionContext(contextTag, completedNode, nodes)) {
    return artifacts.filter((artifact) => artifact.nodeId === completedNode.id);
  }

  const relevantNodeIds = new Set(
    nodes
      .filter((node) =>
        node.nodeType === "evidence_gather" &&
        node.contextTag === contextTag &&
        ["completed", "failed", "skipped"].includes(node.status),
      )
      .map((node) => node.id),
  );

  const evidenceArtifacts = artifacts.filter((artifact) =>
    artifact.artifactType === "evidence_card" &&
    Boolean(artifact.nodeId) &&
    relevantNodeIds.has(artifact.nodeId as string),
  );

  return evidenceArtifacts.length > 0
    ? evidenceArtifacts
    : artifacts.filter((artifact) => artifact.nodeId === completedNode.id);
}

export function getEvidencePhaseSummary(
  contextTag: ContextTag,
  nodes: DeepResearchNode[],
  artifacts: DeepResearchArtifact[],
): {
  papersCollected: number;
  retrievalTaskCount: number;
  successfulTaskCount: number;
  failedTaskCount: number;
  emptyTaskCount: number;
} | null {
  const relevantCompletedNode = nodes.find((node) =>
    node.contextTag === contextTag &&
    ["completed", "failed", "skipped"].includes(node.status),
  );
  if (!isLiteratureExecutionContext(contextTag, relevantCompletedNode, nodes)) {
    return null;
  }

  const relevantNodes = nodes.filter((node) =>
    node.nodeType === "evidence_gather" &&
    node.contextTag === contextTag &&
    ["completed", "failed", "skipped"].includes(node.status),
  );

  const artifactByNodeId = new Map(
    artifacts
      .filter((artifact) => artifact.artifactType === "evidence_card" && artifact.nodeId)
      .map((artifact) => [artifact.nodeId as string, artifact]),
  );

  let successfulTaskCount = 0;
  let failedTaskCount = 0;
  let emptyTaskCount = 0;

  for (const node of relevantNodes) {
    if (node.status === "failed") {
      failedTaskCount += 1;
      continue;
    }

    const artifact = artifactByNodeId.get(node.id);
    const sources = Array.isArray(artifact?.content.sources) ? artifact.content.sources : [];
    const totalFound = typeof artifact?.content.totalFound === "number"
      ? artifact.content.totalFound
      : typeof artifact?.content.papersFound === "number"
        ? artifact.content.papersFound
        : sources.length;

    if (Math.max(totalFound, sources.length) > 0) {
      successfulTaskCount += 1;
    } else {
      emptyTaskCount += 1;
    }
  }

  return {
    papersCollected: aggregateSourceCount(artifacts),
    retrievalTaskCount: relevantNodes.length,
    successfulTaskCount,
    failedTaskCount,
    emptyTaskCount,
  };
}

export function applyFinalReportCheckpointGuard(
  checkpointContent: {
    title?: string;
    humanSummary?: string;
    machineSummary?: string;
    mainBrainAudit?: MainBrainAudit;
    currentFindings?: string;
    openQuestions?: string[];
    recommendedNextAction?: string;
    continueWillDo?: string;
    alternativeNextActions?: string[];
  },
  preferredOutputLanguage: string,
): {
  title?: string;
  humanSummary?: string;
  machineSummary?: string;
  mainBrainAudit?: MainBrainAudit;
  currentFindings?: string;
  openQuestions?: string[];
  recommendedNextAction?: string;
  continueWillDo?: string;
  alternativeNextActions?: string[];
} {
  const copy = getFinalReportCheckpointCopy(preferredOutputLanguage);
  return {
    ...checkpointContent,
    recommendedNextAction: copy.recommendedNextAction,
    continueWillDo: copy.continueWillDo,
    alternativeNextActions: copy.alternativeNextActions,
    mainBrainAudit: checkpointContent.mainBrainAudit
      ? {
          ...checkpointContent.mainBrainAudit,
          recommendedNextAction: copy.recommendedNextAction,
          continueWillDo: copy.continueWillDo,
          alternativeActions: checkpointContent.mainBrainAudit.alternativeActions.filter(
            (action) => action.actionType !== "more_literature",
          ),
        }
      : undefined,
  };
}

export function getFinalReportCheckpointCopy(preferredOutputLanguage: string): {
  recommendedNextAction: string;
  continueWillDo: string;
  alternativeNextActions: string[];
} {
  if (preferredOutputLanguage.startsWith("zh")) {
    return {
      recommendedNextAction: "请审阅最终报告，并选择接受为本次研究结论，或提出定向修改意见；不要回退到早期的大范围文献检索轮次。",
      continueWillDo: "继续将把这份最终报告作为当前研究交付物并结束本次会话；如果你希望补充内容，请选择修订并指出需要补充的具体证据或段落。",
      alternativeNextActions: [
        "接受最终报告并结束本次研究",
        "要求定向修订最终报告中的具体段落、论证或证据",
      ],
    };
  }

  return {
    recommendedNextAction: "Review the final report and either accept it as the session outcome or request targeted revisions; do not restart broad literature rounds from earlier phases.",
    continueWillDo: "Continue will finalize this report as the current research deliverable and close the session unless you request targeted revisions.",
    alternativeNextActions: [
      "Accept the final report and close the session",
      "Request targeted revisions to specific sections, claims, or supporting evidence",
    ],
  };
}

function aggregateSourceCount(artifacts: DeepResearchArtifact[]): number {
  return artifacts.reduce((sum, artifact) => {
    const sources = Array.isArray(artifact.content.sources) ? artifact.content.sources : [];
    const totalFound = typeof artifact.content.totalFound === "number"
      ? artifact.content.totalFound
      : typeof artifact.content.papersFound === "number"
        ? artifact.content.papersFound
        : sources.length;
    return sum + Math.max(totalFound, sources.length);
  }, 0);
}

function isLiteratureExecutionContext(
  contextTag: ContextTag,
  completedNode: DeepResearchNode | undefined,
  nodes: DeepResearchNode[],
): boolean {
  if (contextTag !== "planning") {
    return false;
  }

  if (completedNode?.nodeType === "evidence_gather") {
    return true;
  }

  return nodes.some((node) =>
    node.nodeType === "evidence_gather" &&
    node.contextTag === "planning" &&
    ["completed", "failed", "skipped"].includes(node.status),
  );
}
