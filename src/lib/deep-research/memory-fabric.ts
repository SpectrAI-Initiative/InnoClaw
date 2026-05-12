import * as store from "./event-store";
import type {
  ArtifactProvenance,
  CheckpointPackage,
  ClaimMap,
  DeepResearchArtifact,
  DeepResearchMessage,
  DeepResearchSession,
  EvidenceCard,
  RequirementState,
  ResearchMemoryIndex,
  ResearchMemoryItem,
  ResearchMemoryProfile,
  ResearchMemoryRetrievalResult,
  ResearchMemorySnapshot,
  ReviewAssessment,
} from "./types";

interface MemoryBuildState {
  session: DeepResearchSession;
  messages: DeepResearchMessage[];
  artifacts: DeepResearchArtifact[];
  requirementState?: RequirementState | null;
}

interface ConsolidateOptions {
  triggerNodeId?: string;
  requirementState?: RequirementState | null;
}

interface PromptBlockOptions extends MemoryBuildState {
  query: string;
  topK?: number;
}

interface ResolvedMemoryState {
  profile: ResearchMemoryProfile;
  snapshot: ResearchMemorySnapshot;
  index: ResearchMemoryIndex;
}

const MEMORY_TITLE_LIMIT = 120;
const MEMORY_SUMMARY_LIMIT = 280;

export async function consolidateResearchMemory(
  sessionId: string,
  options: ConsolidateOptions = {},
): Promise<{
  profile: ResearchMemoryProfile;
  snapshot: ResearchMemorySnapshot;
  index: ResearchMemoryIndex;
  artifacts: DeepResearchArtifact[];
}> {
  const session = await store.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const requirementState = options.requirementState ?? await store.getLatestRequirementState(sessionId);
  const messages = await store.getMessages(sessionId);
  const artifacts = await store.getArtifacts(sessionId);
  const buildState: MemoryBuildState = { session, messages, artifacts, requirementState };
  const profile = buildResearchMemoryProfile(buildState);
  const items = buildResearchMemoryItems(buildState);
  const snapshot = buildResearchMemorySnapshot(buildState, profile, items);
  const index = buildResearchMemoryIndex(sessionId, items);

  const provenance = options.triggerNodeId
    ? ({
        sourceNodeId: options.triggerNodeId,
        sourceArtifactIds: artifacts
          .filter((artifact) => !isMemoryArtifactType(artifact.artifactType))
          .slice(-12)
          .map((artifact) => artifact.id),
        model: "system_memory_fabric",
        generatedAt: new Date().toISOString(),
      } satisfies ArtifactProvenance)
    : undefined;

  const createdArtifacts = await Promise.all([
    store.createArtifact(
      sessionId,
      options.triggerNodeId ?? null,
      "memory_profile",
      `Memory Profile (${profile.currentPhase})`,
      profile as unknown as Record<string, unknown>,
      provenance,
    ),
    store.createArtifact(
      sessionId,
      options.triggerNodeId ?? null,
      "memory_snapshot",
      snapshot.title,
      snapshot as unknown as Record<string, unknown>,
      provenance,
    ),
    store.createArtifact(
      sessionId,
      options.triggerNodeId ?? null,
      "memory_index",
      `Memory Index (${index.itemCount} items)`,
      index as unknown as Record<string, unknown>,
      provenance,
    ),
  ]);

  return {
    profile,
    snapshot,
    index,
    artifacts: createdArtifacts,
  };
}

export function buildResearchMemoryPromptBlock({
  session,
  messages,
  artifacts,
  requirementState,
  query,
  topK = 8,
}: PromptBlockOptions): string | null {
  const resolved = resolveMemoryState({ session, messages, artifacts, requirementState });
  const retrieval = retrieveResearchMemory({
    session,
    messages,
    artifacts,
    requirementState,
    query,
    topK,
  });

  const lines: string[] = [];
  lines.push("## Memory Fabric");
  lines.push("- Note: Memory entries are derived retrieval pointers. For scientific claims, verify the linked source artifacts before relying on them.");
  lines.push(`- Objective: ${resolved.profile.objective}`);
  lines.push(`- Current phase: ${resolved.profile.currentPhase}`);
  if (resolved.profile.latestRecommendedNextAction) {
    lines.push(`- Latest recommended next action: ${resolved.profile.latestRecommendedNextAction}`);
  }
  if (resolved.profile.activeRequirements.length > 0) {
    lines.push(`- Active requirements: ${resolved.profile.activeRequirements.join("; ")}`);
  }
  if (resolved.profile.activeConstraints.length > 0) {
    lines.push(`- Active constraints: ${resolved.profile.activeConstraints.join("; ")}`);
  }
  if (resolved.profile.openQuestions.length > 0) {
    lines.push(`- Open questions: ${resolved.profile.openQuestions.join("; ")}`);
  }
  lines.push("");
  lines.push("### Latest Snapshot");
  lines.push(`- ${resolved.snapshot.summary}`);
  if (resolved.snapshot.nextStep) {
    lines.push(`- Next step: ${resolved.snapshot.nextStep}`);
  }
  if (resolved.snapshot.unresolvedGaps.length > 0) {
    lines.push(`- Unresolved gaps: ${resolved.snapshot.unresolvedGaps.join("; ")}`);
  }
  if (retrieval.items.length > 0) {
    lines.push("");
    lines.push(`### Retrieved Memories For "${query}"`);
    for (const item of retrieval.items) {
      const anchorSummary = formatMemoryAnchors(item);
      lines.push(
        `- [${item.kind}/${item.category}] ${item.title}: ${item.summary} ` +
        `${anchorSummary ? `[${anchorSummary}] ` : ""}` +
        `(importance=${item.importance.toFixed(2)}, confidence=${item.confidence.toFixed(2)}, score=${item.retrievalScore.toFixed(2)})`
      );
    }
  }

  return lines.join("\n");
}

export function retrieveResearchMemory({
  session,
  messages,
  artifacts,
  requirementState,
  query,
  topK = 8,
}: PromptBlockOptions): ResearchMemoryRetrievalResult {
  const resolved = resolveMemoryState({ session, messages, artifacts, requirementState });
  const scoredItems = resolved.index.items
    .map((item) => ({
      ...item,
      retrievalScore: scoreMemoryItem(item, query),
    }))
    .filter((item) => item.retrievalScore > 0)
    .sort((a, b) => b.retrievalScore - a.retrievalScore)
    .slice(0, topK);

  return {
    profile: resolved.profile,
    snapshot: resolved.snapshot,
    items: scoredItems,
    query,
  };
}

function buildResearchMemoryProfile({
  session,
  artifacts,
  requirementState,
}: MemoryBuildState): ResearchMemoryProfile {
  const checkpoint = latestArtifactContent<CheckpointPackage>(artifacts, "checkpoint");
  const taskGraph = latestArtifactContent<Record<string, unknown>>(artifacts, "task_graph");
  const claimMap = latestArtifactContent<ClaimMap>(artifacts, "claim_map");
  const researchBrief = latestArtifactContent<Record<string, unknown>>(artifacts, "research_brief");
  const review = latestArtifactContent<ReviewAssessment>(artifacts, "review_assessment");

  const objective = requirementState?.currentApprovedGoal
    || readStringFromRecord(researchBrief, ["objective", "goal", "researchGoal", "question", "query", "title"])
    || session.title;

  const activeRequirements = requirementState?.requirements
    .filter((req) => req.status === "active")
    .map((req) => req.text) ?? [];

  const activeConstraints = requirementState?.constraints
    .filter((constraint) => constraint.status === "active")
    .map((constraint) => `${constraint.type}: ${constraint.text}${constraint.value ? ` (${constraint.value})` : ""}`) ?? [];

  const latestPlanSummary = taskGraph
    ? formatTaskGraphSummary(taskGraph)
    : undefined;

  const openQuestions = dedupeStrings([
    ...(checkpoint?.openQuestions ?? []),
    ...((claimMap?.gaps ?? []).map((gap) => gap.topic)),
    ...(review?.literatureGaps ?? []),
  ]).slice(0, 8);

  const activeHypotheses = dedupeStrings([
    ...((claimMap?.claims ?? [])
      .filter((claim) => claim.strength === "strong" || claim.strength === "moderate")
      .slice(0, 4)
      .map((claim) => claim.text)),
  ]);

  const keyDecisions = dedupeStrings([
    checkpoint?.recommendedNextAction ?? "",
    checkpoint?.continueWillDo ?? "",
    review ? `Reviewer verdict: ${review.combinedVerdict}` : "",
  ]).slice(0, 6);

  return {
    sessionId: session.id,
    generatedAt: new Date().toISOString(),
    objective,
    currentPhase: session.contextTag,
    latestCheckpointTitle: checkpoint?.title,
    latestRecommendedNextAction: checkpoint?.recommendedNextAction,
    activeRequirements,
    activeConstraints,
    openQuestions,
    activeHypotheses,
    latestPlanSummary,
    keyDecisions,
  };
}

function buildResearchMemoryItems(
  { messages, artifacts }: MemoryBuildState,
): ResearchMemoryItem[] {
  const items: ResearchMemoryItem[] = [];

  const recentUserMessages = messages.filter((message) => message.role === "user").slice(-6);
  for (const message of recentUserMessages) {
    items.push({
      id: `msg:${message.id}`,
      kind: "semantic",
      category: "user_goal",
      title: truncateText(`User intent at ${message.createdAt}`, MEMORY_TITLE_LIMIT),
      summary: truncateText(message.content, MEMORY_SUMMARY_LIMIT),
      tags: ["user", "intent"],
      keywords: extractKeywords(message.content),
      importance: 0.95,
      confidence: 0.95,
      status: "active",
      createdAt: message.createdAt,
      updatedAt: message.createdAt,
      provenance: {
        sourceType: "message",
        messageId: message.id,
      },
      anchors: [{
        messageId: message.id,
        field: "content",
      }],
    });
  }

  const evidenceArtifacts = artifacts.filter((artifact) => artifact.artifactType === "evidence_card");
  for (const artifact of evidenceArtifacts.slice(-12)) {
    const card = artifact.content as unknown as EvidenceCard;
    const sourceTitle = card.sources?.[0]?.title ?? "unknown source";
    items.push({
      id: `artifact:${artifact.id}:overview`,
      kind: "semantic",
      category: "evidence",
      title: truncateText(`Evidence for ${card.query || artifact.title}`, MEMORY_TITLE_LIMIT),
      summary: truncateText(
        `${card.sourcesFound ?? card.sources?.length ?? 0} source(s), status=${card.retrievalStatus}, representative source=${sourceTitle}. ${card.retrievalNotes ?? ""}`,
        MEMORY_SUMMARY_LIMIT,
      ),
      details: truncateText((card.rawExcerpts ?? []).map((excerpt) => excerpt.text).join("\n\n"), 800),
      tags: dedupeStrings([card.retrievalStatus ?? "", "evidence", ...(extractKeywords(card.query ?? ""))]).slice(0, 8),
      keywords: dedupeStrings([
        ...extractKeywords(card.query ?? ""),
        ...(card.sources ?? []).flatMap((source) => extractKeywords(source.title)),
      ]).slice(0, 12),
      importance: card.retrievalStatus === "success" ? 0.82 : 0.7,
      confidence: clamp01((card.sourcesFound ?? card.sources?.length ?? 0) / Math.max(card.sourcesAttempted ?? 1, 1)),
      status: "active",
      createdAt: artifact.createdAt,
      updatedAt: artifact.createdAt,
      provenance: {
        sourceType: "artifact",
        artifactId: artifact.id,
        nodeId: artifact.nodeId ?? undefined,
      },
      anchors: [{
        artifactId: artifact.id,
        artifactType: artifact.artifactType,
        nodeId: artifact.nodeId ?? undefined,
        field: "overview",
        note: card.query,
      }],
    });

    for (const [excerptIndex, excerpt] of (card.rawExcerpts ?? []).slice(0, 2).entries()) {
      const source = card.sources?.[excerpt.sourceIndex];
      items.push({
        id: `artifact:${artifact.id}:excerpt:${excerptIndex}`,
        kind: "semantic",
        category: "evidence",
        title: truncateText(source?.title ?? `Evidence excerpt ${excerptIndex + 1}`, MEMORY_TITLE_LIMIT),
        summary: truncateText(excerpt.text, MEMORY_SUMMARY_LIMIT),
        tags: dedupeStrings(["evidence_excerpt", excerpt.section ?? "", source?.venue ?? ""]).filter(Boolean),
        keywords: dedupeStrings([
          ...extractKeywords(excerpt.text),
          ...extractKeywords(source?.title ?? ""),
        ]).slice(0, 12),
        importance: 0.72,
        confidence: clamp01((card.sourcesFound ?? 1) / Math.max(card.sourcesAttempted ?? 1, 1)),
        status: "active",
        createdAt: artifact.createdAt,
        updatedAt: artifact.createdAt,
        provenance: {
          sourceType: "artifact",
          artifactId: artifact.id,
          nodeId: artifact.nodeId ?? undefined,
        },
        anchors: [{
          artifactId: artifact.id,
          artifactType: artifact.artifactType,
          nodeId: artifact.nodeId ?? undefined,
          sourceIndex: excerpt.sourceIndex,
          excerptIndex,
          field: excerpt.section ?? "rawExcerpts",
          note: source?.title,
        }],
      });
    }
  }

  const latestClaimMapArtifact = latestArtifact(artifacts, "claim_map");
  if (latestClaimMapArtifact) {
    const claimMap = latestClaimMapArtifact.content as unknown as ClaimMap;
    for (const claim of claimMap.claims.slice(0, 12)) {
      items.push({
        id: `artifact:${latestClaimMapArtifact.id}:claim:${claim.id}`,
        kind: "semantic",
        category: "claim",
        title: truncateText(claim.text, MEMORY_TITLE_LIMIT),
        summary: truncateText(
          `Claim strength=${claim.strength}, knowledge=${claim.knowledgeType}, supports=${claim.supportingSources.join(",") || "none"}.`,
          MEMORY_SUMMARY_LIMIT,
        ),
        tags: dedupeStrings([claim.category, claim.strength, claim.knowledgeType]),
        keywords: extractKeywords(claim.text),
        importance: claim.strength === "strong" ? 0.92 : claim.strength === "moderate" ? 0.82 : 0.68,
        confidence: claim.strength === "strong" ? 0.95 : claim.strength === "moderate" ? 0.8 : 0.55,
        status: "active",
        createdAt: latestClaimMapArtifact.createdAt,
        updatedAt: latestClaimMapArtifact.createdAt,
        provenance: {
          sourceType: "artifact",
          artifactId: latestClaimMapArtifact.id,
          nodeId: latestClaimMapArtifact.nodeId ?? undefined,
        },
        anchors: [{
          artifactId: latestClaimMapArtifact.id,
          artifactType: latestClaimMapArtifact.artifactType,
          nodeId: latestClaimMapArtifact.nodeId ?? undefined,
          claimId: claim.id,
          field: "claims",
          note: `supports=${claim.supportingSources.join(",") || "none"}`,
        }],
      });
    }

    for (const [index, gap] of claimMap.gaps.slice(0, 10).entries()) {
      items.push({
        id: `artifact:${latestClaimMapArtifact.id}:gap:${index}`,
        kind: "semantic",
        category: "gap",
        title: truncateText(gap.topic, MEMORY_TITLE_LIMIT),
        summary: truncateText(
          `${gap.description} Suggested queries: ${gap.suggestedQueries.join("; ")}`,
          MEMORY_SUMMARY_LIMIT,
        ),
        tags: dedupeStrings(["gap", gap.priority]),
        keywords: dedupeStrings([
          ...extractKeywords(gap.topic),
          ...gap.suggestedQueries.flatMap((query) => extractKeywords(query)),
        ]).slice(0, 12),
        importance: gap.priority === "high" ? 0.9 : gap.priority === "medium" ? 0.75 : 0.6,
        confidence: 0.7,
        status: "active",
        createdAt: latestClaimMapArtifact.createdAt,
        updatedAt: latestClaimMapArtifact.createdAt,
        provenance: {
          sourceType: "artifact",
          artifactId: latestClaimMapArtifact.id,
          nodeId: latestClaimMapArtifact.nodeId ?? undefined,
        },
        anchors: [{
          artifactId: latestClaimMapArtifact.id,
          artifactType: latestClaimMapArtifact.artifactType,
          nodeId: latestClaimMapArtifact.nodeId ?? undefined,
          gapIndex: index,
          field: "gaps",
        }],
      });
    }
  }

  const checkpointArtifacts = artifacts.filter((artifact) => artifact.artifactType === "checkpoint").slice(-6);
  for (const artifact of checkpointArtifacts) {
    const checkpoint = artifact.content as unknown as CheckpointPackage;
    items.push({
      id: `artifact:${artifact.id}:checkpoint`,
      kind: "episodic",
      category: "decision",
      title: truncateText(checkpoint.title, MEMORY_TITLE_LIMIT),
      summary: truncateText(
        `${checkpoint.humanSummary} Recommended next: ${checkpoint.recommendedNextAction}`,
        MEMORY_SUMMARY_LIMIT,
      ),
      tags: dedupeStrings([checkpoint.contextTag, checkpoint.stepType, "checkpoint"]),
      keywords: dedupeStrings([
        ...extractKeywords(checkpoint.title),
        ...extractKeywords(checkpoint.recommendedNextAction),
      ]).slice(0, 12),
      importance: checkpoint.mainBrainAudit?.canProceed ? 0.82 : 0.9,
      confidence: checkpoint.mainBrainAudit?.canProceed ? 0.82 : 0.66,
      status: "active",
      createdAt: artifact.createdAt,
      updatedAt: artifact.createdAt,
      provenance: {
        sourceType: "artifact",
        artifactId: artifact.id,
        nodeId: artifact.nodeId ?? undefined,
      },
      anchors: [{
        artifactId: artifact.id,
        artifactType: artifact.artifactType,
        nodeId: artifact.nodeId ?? undefined,
        field: "recommendedNextAction",
      }],
    });
  }

  const latestReviewArtifact = latestArtifact(artifacts, "review_assessment");
  if (latestReviewArtifact) {
    const review = latestReviewArtifact.content as unknown as ReviewAssessment;
    items.push({
      id: `artifact:${latestReviewArtifact.id}:review`,
      kind: "episodic",
      category: "decision",
      title: truncateText(`Review verdict: ${review.combinedVerdict}`, MEMORY_TITLE_LIMIT),
      summary: truncateText(
        `${review.reviewerSummary ?? ""} Open issues: ${(review.openIssues ?? []).join("; ")}`.trim(),
        MEMORY_SUMMARY_LIMIT,
      ),
      tags: dedupeStrings(["review", review.combinedVerdict, review.needsMoreLiterature ? "needs_literature" : ""]),
      keywords: dedupeStrings([
        ...extractKeywords(review.reviewerSummary ?? ""),
        ...(review.literatureGaps ?? []).flatMap((gap) => extractKeywords(gap)),
      ]).slice(0, 12),
      importance: 0.84,
      confidence: clamp01(review.combinedConfidence),
      status: "active",
      createdAt: latestReviewArtifact.createdAt,
      updatedAt: latestReviewArtifact.createdAt,
      provenance: {
        sourceType: "artifact",
        artifactId: latestReviewArtifact.id,
        nodeId: latestReviewArtifact.nodeId ?? undefined,
      },
      anchors: [{
        artifactId: latestReviewArtifact.id,
        artifactType: latestReviewArtifact.artifactType,
        nodeId: latestReviewArtifact.nodeId ?? undefined,
        field: "reviewerSummary",
      }],
    });
  }

  const latestValidationPlan = latestArtifact(artifacts, "validation_plan");
  if (latestValidationPlan) {
    const content = latestValidationPlan.content;
    const steps = Array.isArray(content.steps) ? content.steps as Array<Record<string, unknown>> : [];
    items.push({
      id: `artifact:${latestValidationPlan.id}:workflow`,
      kind: "procedural",
      category: "workflow",
      title: truncateText(String(content.objective ?? latestValidationPlan.title), MEMORY_TITLE_LIMIT),
      summary: truncateText(
        `Validation workflow with ${steps.length} step(s). Expected outputs: ${Array.isArray(content.expectedOutputs) ? content.expectedOutputs.join("; ") : "not specified"}`,
        MEMORY_SUMMARY_LIMIT,
      ),
      tags: ["validation", "workflow", "procedural"],
      keywords: dedupeStrings([
        ...extractKeywords(String(content.objective ?? "")),
        ...steps.flatMap((step) => extractKeywords(String(step.description ?? step.label ?? ""))),
      ]).slice(0, 12),
      importance: 0.74,
      confidence: 0.78,
      status: "active",
      createdAt: latestValidationPlan.createdAt,
      updatedAt: latestValidationPlan.createdAt,
      provenance: {
        sourceType: "artifact",
        artifactId: latestValidationPlan.id,
        nodeId: latestValidationPlan.nodeId ?? undefined,
      },
      anchors: [{
        artifactId: latestValidationPlan.id,
        artifactType: latestValidationPlan.artifactType,
        nodeId: latestValidationPlan.nodeId ?? undefined,
        field: "steps",
      }],
    });
  }

  return dedupeMemoryItems(items);
}

function buildResearchMemorySnapshot(
  { artifacts }: MemoryBuildState,
  profile: ResearchMemoryProfile,
  items: ResearchMemoryItem[],
): ResearchMemorySnapshot {
  const latestClaimMap = latestArtifactContent<ClaimMap>(artifacts, "claim_map");
  const latestReview = latestArtifactContent<ReviewAssessment>(artifacts, "review_assessment");
  const acceptedFacts = dedupeStrings([
    ...profile.activeHypotheses,
    ...items
      .filter((item) => item.category === "evidence" || item.category === "claim")
      .slice(0, 5)
      .map((item) => item.title),
  ]).slice(0, 6);
  const contestedFacts = dedupeStrings([
    ...((latestClaimMap?.contradictions ?? []).map((contradiction) => contradiction.description)),
    ...(latestReview?.openIssues ?? []),
  ]).slice(0, 6);
  const unresolvedGaps = dedupeStrings([
    ...profile.openQuestions,
    ...((latestClaimMap?.gaps ?? []).map((gap) => gap.topic)),
    ...(latestReview?.literatureGaps ?? []),
  ]).slice(0, 8);
  const focusAreas = dedupeStrings(items.flatMap((item) => item.tags)).slice(0, 8);
  const relatedArtifactIds = dedupeStrings(
    items
      .map((item) => item.provenance.artifactId)
      .filter((artifactId): artifactId is string => typeof artifactId === "string"),
  ).slice(0, 16);
  const summaryParts = [
    `Current objective: ${profile.objective}.`,
    profile.latestRecommendedNextAction ? `Next recommended action: ${profile.latestRecommendedNextAction}.` : "",
    acceptedFacts.length > 0 ? `Accepted facts: ${acceptedFacts.slice(0, 3).join("; ")}.` : "",
    unresolvedGaps.length > 0 ? `Open gaps: ${unresolvedGaps.slice(0, 3).join("; ")}.` : "",
  ].filter(Boolean);

  return {
    sessionId: profile.sessionId,
    generatedAt: new Date().toISOString(),
    title: `Memory Snapshot: ${truncateText(profile.objective, 60)}`,
    summary: summaryParts.join(" "),
    acceptedFacts,
    contestedFacts,
    unresolvedGaps,
    nextStep: profile.latestRecommendedNextAction ?? profile.latestPlanSummary ?? "Continue the approved research workflow.",
    focusAreas,
    relatedArtifactIds,
  };
}

function buildResearchMemoryIndex(sessionId: string, items: ResearchMemoryItem[]): ResearchMemoryIndex {
  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    itemCount: items.length,
    sourceOfTruth: "artifacts_and_messages",
    items,
    stats: {
      semanticCount: items.filter((item) => item.kind === "semantic").length,
      episodicCount: items.filter((item) => item.kind === "episodic").length,
      proceduralCount: items.filter((item) => item.kind === "procedural").length,
      activeCount: items.filter((item) => item.status === "active").length,
    },
  };
}

function resolveMemoryState(buildState: MemoryBuildState): ResolvedMemoryState {
  const persistedProfileArtifact = latestArtifact(buildState.artifacts, "memory_profile");
  const persistedSnapshotArtifact = latestArtifact(buildState.artifacts, "memory_snapshot");
  const persistedIndexArtifact = latestArtifact(buildState.artifacts, "memory_index");

  if (
    persistedProfileArtifact
    && persistedSnapshotArtifact
    && persistedIndexArtifact
    && isPersistedMemoryFresh(buildState, [
      persistedProfileArtifact.createdAt,
      persistedSnapshotArtifact.createdAt,
      persistedIndexArtifact.createdAt,
    ])
  ) {
    return {
      profile: persistedProfileArtifact.content as unknown as ResearchMemoryProfile,
      snapshot: persistedSnapshotArtifact.content as unknown as ResearchMemorySnapshot,
      index: persistedIndexArtifact.content as unknown as ResearchMemoryIndex,
    };
  }

  const profile = buildResearchMemoryProfile(buildState);
  const items = buildResearchMemoryItems(buildState);
  const snapshot = buildResearchMemorySnapshot(buildState, profile, items);
  const index = buildResearchMemoryIndex(buildState.session.id, items);
  return { profile, snapshot, index };
}

function latestArtifact(artifacts: DeepResearchArtifact[], artifactType: DeepResearchArtifact["artifactType"]): DeepResearchArtifact | null {
  const matches = artifacts.filter((artifact) => artifact.artifactType === artifactType);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function latestArtifactContent<T>(artifacts: DeepResearchArtifact[], artifactType: DeepResearchArtifact["artifactType"]): T | null {
  return latestArtifact(artifacts, artifactType)?.content as T | null;
}

function isPersistedMemoryFresh(
  buildState: MemoryBuildState,
  memoryArtifactTimestamps: string[],
): boolean {
  const latestSourceTimestamp = maxIsoTimestamp([
    buildState.session.updatedAt,
    buildState.requirementState?.lastModifiedAt ?? null,
    ...buildState.messages.map((message) => message.createdAt),
    ...buildState.artifacts
      .filter((artifact) => !isMemoryArtifactType(artifact.artifactType))
      .map((artifact) => artifact.createdAt),
  ]);
  const oldestMemoryTimestamp = minIsoTimestamp(memoryArtifactTimestamps);
  if (!latestSourceTimestamp || !oldestMemoryTimestamp) {
    return false;
  }
  return oldestMemoryTimestamp >= latestSourceTimestamp;
}

function isMemoryArtifactType(artifactType: DeepResearchArtifact["artifactType"]): boolean {
  return artifactType.startsWith("memory_");
}

function formatTaskGraphSummary(taskGraph: Record<string, unknown>): string {
  const nextTask = typeof taskGraph.nextTask === "string" ? taskGraph.nextTask : "";
  const nextTaskCount = typeof taskGraph.nextTaskCount === "number"
    ? taskGraph.nextTaskCount
    : typeof taskGraph.totalNodes === "number"
      ? taskGraph.totalNodes
      : Array.isArray(taskGraph.proposedNodeSpecs)
        ? taskGraph.proposedNodeSpecs.length
        : 0;
  if (nextTask && nextTaskCount > 0) {
    return `${nextTask} (${nextTaskCount} planned node(s))`;
  }
  if (nextTask) {
    return nextTask;
  }
  if (nextTaskCount > 0) {
    return `${nextTaskCount} planned node(s) ready for dispatch`;
  }
  return "No explicit next-task summary available.";
}

function scoreMemoryItem(item: ResearchMemoryItem, query: string): number {
  const queryTokens = extractKeywords(query);
  if (queryTokens.length === 0) {
    return 0.1 + item.importance + item.confidence;
  }

  const memoryTokens = new Set([
    ...extractKeywords(item.title),
    ...extractKeywords(item.summary),
    ...item.keywords,
    ...item.tags.flatMap((tag) => extractKeywords(tag)),
  ]);
  let overlap = 0;
  for (const token of queryTokens) {
    if (memoryTokens.has(token)) {
      overlap += 1;
    }
  }

  const recencyBonus = computeRecencyBonus(item.updatedAt);
  const categoryBonus = item.category === "evidence" || item.category === "claim" ? 0.4 : 0;
  return overlap * 2.8 + item.importance * 1.8 + item.confidence * 1.4 + recencyBonus + categoryBonus;
}

function formatMemoryAnchors(item: ResearchMemoryItem): string {
  if (!item.anchors || item.anchors.length === 0) {
    return "";
  }
  return item.anchors.slice(0, 2).map((anchor) => {
    if (anchor.artifactId) {
      const parts = [anchor.artifactType ?? "artifact", anchor.artifactId];
      if (typeof anchor.sourceIndex === "number") {
        parts.push(`source#${anchor.sourceIndex + 1}`);
      }
      if (typeof anchor.excerptIndex === "number") {
        parts.push(`excerpt#${anchor.excerptIndex + 1}`);
      }
      if (anchor.claimId) {
        parts.push(`claim:${anchor.claimId}`);
      }
      if (typeof anchor.gapIndex === "number") {
        parts.push(`gap#${anchor.gapIndex + 1}`);
      }
      if (anchor.field) {
        parts.push(anchor.field);
      }
      return parts.join("/");
    }
    if (anchor.messageId) {
      return `message/${anchor.messageId}${anchor.field ? `/${anchor.field}` : ""}`;
    }
    return anchor.note ?? "anchor";
  }).join(" | ");
}

function computeRecencyBonus(timestamp: string): number {
  const ageMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return 0.3;
  }
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 1) return 1.2;
  if (ageDays <= 7) return 0.9;
  if (ageDays <= 30) return 0.45;
  return 0.1;
}

function dedupeMemoryItems(items: ResearchMemoryItem[]): ResearchMemoryItem[] {
  const byFingerprint = new Map<string, ResearchMemoryItem>();
  for (const item of items) {
    const fingerprint = `${item.category}|${item.title}|${item.summary}`;
    const existing = byFingerprint.get(fingerprint);
    if (!existing || existing.updatedAt < item.updatedAt) {
      byFingerprint.set(fingerprint, item);
    }
  }
  return [...byFingerprint.values()].sort((a, b) => b.importance - a.importance);
}

function extractKeywords(value: string): string[] {
  return dedupeStrings(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

function readStringFromRecord(
  record: Record<string, unknown> | null,
  keys: string[],
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function maxIsoTimestamp(values: Array<string | null | undefined>): string | null {
  const filtered = values.filter((value): value is string => typeof value === "string" && value.length > 0);
  if (filtered.length === 0) {
    return null;
  }
  return filtered.reduce((latest, current) => (current > latest ? current : latest));
}

function minIsoTimestamp(values: Array<string | null | undefined>): string | null {
  const filtered = values.filter((value): value is string => typeof value === "string" && value.length > 0);
  if (filtered.length === 0) {
    return null;
  }
  return filtered.reduce((earliest, current) => (current < earliest ? current : earliest));
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "been",
  "between",
  "from",
  "have",
  "into",
  "just",
  "more",
  "most",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "using",
  "with",
  "without",
  "what",
  "when",
  "where",
  "which",
  "while",
  "would",
  "research",
  "study",
  "session",
  "node",
  "task",
]);
