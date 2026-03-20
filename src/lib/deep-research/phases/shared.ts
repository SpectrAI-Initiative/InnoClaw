// =============================================================
// Shared utilities for phase handlers
// =============================================================

import { generateText } from "ai";
import { getModelForRole, checkBudget, trackUsage } from "../model-router";
import * as store from "../event-store";
import { executeNode } from "../node-executor";
import {
  buildMainBrainSystemPrompt,
} from "../prompts";
import type {
  DeepResearchSession,
  DeepResearchNode,
  BrainDecision,
  Phase,
  NodeCreationSpec,
  RequirementState,
  PhaseContext,
} from "../types";

export async function buildNodeContext(sessionId: string) {
  const session = (await store.getSession(sessionId))!;
  const messages = await store.getMessages(sessionId);
  const allNodes = await store.getNodes(sessionId);
  const allArtifacts = await store.getArtifacts(sessionId);
  return { session, messages, allNodes, allArtifacts };
}

export async function callMainBrain(
  session: DeepResearchSession,
  abortSignal?: AbortSignal,
  requirementState?: RequirementState | null,
  languageHint?: string
): Promise<BrainDecision> {
  const budgetCheck = checkBudget("main_brain", session.budget, session.config.budget);
  if (!budgetCheck.allowed) {
    return {
      action: "complete",
      messageToUser: "Budget limit reached. Generating final report.",
    };
  }

  const messages = await store.getMessages(session.id);
  const nodes = await store.getNodes(session.id);
  const artifacts = await store.getArtifacts(session.id);

  const { model } = getModelForRole("main_brain", session.config);
  let systemPrompt = buildMainBrainSystemPrompt(session, messages, nodes, artifacts, session.phase, requirementState);

  // Add language instruction if user writes in non-English
  if (!languageHint) {
    const userMessages = messages.filter(m => m.role === "user");
    const lastUserMsg = userMessages[userMessages.length - 1];
    if (lastUserMsg) {
      const cjkChars = lastUserMsg.content.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
      if (cjkChars && cjkChars.length > lastUserMsg.content.replace(/\s/g, "").length * 0.1) {
        languageHint = "zh";
      }
    }
  }
  if (languageHint && languageHint !== "en") {
    systemPrompt += `\n\nIMPORTANT: The user communicates in ${languageHint}. Write any messageToUser content in ${languageHint}. Technical terms may remain in English.`;
  }

  const userMsg = messages.length > 0
    ? "Continue orchestrating the research based on current state and any new user messages."
    : "Begin processing the user's research request.";

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
    abortSignal,
  });

  const budget = trackUsage(session.budget, "main_brain", `brain_${session.phase}`, result.usage?.totalTokens ?? 0);
  await store.updateSession(session.id, { budget });

  try {
    return extractJsonFromLLMResponse<BrainDecision>(result.text);
  } catch {
    return { action: "respond_to_user", messageToUser: result.text };
  }
}

export async function createNodesFromSpecs(
  sessionId: string,
  specs: NodeCreationSpec[],
  defaultPhase: Phase
): Promise<DeepResearchNode[]> {
  const created: DeepResearchNode[] = [];
  for (const spec of specs) {
    const node = await store.createNode(sessionId, {
      ...spec,
      phase: spec.phase ?? defaultPhase,
    });
    created.push(node);
  }
  return created;
}

export async function executeReadyWorkers(
  session: DeepResearchSession,
  abortSignal?: AbortSignal
): Promise<void> {
  const maxConcurrent = session.config.maxWorkerConcurrency;
  let readyNodes = await store.getReadyNodes(session.id);
  if (readyNodes.length === 0) return;

  let ctx = await buildNodeContext(session.id);

  while (readyNodes.length > 0) {
    if (abortSignal?.aborted) throw new Error("Aborted");

    const batch = readyNodes.slice(0, maxConcurrent);
    await Promise.allSettled(
      batch.map((node) => executeNode(node, ctx, abortSignal))
    );

    ctx = await buildNodeContext(session.id);
    readyNodes = await store.getReadyNodes(session.id);
  }
}

function extractJsonFromLLMResponse<T>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim()) as T;
  }

  const firstBrace = text.indexOf("{");
  if (firstBrace >= 0) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(text.slice(firstBrace, i + 1)) as T;
        }
      }
    }
  }

  return JSON.parse(text.trim()) as T;
}
