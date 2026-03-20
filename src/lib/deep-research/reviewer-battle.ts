// =============================================================
// Deep Research — Multi-Round Reviewer Battle (Phase 4)
// =============================================================

import { generateText } from "ai";
import { getModelForRole, checkBudget, trackUsage } from "./model-router";
import * as store from "./event-store";
import { executeNode } from "./node-executor";
import {
  buildReviewerSystemPrompt,
  buildReviewerBattleSynthesisPrompt,
} from "./prompts";
import type {
  DeepResearchSession,
  DeepResearchArtifact,
  ReviewerPacket,
  ReviewerBattleResult,
  ReviewerBattleResultExtended,
  ReviewerRound,
} from "./types";

export interface ReviewerBattleConfig {
  maxRounds: number;
  convergenceThreshold: number;
}

const DEFAULT_BATTLE_CONFIG: ReviewerBattleConfig = {
  maxRounds: 3,
  convergenceThreshold: 0.7,
};

/**
 * Run a multi-round reviewer battle with convergence checking.
 */
export async function runReviewerBattle(
  sessionId: string,
  targetArtifacts: DeepResearchArtifact[],
  config: ReviewerBattleConfig = DEFAULT_BATTLE_CONFIG,
  abortSignal?: AbortSignal
): Promise<ReviewerBattleResultExtended> {
  const session = await store.getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const rounds: ReviewerRound[] = [];
  let convergedAtRound: number | null = null;

  await store.appendEvent(sessionId, "reviewer_battle_started", undefined, "system", undefined, undefined, {
    maxRounds: config.maxRounds,
  });

  for (let roundNum = 1; roundNum <= config.maxRounds; roundNum++) {
    if (abortSignal?.aborted) throw new Error("Aborted");

    const previousPacketArtifacts = roundNum > 1
      ? await store.getArtifacts(sessionId, { type: "reviewer_packet" })
      : [];

    // Create reviewer nodes for this round
    const reviewerA = await store.createNode(sessionId, {
      nodeType: "review",
      label: `Reviewer A: Round ${roundNum} ${roundNum > 1 ? "rebuttal" : "critique"}`,
      assignedRole: "reviewer_a",
      input: { round: roundNum, isRebuttal: roundNum > 1 },
      phase: session.phase,
    });

    const reviewerB = await store.createNode(sessionId, {
      nodeType: "review",
      label: `Reviewer B: Round ${roundNum} ${roundNum > 1 ? "rebuttal" : "critique"}`,
      assignedRole: "reviewer_b",
      input: { round: roundNum, isRebuttal: roundNum > 1 },
      phase: session.phase,
    });

    // Execute both reviewers in parallel
    const ctx = {
      session,
      messages: await store.getMessages(sessionId),
      allNodes: await store.getNodes(sessionId),
      allArtifacts: await store.getArtifacts(sessionId),
    };

    await Promise.allSettled([
      executeNode(reviewerA, ctx, abortSignal),
      executeNode(reviewerB, ctx, abortSignal),
    ]);

    // Collect packets
    const artifacts = await store.getArtifacts(sessionId);
    const aPacketArt = artifacts.filter(a => a.nodeId === reviewerA.id && a.artifactType === "reviewer_packet")[0];
    const bPacketArt = artifacts.filter(a => a.nodeId === reviewerB.id && a.artifactType === "reviewer_packet")[0];

    const aPacket: ReviewerPacket = aPacketArt
      ? (aPacketArt.content as unknown as ReviewerPacket)
      : { reviewerRole: "reviewer_a", verdict: "revise", critique: "No response", suggestions: [], confidence: 0 };

    const bPacket: ReviewerPacket = bPacketArt
      ? (bPacketArt.content as unknown as ReviewerPacket)
      : { reviewerRole: "reviewer_b", verdict: "revise", critique: "No response", suggestions: [], confidence: 0 };

    rounds.push({ round: roundNum, reviewerAPacket: aPacket, reviewerBPacket: bPacket });

    // Check convergence
    if (checkConvergence(aPacket, bPacket, config.convergenceThreshold)) {
      convergedAtRound = roundNum;
      break;
    }
  }

  // Synthesize battle result
  const allPacketArtifacts = await store.getArtifacts(sessionId, { type: "reviewer_packet" });
  const synthesisArtifacts = (await store.getArtifacts(sessionId)).filter(a =>
    ["structured_summary", "provisional_conclusion"].includes(a.artifactType)
  );

  const baseResult = await synthesizeBattle(session, allPacketArtifacts, synthesisArtifacts, abortSignal);

  const extendedResult: ReviewerBattleResultExtended = {
    ...baseResult,
    rounds,
    convergedAtRound,
    agreementScore: computeAgreementScore(rounds),
  };

  // Save battle result artifact
  await store.createArtifact(
    sessionId,
    null,
    "reviewer_battle_result",
    `Reviewer Battle Result (${rounds.length} rounds)`,
    extendedResult as unknown as Record<string, unknown>
  );

  await store.appendEvent(sessionId, "reviewer_battle_completed", undefined, "system", undefined, undefined, {
    rounds: rounds.length,
    converged: convergedAtRound !== null,
    convergedAtRound,
    agreementScore: extendedResult.agreementScore,
  });

  return extendedResult;
}

/**
 * Check if two reviewer packets have converged.
 * Convergence = same verdict AND both confidence above threshold.
 */
function checkConvergence(
  aPacket: ReviewerPacket,
  bPacket: ReviewerPacket,
  threshold: number
): boolean {
  if (aPacket.verdict !== bPacket.verdict) return false;
  if (aPacket.confidence < threshold || bPacket.confidence < threshold) return false;
  return true;
}

/**
 * Compute an agreement score from all rounds.
 * 1.0 = perfect agreement, 0.0 = complete disagreement.
 */
function computeAgreementScore(rounds: ReviewerRound[]): number {
  if (rounds.length === 0) return 0;

  let totalScore = 0;
  for (const round of rounds) {
    const a = round.reviewerAPacket;
    const b = round.reviewerBPacket;

    // Verdict agreement: +0.5
    if (a.verdict === b.verdict) totalScore += 0.5;

    // Confidence proximity: +0.5 * (1 - |diff|)
    const confDiff = Math.abs(a.confidence - b.confidence);
    totalScore += 0.5 * (1 - confDiff);
  }

  return totalScore / rounds.length;
}

/**
 * Synthesize all reviewer packets into a battle result using the main brain.
 */
async function synthesizeBattle(
  session: DeepResearchSession,
  packetArtifacts: DeepResearchArtifact[],
  synthesisArtifacts: DeepResearchArtifact[],
  abortSignal?: AbortSignal
): Promise<ReviewerBattleResult> {
  if (packetArtifacts.length < 2) {
    return createFallbackBattleResult(packetArtifacts);
  }

  const { model } = getModelForRole("main_brain", session.config);
  const budgetCheck = checkBudget("main_brain", session.budget, session.config.budget);

  if (!budgetCheck.allowed) {
    return createFallbackBattleResult(packetArtifacts);
  }

  // Use the latest packets from each reviewer
  const aPackets = packetArtifacts.filter(a =>
    (a.content as unknown as ReviewerPacket).reviewerRole === "reviewer_a"
  );
  const bPackets = packetArtifacts.filter(a =>
    (a.content as unknown as ReviewerPacket).reviewerRole === "reviewer_b"
  );

  const latestA = aPackets[aPackets.length - 1];
  const latestB = bPackets[bPackets.length - 1];

  if (!latestA || !latestB) {
    return createFallbackBattleResult(packetArtifacts);
  }

  const prompt = buildReviewerBattleSynthesisPrompt(latestA, latestB, synthesisArtifacts);

  try {
    const result = await generateText({
      model,
      system: "You are the Main Brain. Synthesize the multi-round reviewer debate. Respond with JSON.",
      messages: [{ role: "user", content: prompt }],
      abortSignal,
    });

    const budget = trackUsage(session.budget, "main_brain", "battle_synth", result.usage?.totalTokens ?? 0);
    await store.updateSession(session.id, { budget });

    const parsed = extractJsonFromText<ReviewerBattleResult>(result.text);
    if (parsed) return parsed;
  } catch (err) {
    console.error("[deep-research] Battle synthesis failed:", err);
  }

  return createFallbackBattleResult(packetArtifacts);
}

function createFallbackBattleResult(packetArtifacts: DeepResearchArtifact[]): ReviewerBattleResult {
  return {
    reviewerAPosition: packetArtifacts[0] ? JSON.stringify(packetArtifacts[0].content).slice(0, 200) : "No response",
    reviewerBPosition: packetArtifacts[1] ? JSON.stringify(packetArtifacts[1].content).slice(0, 200) : "No response",
    agreements: [],
    disagreements: ["Could not synthesize reviewer debate"],
    rebuttalHighlights: [],
    unresolvedGaps: [],
    combinedVerdict: "revise",
    combinedConfidence: 0.5,
    uncertaintyReducers: [],
    needsMoreLiterature: false,
    literatureGaps: [],
    needsExperimentalValidation: false,
    suggestedExperiments: [],
  };
}

function extractJsonFromText<T>(text: string): T | null {
  try {
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) return JSON.parse(fenceMatch[1].trim()) as T;

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
          if (depth === 0) return JSON.parse(text.slice(firstBrace, i + 1)) as T;
        }
      }
    }

    return JSON.parse(text.trim()) as T;
  } catch {
    return null;
  }
}
