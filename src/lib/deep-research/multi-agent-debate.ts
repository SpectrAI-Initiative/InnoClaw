// =============================================================
// Deep Research — Multi-Agent Debate Orchestrator
// =============================================================
// Structured multi-perspective debate for hypothesis generation,
// result analysis, and peer review.
// Ported from AutoResearchClaw's agents/base.py.
//
// Roles: Moderator, Skeptic, Librarian, Reproducer, Scribe

import { generateText } from "ai";
import type { LanguageModel } from "ai";
import { safeParseJson } from "./json-response";
import type {
  DeepResearchArtifact,
  DebateRound,
  DebateRecord,
  DebateAgentOutput,
  DebateRole,
} from "./types";
import { DEFAULT_DEBATE_CONFIG } from "./config-types";
import type { DebateConfig } from "./config-types";

// =============================================================
// Role System Prompts
// =============================================================

const ROLE_PROMPTS: Record<DebateRole, string> = {
  moderator: `You are the Debate Moderator. Your role is to:
1. Frame the debate topic clearly
2. Ensure all perspectives are heard fairly
3. Identify areas of agreement and disagreement
4. Summarize the debate and propose a consensus
5. Keep the discussion focused and evidence-based

Rules:
- Be neutral and fair to all viewpoints
- Call out unsupported claims
- Ensure the debate stays on topic
- Produce a structured summary at the end

Output as JSON:
{
  "perspective": "Your moderator perspective",
  "arguments": ["argument 1", "argument 2"],
  "evidenceRefs": ["source references"],
  "confidenceScore": 0.8,
  "suggestedActions": ["action 1"],
  "consensusSummary": "Summary of agreement reached",
  "dissentingViews": ["dissenting view 1"],
  "unresolvedIssues": ["issue 1"]
}`,

  skeptic: `You are the Debate Skeptic. Your role is to:
1. Challenge assumptions and claims rigorously
2. Identify methodological weaknesses
3. Point out alternative explanations
4. Question the validity and generalizability of findings
5. Demand stronger evidence where appropriate

Rules:
- Be constructive in criticism — suggest improvements
- Question everything but don't be contrarian for its own sake
- Focus on scientific rigor and statistical validity
- Identify potential confounders and biases

Output as JSON:
{
  "perspective": "Your skeptical critique",
  "arguments": ["challenge 1", "challenge 2"],
  "evidenceRefs": ["references supporting your skepticism"],
  "confidenceScore": 0.7,
  "suggestedActions": ["improvement 1"]
}`,

  librarian: `You are the Debate Librarian. Your role is to:
1. Bring in relevant prior work and literature
2. Compare claims against established knowledge
3. Identify gaps in the literature review
4. Suggest additional papers or sources to consult
5. Fact-check claims against known published results

Rules:
- Only cite works you are confident exist
- Mark uncertain references as [needs verification]
- Connect new ideas to existing research landscape
- Identify whether proposed work is truly novel

Output as JSON:
{
  "perspective": "Your literature-based perspective",
  "arguments": ["literature-based point 1", "point 2"],
  "evidenceRefs": ["Author (Year) - Title", "Author2 (Year) - Title2"],
  "confidenceScore": 0.8,
  "suggestedActions": ["suggested reading 1"]
}`,

  reproducer: `You are the Debate Reproducer. Your role is to:
1. Assess whether proposed experiments are reproducible
2. Identify missing implementation details
3. Evaluate data and code availability requirements
4. Estimate computational resources needed
5. Flag potential reproducibility issues

Rules:
- Be specific about what's needed for reproduction
- Identify ambiguous or underspecified methods
- Consider both code and data reproducibility
- Estimate resource requirements realistically

Output as JSON:
{
  "perspective": "Your reproducibility assessment",
  "arguments": ["issue 1", "issue 2"],
  "evidenceRefs": ["references"],
  "confidenceScore": 0.7,
  "suggestedActions": ["improvement 1"]
}`,

  scribe: `You are the Debate Scribe. Your role is to:
1. Synthesize all perspectives into a coherent final summary
2. Distill key insights and action items
3. Record areas of consensus and remaining disagreement
4. Produce a polished debate record
5. Prioritize action items by importance

Rules:
- Be comprehensive but concise
- Accurately represent all viewpoints
- Highlight the most impactful insights
- Produce actionable recommendations

Output as JSON:
{
  "perspective": "Your synthesis of all perspectives",
  "arguments": ["key finding 1", "key finding 2"],
  "evidenceRefs": ["consolidated references"],
  "confidenceScore": 0.85,
  "suggestedActions": ["top priority action 1", "action 2"]
}`,
};

// =============================================================
// Debate Orchestrator
// =============================================================

const DEFAULT_DEBATE_ROLES: DebateRole[] = ["moderator", "skeptic", "librarian", "reproducer", "scribe"];

const DEBATE_ROLE_ALIASES: Record<string, DebateRole> = {
  moderator: "moderator",
  debate_moderator: "moderator",
  skeptic: "skeptic",
  debate_skeptic: "skeptic",
  librarian: "librarian",
  debate_librarian: "librarian",
  reproducer: "reproducer",
  debate_reproducer: "reproducer",
  scribe: "scribe",
  debate_scribe: "scribe",
};

function normalizeDebateRoles(enabledRoles: string[]): DebateRole[] {
  const roles = enabledRoles
    .map((role) => DEBATE_ROLE_ALIASES[role])
    .filter((role): role is DebateRole => Boolean(role));
  const uniqueRoles = [...new Set(roles)];
  return uniqueRoles.length > 0 ? uniqueRoles : DEFAULT_DEBATE_ROLES;
}

async function runAgentRound(
  role: DebateRole,
  topic: string,
  previousRoundSummary: string,
  parentArtifacts: DeepResearchArtifact[],
  model: LanguageModel,
): Promise<DebateAgentOutput> {
  const systemPrompt = ROLE_PROMPTS[role];

  const artifactContext =
    parentArtifacts.length > 0
      ? `\n\nRelevant evidence/context:\n${parentArtifacts
          .map(
            (a) =>
              `[${a.artifactType}] ${a.title}: ${JSON.stringify(a.content).slice(0, 500)}`,
          )
          .join("\n\n")}`
      : "";

  const previousContext = previousRoundSummary
    ? `\n\nPrevious round summary:\n${previousRoundSummary}`
    : "";

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Debate Topic: ${topic}${artifactContext}${previousContext}\n\nProvide your perspective as the ${role}. Output as JSON.`,
      },
    ],
    maxOutputTokens: 2048,
  });

  const parsed = safeParseJson(result.text);

  return {
    role,
    perspective: (parsed.perspective as string) ?? `No perspective from ${role}`,
    arguments: (parsed.arguments as string[]) ?? [],
    evidenceRefs: (parsed.evidenceRefs as string[]) ?? [],
    confidenceScore: (parsed.confidenceScore as number) ?? 0.5,
    suggestedActions: (parsed.suggestedActions as string[]) ?? [],
  };
}

/**
 * Run a multi-agent debate on a research topic.
 * Each round: all agents provide perspectives, moderator summarizes.
 */
export async function runMultiAgentDebate(
  topic: string,
  parentArtifacts: DeepResearchArtifact[],
  config: Partial<DebateConfig> | undefined,
  model: LanguageModel,
): Promise<DebateRecord> {
  const cfg = { ...DEFAULT_DEBATE_CONFIG, ...config };
  const roles = normalizeDebateRoles(cfg.enabledRoles);

  const rounds: DebateRound[] = [];
  let previousSummary = "";
  let consensusReached = false;

  for (let roundNum = 1; roundNum <= cfg.maxDebateRounds; roundNum++) {
    const agentOutputs: DebateAgentOutput[] = [];

    // Run all agents (except scribe, which only runs in final round or standalone)
    const roundRoles =
      roundNum === cfg.maxDebateRounds
        ? roles
        : roles.filter((r) => r !== "scribe");

    for (const role of roundRoles) {
      const output = await runAgentRound(
        role,
        topic,
        previousSummary,
        parentArtifacts,
        model,
      );
      agentOutputs.push(output);
    }

    // Check consensus
    const moderatorOutput = agentOutputs.find(
      (o) => o.role === "moderator",
    );

    const consensusSummary =
      (moderatorOutput as unknown as Record<string, unknown>)
        ?.consensusSummary as string | undefined;

    const allConfident = agentOutputs.every((o) => o.confidenceScore >= 0.6);
    const noStrongDissent = agentOutputs.every(
      (o) => o.suggestedActions.length <= 5,
    );

    if (cfg.consensusMode === "majority") {
      const agreementCount = agentOutputs.filter(
        (o) => o.confidenceScore >= 0.7,
      ).length;
      consensusReached = agreementCount >= agentOutputs.length * 0.5;
    } else if (cfg.consensusMode === "unanimous") {
      consensusReached = allConfident && noStrongDissent;
    } else {
      // moderator_arbitration — trust the moderator
      consensusReached =
        (moderatorOutput?.confidenceScore ?? 0) >= 0.8;
    }

    rounds.push({
      roundNumber: roundNum,
      topic,
      agentOutputs,
      consensusReached,
      consensusSummary: consensusSummary ?? "No clear consensus reached",
      dissentingViews: agentOutputs
        .filter((o) => o.confidenceScore < 0.5)
        .map((o) => o.perspective),
      unresolvedIssues:
        (moderatorOutput as unknown as Record<string, unknown>)?.unresolvedIssues as
          | string[]
          | undefined ?? [],
    });

    previousSummary =
      consensusSummary ??
      `Round ${roundNum} complete. ${agentOutputs.length} agents participated.`;

    if (consensusReached && cfg.consensusMode !== "unanimous") {
      break;
    }
  }

  const finalRound = rounds[rounds.length - 1];
  const allInsights = rounds.flatMap((r) =>
    r.agentOutputs.flatMap((o) => o.arguments),
  );
  const allActions = rounds.flatMap((r) =>
    r.agentOutputs.flatMap((o) => o.suggestedActions),
  );

  // Deduplicate key insights and action items
  const uniqueInsights = [...new Set(allInsights)].slice(0, 10);
  const uniqueActions = [...new Set(allActions)].slice(0, 5);

  return {
    topic,
    rounds,
    finalConsensus: finalRound.consensusSummary,
    totalRounds: rounds.length,
    consensusReached: finalRound.consensusReached,
    keyInsights: uniqueInsights,
    actionItems: uniqueActions,
  };
}

// Re-exported from debate-utils.ts (pure functions, no server deps)
export { buildDebateOverlay, isDebateRecordValid } from "./debate-utils";
