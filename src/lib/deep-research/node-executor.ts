import { generateText, stepCountIs } from "ai";
import { getModelForRole, getModelChainForRole, checkBudget, trackUsage } from "./model-router";
import * as eventStore from "./event-store";
import {
  buildWorkerSystemPrompt,
  buildReviewerSystemPrompt,
  buildEvidenceGatherPrompt,
  buildMainBrainSystemPrompt,
} from "./prompts";
import { createSearchTools } from "@/lib/ai/tools/search-tools";
import {
  SEARCHABLE_ARTICLE_SOURCES,
  searchArticles as searchArticlesDirect,
} from "@/lib/article-search";
import { buildEvidenceCardFromToolResults } from "./evidence-cards";
import { safeParseJson } from "./json-response";
import { buildResearchContextArchivePromptBlock } from "./context-archive";
import { buildResearchMemoryPromptBlock } from "./memory-fabric";
import { buildResearcherDoctrinePromptBlock } from "./researcher-doctrine";
import { resolveArtifactReferenceIds } from "./artifact-references";
import {
  executeFinalReportNode,
  FinalReportExecutionError,
  isFinalReportExecutionError,
} from "./final-report-runtime";
import {
  buildClaimMapFromStructuredSummary,
  normalizeStructuredSummaryArtifact,
} from "./summary-packets";
import type {
  DeepResearchNode,
  DeepResearchArtifact,
  DeepResearchSession,
  DeepResearchMessage,
  ArtifactType,
  ArtifactProvenance,
} from "./types";

interface ExecutionContext {
  session: DeepResearchSession;
  messages: DeepResearchMessage[];
  allNodes: DeepResearchNode[];
  allArtifacts: DeepResearchArtifact[];
}

interface ExecutionResult {
  output: Record<string, unknown>;
  artifacts: DeepResearchArtifact[];
  tokensUsed: number;
}

export {
  FinalReportExecutionError,
  isFinalReportExecutionError,
};

/**
 * Execute a single node: resolve model, build prompt, call LLM, persist results.
 */
export async function executeNode(
  node: DeepResearchNode,
  ctx: ExecutionContext,
  abortSignal?: AbortSignal
): Promise<ExecutionResult> {
  const config = ctx.session.config;
  const budget = ctx.session.budget;

  // Check budget
  const budgetCheck = checkBudget(node.assignedRole, budget, config.budget);
  if (!budgetCheck.allowed) {
    throw new Error(`Budget exceeded: ${budgetCheck.reason}`);
  }

  // Resolve model chain for runtime fallback
  const modelChain = getModelChainForRole(node.assignedRole, config);
  if (modelChain.length === 0) {
    // Fallback to single model (will throw if none available)
    const single = getModelForRole(node.assignedRole, config);
    modelChain.push(single);
  }

  // Try each model in the chain until one succeeds
  let lastError: Error | null = null;
  for (let i = 0; i < modelChain.length; i++) {
    const { model, provider, modelId } = modelChain[i];

    // Mark node as running with current model
    await eventStore.updateNode(node.id, {
      status: "running",
      assignedModel: `${provider}/${modelId}`,
      startedAt: new Date().toISOString(),
    });

    try {
      const result = await executeByNodeType(node, ctx, model, abortSignal);

      // Mark node as completed
      await eventStore.updateNode(node.id, {
        status: "completed",
        output: result.output,
        completedAt: new Date().toISOString(),
      });

      // Create artifacts
      const createdArtifacts: DeepResearchArtifact[] = [];
      for (const art of result.artifacts) {
        const created = await eventStore.createArtifact(
          ctx.session.id,
          node.id,
          art.artifactType,
          art.title,
          art.content,
          art.provenance ?? undefined
        );
        createdArtifacts.push(created);
      }

      // Track token usage
      const updatedBudget = trackUsage(budget, node.assignedRole, node.id, result.tokensUsed);
      await eventStore.updateSession(ctx.session.id, { budget: updatedBudget });

      return {
        output: result.output,
        artifacts: createdArtifacts,
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isLast = i === modelChain.length - 1;
      if (!isLast) {
        const next = modelChain[i + 1];
        console.warn(
          `[node-executor] ${provider}/${modelId} failed for node ${node.id}: ${lastError.message}. ` +
          `Falling back to ${next.provider}/${next.modelId}...`
        );
        // Reset node status for retry with next model
        await eventStore.updateNode(node.id, { status: "pending" });
      }
    }
  }

  // All models failed
  const message = lastError?.message ?? "Unknown execution error";
  await eventStore.updateNode(node.id, {
    status: "failed",
    error: `All models failed. Last error: ${message}`,
    completedAt: new Date().toISOString(),
  });
  throw lastError ?? new Error(message);
}

// --- Node type dispatch ---

async function executeByNodeType(
  node: DeepResearchNode,
  ctx: ExecutionContext,
  model: ReturnType<typeof getModelForRole>["model"],
  abortSignal?: AbortSignal
): Promise<{
  output: Record<string, unknown>;
  artifacts: Array<{
    artifactType: ArtifactType;
    title: string;
    content: Record<string, unknown>;
    provenance: ArtifactProvenance | null;
  }>;
  tokensUsed: number;
}> {
  const dependencyArtifacts = ctx.allArtifacts.filter(
    (a) => a.nodeId && node.dependsOn.includes(a.nodeId)
  );
  const referencedArtifacts = resolveReferencedArtifacts(node.input, ctx.allArtifacts);
  const parentArtifacts = mergeArtifactsById(dependencyArtifacts, referencedArtifacts);

  switch (node.nodeType) {
    // Main brain nodes
    case "intake":
    case "plan":
    case "synthesize":
      return executeBrainNode(node, ctx, model, abortSignal);

    case "final_report":
      return executeFinalReportNode(node, ctx, model, abortSignal);

    // Worker evidence nodes
    case "evidence_gather":
      return executeEvidenceGather(node, parentArtifacts, model, abortSignal);

    case "evidence_extract":
      return executeWorkerTask(node, parentArtifacts, model, abortSignal, "evidence_card");

    // Worker summary/synthesis
    case "summarize":
      return executeSummarize(node, parentArtifacts, model, abortSignal);

    // Reviewer nodes
    case "review":
      return executeReview(node, ctx.allArtifacts, model, abortSignal);

    // Main brain audit
    case "audit":
      return executeBrainNode(node, ctx, model, abortSignal);

    // Validation planning (main brain)
    case "validation_plan":
      return executeBrainNode(node, ctx, model, abortSignal);

    // Resource request (worker)
    case "resource_request":
      return executeWorkerTask(node, parentArtifacts, model, abortSignal, "execution_manifest");

    // Execution (worker)
    case "execute":
      return executeWorkerTask(node, parentArtifacts, model, abortSignal, "step_result");

    // Monitoring (worker)
    case "monitor":
      return executeWorkerTask(node, parentArtifacts, model, abortSignal, "step_result");

    // Result collection (worker)
    case "result_collect":
      return executeWorkerTask(node, parentArtifacts, model, abortSignal, "experiment_result");

    // Result comparison (main brain)
    case "result_compare":
      return executeBrainNode(node, ctx, model, abortSignal);

    // Approval nodes — handled by orchestrator
    case "approve":
      return {
        output: { status: "awaiting_approval" },
        artifacts: [],
        tokensUsed: 0,
      };

    default:
      return executeGeneric(node, parentArtifacts, model, abortSignal);
  }
}

// --- Executor implementations ---

async function executeBrainNode(
  node: DeepResearchNode,
  ctx: ExecutionContext,
  model: ReturnType<typeof getModelForRole>["model"],
  abortSignal?: AbortSignal
) {
  const memoryContext = buildResearchMemoryPromptBlock({
    session: ctx.session,
    messages: ctx.messages,
    artifacts: ctx.allArtifacts,
    query: `${node.nodeType} ${node.label}`.trim(),
  });
  const archiveContext = await buildResearchContextArchivePromptBlock({
    session: ctx.session,
    messages: ctx.messages,
    artifacts: ctx.allArtifacts,
    query: `${node.nodeType} ${node.label}`.trim(),
    topK: 5,
    maxChars: 2200,
  });
  const doctrineContext = await buildResearcherDoctrinePromptBlock({
    contextTag: ctx.session.contextTag,
    query: `${node.nodeType} ${node.label}`.trim(),
  });
  const combinedMemoryContext = [memoryContext, archiveContext]
    .filter((block): block is string => typeof block === "string" && block.length > 0)
    .join("\n\n");
  const systemPrompt = buildMainBrainSystemPrompt(
    ctx.session,
    ctx.messages,
    ctx.allNodes,
    ctx.allArtifacts,
    ctx.session.contextTag,
    undefined,
    undefined,
    combinedMemoryContext || null,
    doctrineContext,
  );

  const taskPrompt = node.input
    ? JSON.stringify(node.input)
    : `Execute the ${node.nodeType} task: ${node.label}`;

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: taskPrompt }],
    abortSignal,
  });

  const output = safeParseJson(result.text);
  const artifactType = getArtifactTypeForNode(node.nodeType);

  // For final_report nodes, extract the actual report text
  let artifactContent = output;
  if (node.nodeType === "final_report") {
    const reportText = (output.messageToUser as string)
      || (output.report as string)
      || (output.text as string)
      || result.text;
    artifactContent = { report: reportText, ...output };
  }

  const artifacts = artifactType
    ? [{
        artifactType,
        title: node.label,
        content: artifactContent,
        provenance: {
          sourceNodeId: node.id,
          sourceArtifactIds: [],
          model: node.assignedModel || "unknown",
          generatedAt: new Date().toISOString(),
        } as ArtifactProvenance,
      }]
    : [];

  return {
    output,
    artifacts,
    tokensUsed: result.usage?.totalTokens ?? 0,
  };
}

async function executeEvidenceGather(
  node: DeepResearchNode,
  parentArtifacts: DeepResearchArtifact[],
  model: ReturnType<typeof getModelForRole>["model"],
  abortSignal?: AbortSignal
) {
  const input = (node.input as Record<string, unknown>) ?? {};
  const query = (input.query as string)
    || (input.researchQuestion as string)
    || node.label;
  const maxSources = (input.maxPapers as number) || (input.maxSources as number) || 10;
  const focusAreas = input.focusAreas as string[] | undefined;

  const systemPrompt = buildWorkerSystemPrompt(node, parentArtifacts, "evidence_gather");
  const userPrompt = buildEvidenceGatherPrompt(query, { maxSources, focusAreas });

  const searchTools = createSearchTools();

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    tools: searchTools,
    stopWhen: stepCountIs(15),
    abortSignal,
  });

  // Log tool call statistics for debugging
  const toolCalls = result.steps?.flatMap(s => s.toolCalls ?? []) ?? [];
  const toolResults = result.steps?.flatMap(s => s.toolResults ?? []) ?? [];
  console.log(
    `[evidence-gather] node=${node.id} toolCalls=${toolCalls.length} toolResults=${toolResults.length} steps=${result.steps?.length ?? 0}`
  );

  let output = safeParseJson(result.text);
  let recoveredFrom = "";

  const directSearchResults = await maybeRunDeterministicSearchFallback(
    query,
    focusAreas,
    maxSources,
    toolResults,
  );
  const effectiveToolResults = directSearchResults ?? toolResults;
  const recoveredCard = buildEvidenceCardFromToolResults(effectiveToolResults, query);
  const searchQueries = extractSearchQueries(toolCalls, query, focusAreas);

  if (!hasMeaningfulEvidencePayload(output)) {
    output = buildEvidenceOutputFromCard(
      recoveredCard,
      query,
      searchQueries,
      recoveredCard.sourcesFound > 0
        ? "Recovered evidence card from search results after model failed to emit valid JSON."
        : "No usable sources were retrieved for this query.",
      result.text,
    );
    recoveredFrom = directSearchResults ? "deterministic_search_fallback" : "tool_results";
  } else {
    output = mergeEvidenceOutputWithCard(output, recoveredCard, query, searchQueries);
    if (countEvidenceSources(output) === 0 && recoveredCard.sourcesFound > 0) {
      output = buildEvidenceOutputFromCard(
        recoveredCard,
        query,
        searchQueries,
        "Recovered evidence card from search results because model output omitted retrieved sources.",
        result.text,
      );
      recoveredFrom = directSearchResults ? "deterministic_search_fallback" : "tool_results";
    }
  }

  if (recoveredFrom) {
    output.recoveredFrom = recoveredFrom;
  }

  return {
    output,
    artifacts: [{
      artifactType: "evidence_card" as ArtifactType,
      title: `Evidence: ${node.label}`,
      content: output,
      provenance: {
        sourceNodeId: node.id,
        sourceArtifactIds: parentArtifacts.map((a) => a.id),
        model: node.assignedModel || "unknown",
        generatedAt: new Date().toISOString(),
      } as ArtifactProvenance,
    }],
    tokensUsed: result.usage?.totalTokens ?? 0,
  };
}

async function executeSummarize(
  node: DeepResearchNode,
  parentArtifacts: DeepResearchArtifact[],
  model: ReturnType<typeof getModelForRole>["model"],
  abortSignal?: AbortSignal
) {
  const systemPrompt = buildWorkerSystemPrompt(node, parentArtifacts, "summarize");
  const userPrompt = `Summarize and synthesize the evidence from the provided artifacts for: ${node.label}`;

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    abortSignal,
  });

  const rawOutput = safeParseJson(result.text);
  const output = normalizeStructuredSummaryArtifact({
    rawOutput,
    parentArtifacts,
    label: node.label,
  });
  const claimMap = buildClaimMapFromStructuredSummary(output, parentArtifacts);

  return {
    output: output as unknown as Record<string, unknown>,
    artifacts: [{
      artifactType: "structured_summary" as ArtifactType,
      title: `Summary: ${node.label}`,
      content: output as unknown as Record<string, unknown>,
      provenance: {
        sourceNodeId: node.id,
        sourceArtifactIds: parentArtifacts.map((a) => a.id),
        model: node.assignedModel || "unknown",
        generatedAt: new Date().toISOString(),
      } as ArtifactProvenance,
    }, {
      artifactType: "claim_map" as ArtifactType,
      title: `Claim Map: ${node.label}`,
      content: claimMap as unknown as Record<string, unknown>,
      provenance: {
        sourceNodeId: node.id,
        sourceArtifactIds: parentArtifacts.map((a) => a.id),
        model: node.assignedModel || "unknown",
        generatedAt: new Date().toISOString(),
      } as ArtifactProvenance,
    }],
    tokensUsed: result.usage?.totalTokens ?? 0,
  };
}

async function executeReview(
  node: DeepResearchNode,
  allArtifacts: DeepResearchArtifact[],
  model: ReturnType<typeof getModelForRole>["model"],
  abortSignal?: AbortSignal
) {
  const role = node.assignedRole as "results_and_evidence_analyst";

  // Target: summaries, evidence cards, execution results, provisional conclusions
  const targetArtifacts = allArtifacts.filter((a) =>
    ["structured_summary", "evidence_card", "step_result", "provisional_conclusion", "experiment_result"].includes(a.artifactType)
  );

  // Previous reviewer packets for multi-round reviews
  const previousPackets = allArtifacts.filter((a) => a.artifactType === "reviewer_packet");

  const systemPrompt = buildReviewerSystemPrompt(role, targetArtifacts, previousPackets);

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: "Please review the provided artifacts and produce your assessment." }],
    abortSignal,
  });

  const output = safeParseJson(result.text);

  return {
    output,
    artifacts: [{
      artifactType: "reviewer_packet" as ArtifactType,
      title: "Review by Results and Evidence Analyst",
      content: output,
      provenance: {
        sourceNodeId: node.id,
        sourceArtifactIds: targetArtifacts.map((a) => a.id),
        model: node.assignedModel || "unknown",
        generatedAt: new Date().toISOString(),
      } as ArtifactProvenance,
    }],
    tokensUsed: result.usage?.totalTokens ?? 0,
  };
}

/**
 * Generic worker task executor with configurable artifact type.
 */
async function executeWorkerTask(
  node: DeepResearchNode,
  parentArtifacts: DeepResearchArtifact[],
  model: ReturnType<typeof getModelForRole>["model"],
  abortSignal?: AbortSignal,
  artifactType: ArtifactType = "step_result"
) {
  const systemPrompt = buildWorkerSystemPrompt(node, parentArtifacts, node.nodeType);
  const taskPrompt = node.input
    ? JSON.stringify(node.input)
    : `Execute the task: ${node.label}`;

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: taskPrompt }],
    abortSignal,
  });

  const output = safeParseJson(result.text);

  return {
    output,
    artifacts: [{
      artifactType,
      title: `Result: ${node.label}`,
      content: output,
      provenance: {
        sourceNodeId: node.id,
        sourceArtifactIds: parentArtifacts.map((a) => a.id),
        model: node.assignedModel || "unknown",
        generatedAt: new Date().toISOString(),
      } as ArtifactProvenance,
    }],
    tokensUsed: result.usage?.totalTokens ?? 0,
  };
}

async function executeGeneric(
  node: DeepResearchNode,
  parentArtifacts: DeepResearchArtifact[],
  model: ReturnType<typeof getModelForRole>["model"],
  abortSignal?: AbortSignal
) {
  const systemPrompt = buildWorkerSystemPrompt(node, parentArtifacts, node.nodeType);
  const taskPrompt = node.input
    ? JSON.stringify(node.input)
    : `Execute: ${node.label}`;

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: taskPrompt }],
    abortSignal,
  });

  return {
    output: safeParseJson(result.text),
    artifacts: [],
    tokensUsed: result.usage?.totalTokens ?? 0,
  };
}

// --- Helpers ---

function getArtifactTypeForNode(nodeType: string): ArtifactType | null {
  const map: Record<string, ArtifactType> = {
    intake: "research_brief",
    plan: "task_graph",
    synthesize: "provisional_conclusion",
    validation_plan: "validation_plan",
    result_compare: "validation_report",
    final_report: "final_report",
  };
  return map[nodeType] ?? null;
}

async function maybeRunDeterministicSearchFallback(
  query: string,
  focusAreas: string[] | undefined,
  maxSources: number,
  existingToolResults: unknown[],
): Promise<Array<{ output: { articles: unknown[]; totalCount: number } }> | null> {
  const recoveredCard = buildEvidenceCardFromToolResults(existingToolResults, query);
  if (recoveredCard.sourcesFound > 0) {
    return null;
  }

  const keywords = buildFallbackKeywords(query, focusAreas);
  if (keywords.length === 0) {
    return null;
  }

  try {
    const searchResult = await searchArticlesDirect({
      keywords,
      maxResults: Math.min(Math.max(maxSources, 1), 10),
      sources: [...SEARCHABLE_ARTICLE_SOURCES],
    });
    return [{
      output: {
        articles: searchResult.articles,
        totalCount: searchResult.totalCount,
      },
    }];
  } catch (error) {
    console.warn(`[evidence-gather] deterministic fallback search failed for query "${query}":`, error);
    return null;
  }
}

function buildFallbackKeywords(query: string, focusAreas: string[] | undefined): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "about", "into", "using", "used",
    "research", "search", "literature", "papers", "paper", "find", "gather", "related",
  ]);

  const focusTokens = (focusAreas ?? [])
    .flatMap((area) => area.replace(/[_-]/g, " ").split(/\s+/))
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 2);

  const queryTokens = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));

  return [...new Set([...focusTokens, ...queryTokens])].slice(0, 4);
}

function resolveReferencedArtifacts(
  input: Record<string, unknown> | null | undefined,
  allArtifacts: DeepResearchArtifact[],
): DeepResearchArtifact[] {
  const resolvedIds = new Set(resolveArtifactReferenceIds(input, allArtifacts));
  if (resolvedIds.size === 0) {
    return [];
  }

  return allArtifacts.filter((artifact) => resolvedIds.has(artifact.id));
}

function mergeArtifactsById(
  primaryArtifacts: DeepResearchArtifact[],
  secondaryArtifacts: DeepResearchArtifact[],
): DeepResearchArtifact[] {
  const merged: DeepResearchArtifact[] = [];
  const seen = new Set<string>();

  for (const artifact of [...primaryArtifacts, ...secondaryArtifacts]) {
    if (seen.has(artifact.id)) {
      continue;
    }
    seen.add(artifact.id);
    merged.push(artifact);
  }

  return merged;
}

function extractSearchQueries(
  toolCalls: Array<{ toolName?: string; input?: unknown }>,
  query: string,
  focusAreas: string[] | undefined,
): string[] {
  const queries: string[] = [];

  for (const call of toolCalls) {
    if (call.toolName !== "searchArticles" || !call.input || typeof call.input !== "object") {
      continue;
    }
    const keywords = Array.isArray((call.input as { keywords?: unknown[] }).keywords)
      ? ((call.input as { keywords?: unknown[] }).keywords as unknown[])
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    if (keywords.length > 0) {
      queries.push(keywords.join(" "));
    }
  }

  if (queries.length > 0) {
    return [...new Set(queries)];
  }

  const fallbackKeywords = buildFallbackKeywords(query, focusAreas);
  return fallbackKeywords.length > 0 ? [fallbackKeywords.join(" ")] : [query];
}

function hasMeaningfulEvidencePayload(output: Record<string, unknown> | null | undefined): boolean {
  if (!output) return false;
  return countEvidenceSources(output) > 0
    || typeof output.totalFound === "number"
    || typeof output.papersFound === "number"
    || typeof output.sourcesFound === "number"
    || Array.isArray(output.rawExcerpts)
    || typeof output.retrievalStatus === "string";
}

function countEvidenceSources(output: Record<string, unknown>): number {
  if (Array.isArray(output.sources)) {
    return output.sources.length;
  }
  if (typeof output.totalFound === "number") {
    return output.totalFound;
  }
  if (typeof output.papersFound === "number") {
    return output.papersFound;
  }
  if (typeof output.sourcesFound === "number") {
    return output.sourcesFound;
  }
  return 0;
}

function buildEvidenceOutputFromCard(
  card: ReturnType<typeof buildEvidenceCardFromToolResults>,
  query: string,
  searchQueries: string[],
  coverageSummary: string,
  rawResponseText?: string,
): Record<string, unknown> {
  return {
    query,
    sources: card.sources,
    rawExcerpts: card.rawExcerpts,
    retrievalStatus: card.retrievalStatus,
    sourcesFound: card.sourcesFound,
    sourcesAttempted: card.sourcesAttempted,
    retrievalNotes: card.retrievalNotes,
    totalFound: card.sourcesFound,
    searchQueries,
    coverageSummary,
    rawResponseText: rawResponseText && rawResponseText.trim().length > 0 ? rawResponseText.slice(0, 2000) : undefined,
    createdAt: card.createdAt,
  };
}

function mergeEvidenceOutputWithCard(
  output: Record<string, unknown>,
  card: ReturnType<typeof buildEvidenceCardFromToolResults>,
  query: string,
  searchQueries: string[],
): Record<string, unknown> {
  const sourceCount = countEvidenceSources(output);
  const retrievalStatus = typeof output.retrievalStatus === "string"
    ? output.retrievalStatus
    : sourceCount > 0
      ? "success"
      : card.retrievalStatus;

  return {
    ...output,
    query: typeof output.query === "string" ? output.query : query,
    rawExcerpts: Array.isArray(output.rawExcerpts) ? output.rawExcerpts : card.rawExcerpts,
    sourcesFound: typeof output.sourcesFound === "number" ? output.sourcesFound : sourceCount,
    sourcesAttempted: typeof output.sourcesAttempted === "number" ? output.sourcesAttempted : card.sourcesAttempted,
    retrievalStatus,
    retrievalNotes: typeof output.retrievalNotes === "string" ? output.retrievalNotes : card.retrievalNotes,
    totalFound: typeof output.totalFound === "number"
      ? output.totalFound
      : typeof output.papersFound === "number"
        ? output.papersFound
        : sourceCount,
    searchQueries: Array.isArray(output.searchQueries) ? output.searchQueries : searchQueries,
    coverageSummary: typeof output.coverageSummary === "string"
      ? output.coverageSummary
      : sourceCount > 0
        ? `Retrieved ${sourceCount} relevant source(s).`
        : "No usable sources were retrieved for this query.",
  };
}
