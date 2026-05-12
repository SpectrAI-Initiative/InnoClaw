import type { DiscussionStageId, DiscussionRoleId, DiscussionTurn, PaperDiscussionSharedContext, DiscussionAgentConfig } from "./types";
import { DISCUSSION_AGENTS, DISCUSSION_STAGES, SHARED_DISCUSSION_INSTRUCTION } from "./roles";
import type { PaperContentPart } from "@/lib/files/pdf-image-extractor";
import type { UserContent, TextPart, ImagePart } from "ai";

export interface DiscussionPromptResult {
  system: string;
  userContent: UserContent;
}

type ContentPart = TextPart | ImagePart;

// =============================================================
// STAGE GUIDANCE — what the active role should do in each stage
// =============================================================
const STAGE_GUIDANCE: Record<DiscussionStageId, string> = {
  agenda: `CURRENT STAGE: Agenda
Your task: Frame the discussion. Define the agenda. Identify key technical questions the panel should address.
- Briefly identify the paper topic and likely evaluation dimensions: novelty, evidence quality, methodology, reproducibility, limitations.
- Then explicitly invite the Librarian to present the evidence summary next.`,

  evidence_summary: `CURRENT STAGE: Evidence Summary
Your task: Summarize the paper's claims, method, setup, and results. Ground everything with evidence from the paper.
- Present what the paper explicitly says vs. what is inferred vs. what is missing.
- Attach evidence references whenever available.
- When referencing external work for comparison, use numbered inline citations **[N]** and include a References section at the end with full markdown-formatted entries.`,

  critique: `CURRENT STAGE: Critical Analysis
Your task: Challenge the evidence and claims. Identify weaknesses, missing baselines, threats to validity, and overclaims.
- Mark each issue with severity: Critical / Moderate / Minor.
- Separate confirmed weaknesses from potential concerns.
- When identifying missing baselines or comparing to external methods, cite specific papers using numbered inline citations **[N]** and include a References section at the end.`,

  reproducibility_check: `CURRENT STAGE: Reproducibility Check
Your task: Assess reproducibility. Extract implementation-critical details. Identify gaps in what's needed to reproduce the results.
- Rate overall reproducibility status: Easily / Partially / Hard to reproduce.
- Propose a minimal reproduction plan.`,

  convergence: `CURRENT STAGE: Convergence
Your task: Synthesize the discussion. Summarize agreement, disagreement, and open questions from Librarian, Skeptic, and Reproducer.
- Ask for final disagreements only if needed.
- Hand off clearly to the Scribe for final synthesis.`,

  final_report: `CURRENT STAGE: Final Report
Your task: Write the final structured report synthesizing the entire discussion.
- Use EXACTLY the required output format with all 8 sections (including ## 8. References).
- Do not introduce new claims that were not discussed.
- Consolidate all numbered inline citations from the discussion into the References section with full markdown formatting: N. **Author(s)** (Year). *Title.* Venue. [DOI/URL](link)
- End with "Overall take: ..."`,
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

function formatArticleContext(article: PaperDiscussionSharedContext["article"]): string {
  return `## Paper Under Discussion
- **Title**: ${article.title}
- **Authors**: ${article.authors.join(", ")}
- **Published**: ${article.publishedDate}
- **Source**: ${article.source}

### Abstract
${article.abstract}`;
}

function formatTranscript(transcript: DiscussionTurn[]): string {
  if (transcript.length === 0) return "";

  const lines = transcript.map((turn) => {
    const agent = DISCUSSION_AGENTS[turn.roleId];
    return `### [${agent.displayName} — ${turn.stageId}]\n${turn.content}`;
  });

  return `## Discussion Transcript So Far\n${lines.join("\n\n")}`;
}

function formatRetrievedEvidence(evidence?: string): string {
  if (!evidence) return "";
  return `## Retrieved Evidence / Citations Context\n${evidence}`;
}

function formatFigures(figures?: Array<{ url: string; caption: string; figureId?: string }>): string {
  if (!figures || figures.length === 0) return "";
  const items = figures
    .map((f, i) => `- **${f.figureId || `Figure ${i + 1}`}**: ${f.caption}${f.url ? ` [Image](${f.url})` : ""}`)
    .join("\n");
  return `## Paper Figures\n${items}`;
}

function brevityInstruction(mode: "quick" | "full"): string {
  if (mode === "quick") {
    return "\n\nIMPORTANT: Keep your response concise — focus on the top 2-3 most critical points only. Be brief but substantive.";
  }
  return "";
}

/**
 * Convert PaperContentPart[] to AI SDK UserContent (multimodal parts array).
 * Text parts become TextPart, image parts become ImagePart with base64 data.
 */
function paperContentToUserContent(parts: PaperContentPart[]): ContentPart[] {
  const content: ContentPart[] = [];
  for (const part of parts) {
    if (part.type === "text" && part.text) {
      content.push({ type: "text", text: part.text });
    } else if (part.type === "image" && part.data && part.mimeType) {
      content.push({
        type: "image",
        image: Buffer.from(part.data, "base64"),
        mediaType: part.mimeType,
      });
    }
  }
  return content;
}

// =============================================================
// UNIFIED PROMPT BUILDER
// =============================================================

/**
 * Build the complete prompt for a discussion agent at a given stage.
 *
 * Returns a structured result with:
 * - `system`: text-only system prompt (role instructions, stage guidance, transcript)
 * - `userContent`: user message content — multimodal (text + images) when paper
 *   images are available and vision is supported, text-only otherwise
 *
 * Combines (in order):
 * 1. Shared discussion instruction
 * 2. Role-specific system prompt
 * 3. Paper context (article metadata)
 * 4. Prior transcript
 * 5. Stage-specific guidance
 * 6. Locale instruction
 * 7. Brevity instruction (quick mode)
 *
 * Paper content (text + images) is placed in the user message for multimodal models.
 */
export function buildDiscussionPrompt(
  agentConfig: DiscussionAgentConfig,
  context: PaperDiscussionSharedContext,
  transcript: DiscussionTurn[],
  stageId: DiscussionStageId,
): DiscussionPromptResult {
  const systemParts: string[] = [
    SHARED_DISCUSSION_INSTRUCTION,
    "",
    agentConfig.systemPrompt,
    "",
    formatArticleContext(context.article),
  ];

  // Add figures metadata to system prompt (always available, text-only)
  const figuresBlock = formatFigures(context.figures);
  if (figuresBlock) {
    systemParts.push("", figuresBlock);
  }


  const transcriptBlock = formatTranscript(transcript);
  if (transcriptBlock) {
    systemParts.push("", transcriptBlock);
  }

  systemParts.push("", STAGE_GUIDANCE[stageId]);

  const localeInstr = LOCALE_INSTRUCTION[context.locale] || LOCALE_INSTRUCTION.en;
  systemParts.push("", localeInstr);

  systemParts.push(brevityInstruction(context.mode));

  // Build user content — multimodal when images available
  const useVision = context.supportsVision && context.paperContent && context.paperContent.some((p) => p.type === "image");

  const userParts: ContentPart[] = [];
  const taskPrompt = `Begin your analysis of the paper "${context.article.title}".`;

  if (useVision && context.paperContent) {
    // Multimodal: paper pages (text + images) + task instruction
    userParts.push({ type: "text", text: "## Full Paper Content (pages with figures)\n" });
    userParts.push(...paperContentToUserContent(context.paperContent));
    userParts.push({ type: "text", text: `\n\n${taskPrompt}` });
  } else {
    // Text-only: embed retrieved evidence in system prompt, simple user prompt
    const evidence = formatRetrievedEvidence(context.retrievedEvidence);
    if (evidence) {
      systemParts.splice(systemParts.length - 3, 0, "", evidence);
    }
    userParts.push({ type: "text", text: taskPrompt });
  }

  return {
    system: systemParts.join("\n"),
    userContent: userParts,
  };
}

// =============================================================
// Backward compat — dispatch by stageId (used by old route.ts)
// =============================================================

/** @deprecated Use buildDiscussionPrompt directly */
export function buildDiscussionPhasePrompt(
  phaseId: DiscussionStageId,
  article: { title: string; authors: string[]; publishedDate: string; source: string; abstract: string },
  transcript: string,
  mode: "quick" | "full",
  locale: string,
): string {
  // Convert old-style args to new context
  const context: PaperDiscussionSharedContext = {
    article: { id: "", ...article },
    locale,
    mode,
  };

  // Find the stage to get the role
  const stage = DISCUSSION_STAGES.find((s) => s.id === phaseId);
  if (!stage) throw new Error(`Unknown stage: ${phaseId}`);

  const agentConfig = DISCUSSION_AGENTS[stage.roleId as DiscussionRoleId];

  // Convert old transcript string to empty turns (prompt builder will use the raw string approach)
  // For backward compat, we construct the prompt manually with the old transcript
  const parts: string[] = [
    SHARED_DISCUSSION_INSTRUCTION,
    "",
    agentConfig.systemPrompt,
    "",
    formatArticleContext(context.article),
  ];

  if (transcript) {
    parts.push("", `## Discussion Transcript So Far\n${transcript}`);
  }

  parts.push("", STAGE_GUIDANCE[phaseId]);

  const localeInstr = LOCALE_INSTRUCTION[locale] || LOCALE_INSTRUCTION.en;
  parts.push("", localeInstr);

  parts.push(brevityInstruction(mode));

  return parts.join("\n");
}
