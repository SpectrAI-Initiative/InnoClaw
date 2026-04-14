import type { IdeationStageId, IdeationTurn, IdeationSharedContext, IdeationAgentConfig } from "./types";
import { IDEATION_AGENTS, SHARED_IDEATION_INSTRUCTION } from "./roles";
import type { PaperContentPart } from "@/lib/files/pdf-image-extractor";
import type { UserContent, TextPart, ImagePart } from "ai";

export interface IdeationPromptResult {
  system: string;
  userContent: UserContent;
}

type ContentPart = TextPart | ImagePart;

// =============================================================
// STAGE GUIDANCE — what the active role should do in each stage
// =============================================================
const STAGE_GUIDANCE: Record<IdeationStageId, string> = {
  hypothesis_generation: `CURRENT STAGE: Hypothesis Generation
Your task: Read the seed paper. Produce 3-5 novel, testable research hypotheses that extend, challenge, or build upon the paper's findings.
- Each hypothesis must have a clear statement, rationale, novelty assessment, and connection to the seed paper.
- Each hypothesis MUST include at least 1 supporting reference as a numbered inline citation **[N]**.
- If the user provided a seed idea, incorporate it as a starting point.
- Prioritize hypotheses that balance novelty with feasibility.
- End with a **References** section listing all cited works in markdown format.`,

  feasibility_review: `CURRENT STAGE: Feasibility Review
Your task: For each hypothesis from Stage 1, evaluate practical feasibility across five dimensions: data availability, compute requirements, methodological readiness, timeline, and risk.
- Be specific about resource estimates — name concrete datasets, tools, and frameworks.
- Rate each hypothesis and suggest modifications for challenging ones.
- Your assessment will guide which hypotheses proceed to experiment design.`,

  experiment_design: `CURRENT STAGE: Experiment Design
Your task: Select the top 2 most feasible hypotheses based on the Feasibility Checker's assessment. Design concrete, executable experiments for each.
- Include protocol, baselines, controls, metrics, and expected outcomes.
- For each baseline method and adopted protocol, provide numbered inline citations **[N]** to the original papers.
- Define a Minimum Viable Experiment (MVE) achievable in 1-2 weeks.
- Be specific enough that a graduate student could begin implementation.
- End with a **References** section listing all cited works in markdown format.`,

  review: `CURRENT STAGE: Review & Critique
Your task: Review the full transcript from all prior stages. Identify logical gaps, ethical concerns, statistical issues, missing baselines, and scope problems.
- For every criticism, suggest an improvement.
- Separate critical issues from minor concerns.
- Focus on issues that could invalidate results or waste resources.`,

  final_report: `CURRENT STAGE: Final Report
Your task: Synthesize the entire transcript into a structured Research Ideation Report.
- Use the required output format with all 7 sections (including ## 7. References).
- Do not introduce new ideas not discussed in the transcript.
- Consolidate all numbered inline citations from the discussion into the References section with full markdown formatting: N. **Author(s)** (Year). *Title.* Venue. [DOI/URL](link)
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

function formatFigures(figures?: Array<{ url: string; caption: string; figureId?: string }>): string {
  if (!figures || figures.length === 0) return "";
  const items = figures
    .map((f, i) => `- **${f.figureId || `Figure ${i + 1}`}**: ${f.caption}${f.url ? ` [Image](${f.url})` : ""}`)
    .join("\n");
  return `## Paper Figures\n${items}`;
}

function brevityInstruction(mode: "quick" | "full"): string {
  if (mode === "quick") {
    return "\n\nIMPORTANT: Keep your response concise — focus on the most critical points only. Be brief but substantive.";
  }
  return "";
}

/**
 * Convert PaperContentPart[] to AI SDK UserContent (multimodal parts array).
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
 * Build the complete prompt for an ideation agent at a given stage.
 *
 * Returns a structured result with:
 * - `system`: text-only system prompt (role instructions, stage guidance, transcript)
 * - `userContent`: user message content — multimodal when paper images are available
 */
export function buildIdeationPrompt(
  agentConfig: IdeationAgentConfig,
  context: IdeationSharedContext,
  transcript: IdeationTurn[],
  stageId: IdeationStageId,
): IdeationPromptResult {
  const systemParts: string[] = [
    SHARED_IDEATION_INSTRUCTION,
    "",
    agentConfig.systemPrompt,
    "",
    formatArticleContext(context),
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
  const taskPrompt = `Begin your analysis of the paper "${context.article.title}".${context.userSeed ? ` The user's research seed idea: "${context.userSeed}"` : ""}`;

  if (useVision && context.paperContent) {
    userParts.push({ type: "text", text: "## Full Paper Content (pages with figures)\n" });
    userParts.push(...paperContentToUserContent(context.paperContent));
    userParts.push({ type: "text", text: `\n\n${taskPrompt}` });
  } else {
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
