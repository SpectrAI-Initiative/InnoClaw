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
  const parentArtifacts = ctx.allArtifacts.filter(
    (a) => a.nodeId && node.dependsOn.includes(a.nodeId)
  );

  switch (node.nodeType) {
    // Main brain nodes
    case "intake":
    case "plan":
    case "synthesize":
    case "final_report":
      return executeBrainNode(node, ctx, model, abortSignal);

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
    case "deliberate":
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
  const systemPrompt = buildMainBrainSystemPrompt(
    ctx.session,
    ctx.messages,
    ctx.allNodes,
    ctx.allArtifacts,
    ctx.session.phase
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

  // Extract articles from tool results as fallback if LLM text parsing fails
  let output = safeParseJson(result.text);
  if (!output || (typeof output === "object" && Object.keys(output).length === 0)) {
    // Try to build output from tool results directly
    const allArticles: unknown[] = [];
    for (const tr of toolResults) {
      const res = (tr as { output?: unknown }).output as { articles?: unknown[]; totalCount?: number } | undefined;
      if (res?.articles && Array.isArray(res.articles)) {
        allArticles.push(...res.articles);
      }
    }
    if (allArticles.length > 0) {
      output = {
        sources: allArticles,
        totalFound: allArticles.length,
        query,
        note: "Extracted directly from search tool results",
      };
    } else {
      output = {
        sources: [],
        totalFound: 0,
        query,
        rawText: result.text?.slice(0, 2000) || "No response text",
        note: "No articles found via search tools",
      };
    }
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

  const output = { summary: result.text };

  return {
    output,
    artifacts: [{
      artifactType: "structured_summary" as ArtifactType,
      title: `Summary: ${node.label}`,
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

async function executeReview(
  node: DeepResearchNode,
  allArtifacts: DeepResearchArtifact[],
  model: ReturnType<typeof getModelForRole>["model"],
  abortSignal?: AbortSignal
) {
  const role = node.assignedRole as "reviewer_a" | "reviewer_b";

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
      title: `Review by ${role === "reviewer_a" ? "Reviewer A" : "Reviewer B"}`,
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

function safeParseJson(text: string): Record<string, unknown> {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
    return JSON.parse(jsonStr);
  } catch {
    return { text };
  }
}
