import type { IdeationStageId, IdeationTurn, IdeationSharedContext, IdeationAgentConfig } from "./types";
import { IDEATION_AGENTS, SHARED_IDEATION_INSTRUCTION } from "./roles";

// =============================================================
// STAGE GUIDANCE — what the active role should do in each stage
// =============================================================
const STAGE_GUIDANCE: Record<IdeationStageId, string> = {
  hypothesis_generation: `CURRENT STAGE: Hypothesis Generation
Your task: Read the seed paper. Produce 3-5 novel, testable research hypotheses that extend, challenge, or build upon the paper's findings.
- Each hypothesis must have a clear statement, rationale, novelty assessment, and connection to the seed paper.
- If the user provided a seed idea, incorporate it as a starting point.
- Prioritize hypotheses that balance novelty with feasibility.`,

  feasibility_review: `CURRENT STAGE: Feasibility Review
Your task: For each hypothesis from Stage 1, evaluate practical feasibility across five dimensions: data availability, compute requirements, methodological readiness, timeline, and risk.
- Be specific about resource estimates — name concrete datasets, tools, and frameworks.
- Rate each hypothesis and suggest modifications for challenging ones.
- Your assessment will guide which hypotheses proceed to experiment design.`,

  experiment_design: `CURRENT STAGE: Experiment Design
Your task: Select the top 2 most feasible hypotheses based on the Feasibility Checker's assessment. Design concrete, executable experiments for each.
- Include protocol, baselines, controls, metrics, and expected outcomes.
- Define a Minimum Viable Experiment (MVE) achievable in 1-2 weeks.
- Be specific enough that a graduate student could begin implementation.`,

  review: `CURRENT STAGE: Review & Critique
Your task: Review the full transcript from all prior stages. Identify logical gaps, ethical concerns, statistical issues, missing baselines, and scope problems.
- For every criticism, suggest an improvement.
- Separate critical issues from minor concerns.
- Focus on issues that could invalidate results or waste resources.`,

  final_report: `CURRENT STAGE: Final Report
Your task: Synthesize the entire transcript into a structured Research Ideation Report.
- Use the required output format with all 6 sections.
- Do not introduce new ideas not discussed in the transcript.
- Preserve nuance — include both promise and risk for each direction.
- End with an overall assessment of the most promising research direction.`,
};

// =============================================================
// LOCALE INSTRUCTIONS
// =============================================================
const LOCALE_INSTRUCTION: Record<string, string> = {
  en: "Respond entirely in English.",
  zh: "请全部用中文回答。",
};

// =============================================================
// HELPERS
// =============================================================

function formatArticleContext(context: IdeationSharedContext): string {
  const parts = [`## Seed Paper
- **Title**: ${context.article.title}
- **Authors**: ${context.article.authors.join(", ")}
- **Published**: ${context.article.publishedDate}
- **Source**: ${context.article.source}

### Abstract
${context.article.abstract}`];

  if (context.userSeed) {
    parts.push(`\n### User's Research Seed Idea\n${context.userSeed}`);
  }

  return parts.join("");
}

function formatTranscript(transcript: IdeationTurn[]): string {
  if (transcript.length === 0) return "";

  const lines = transcript.map((turn) => {
    const agent = IDEATION_AGENTS[turn.roleId];
    return `### [${agent.displayName} — ${turn.stageId}]\n${turn.content}`;
  });

  return `## Ideation Transcript So Far\n${lines.join("\n\n")}`;
}

function formatRetrievedEvidence(evidence?: string): string {
  if (!evidence) return "";
  return `## Retrieved Evidence / Citations Context\n${evidence}`;
}

function brevityInstruction(mode: "quick" | "full"): string {
  if (mode === "quick") {
    return "\n\nIMPORTANT: Keep your response concise (≤ 400 words). Focus on the most critical points only. Be brief but substantive.";
  }
  return "";
}

// =============================================================
// UNIFIED PROMPT BUILDER
// =============================================================

/**
 * Build the complete system prompt for an ideation agent at a given stage.
 *
 * Combines (in order):
 * 1. Shared ideation instruction
 * 2. Role-specific system prompt
 * 3. Paper context + user seed
 * 4. Retrieved evidence (if available)
 * 5. Prior transcript
 * 6. Stage-specific guidance
 * 7. Locale instruction
 * 8. Brevity instruction (quick mode)
 */
export function buildIdeationPrompt(
  agentConfig: IdeationAgentConfig,
  context: IdeationSharedContext,
  transcript: IdeationTurn[],
  stageId: IdeationStageId,
): string {
  const parts: string[] = [
    SHARED_IDEATION_INSTRUCTION,
    "",
    agentConfig.systemPrompt,
    "",
    formatArticleContext(context),
  ];

  const evidence = formatRetrievedEvidence(context.retrievedEvidence);
  if (evidence) {
    parts.push("", evidence);
  }

  const transcriptBlock = formatTranscript(transcript);
  if (transcriptBlock) {
    parts.push("", transcriptBlock);
  }

  parts.push("", STAGE_GUIDANCE[stageId]);

  const localeInstr = LOCALE_INSTRUCTION[context.locale] || LOCALE_INSTRUCTION.en;
  parts.push("", localeInstr);

  parts.push(brevityInstruction(context.mode));

  return parts.join("\n");
}
