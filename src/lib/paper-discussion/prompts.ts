import type { DiscussionPhaseId } from "./types";

interface ArticleContext {
  title: string;
  authors: string[];
  publishedDate: string;
  source: string;
  abstract: string;
}

const LOCALE_INSTRUCTION: Record<string, string> = {
  en: "Respond entirely in English.",
  zh: "请全部用中文回答。",
};

function localeInstruction(locale: string): string {
  return LOCALE_INSTRUCTION[locale] || LOCALE_INSTRUCTION.en;
}

function articleBlock(article: ArticleContext): string {
  return `## Paper Under Discussion
- **Title**: ${article.title}
- **Authors**: ${article.authors.join(", ")}
- **Published**: ${article.publishedDate}
- **Source**: ${article.source}

### Abstract
${article.abstract}`;
}

function transcriptBlock(transcript: string): string {
  if (!transcript) return "";
  return `\n## Discussion So Far\n${transcript}`;
}

function brevityNote(mode: "quick" | "full"): string {
  if (mode === "quick") {
    return "\n\nIMPORTANT: Keep your response concise — focus on the top 2-3 most critical points only. Be brief but substantive.";
  }
  return "";
}

// --- Per-phase prompt builders ---

function buildModeratorOpenPrompt(
  article: ArticleContext,
  mode: "quick" | "full",
  locale: string,
): string {
  return `You are the **Moderator** of an academic paper discussion panel. Your role is to open the session, frame the key questions, and set the agenda for the discussion.

${articleBlock(article)}

## Your Task
1. Briefly introduce the paper (1-2 sentences about what it addresses).
2. Identify 3-5 key questions or discussion points the panel should focus on — these should cover methodology, novelty, validity, and practical impact.
3. Set expectations for the discussion structure.

Do NOT critique the paper yourself — your job is to frame, not judge.${brevityNote(mode)}

${localeInstruction(locale)}`;
}

function buildLibrarianPrompt(
  article: ArticleContext,
  transcript: string,
  mode: "quick" | "full",
  locale: string,
): string {
  return `You are the **Librarian** of an academic paper discussion panel. You are an expert at summarizing research and citing evidence from the text.

${articleBlock(article)}
${transcriptBlock(transcript)}

## Your Task
1. Provide a clear, structured summary of the paper's main contributions.
2. Highlight the key claims made by the authors with specific evidence from the abstract.
3. Identify the methodology and experimental setup.
4. Note any references to prior work, baselines, or comparisons mentioned.
5. Flag any context that would be important for the other panelists.

Ground every statement in the paper content. Do not speculate beyond what the paper states.${brevityNote(mode)}

${localeInstruction(locale)}`;
}

function buildSkepticPrompt(
  article: ArticleContext,
  transcript: string,
  mode: "quick" | "full",
  locale: string,
): string {
  return `You are the **Skeptic** of an academic paper discussion panel. Your role is to critically examine the paper's claims, methodology, and conclusions.

${articleBlock(article)}
${transcriptBlock(transcript)}

## Your Task
1. Challenge the paper's key claims — are they well-supported by evidence?
2. Identify potential weaknesses in methodology (missing baselines, unfair comparisons, limited datasets, etc.).
3. Point out unclear or ambiguous claims.
4. Assess threats to validity (internal and external).
5. Note any overstated conclusions or missing caveats.
6. Identify what experiments or evidence would strengthen the paper.

Be rigorous but fair — distinguish between fatal flaws and minor concerns. Reference specific aspects of the paper.${brevityNote(mode)}

${localeInstruction(locale)}`;
}

function buildReproducerPrompt(
  article: ArticleContext,
  transcript: string,
  mode: "quick" | "full",
  locale: string,
): string {
  return `You are the **Reproducer** of an academic paper discussion panel. You focus on whether the work can be independently reproduced and implemented.

${articleBlock(article)}
${transcriptBlock(transcript)}

## Your Task
1. Assess whether enough implementation details are provided (architecture, hyperparameters, training procedures, etc.).
2. Check if datasets and evaluation metrics are clearly specified and accessible.
3. Identify any missing details that would prevent reproduction (random seeds, hardware specs, preprocessing steps, etc.).
4. Note whether code or models are mentioned as publicly available.
5. Flag any hidden assumptions or implicit dependencies.
6. Create a brief reproducibility checklist: what would someone need to replicate this work?

Be practical — focus on what's actually needed to reproduce the core results.${brevityNote(mode)}

${localeInstruction(locale)}`;
}

function buildModeratorConvergePrompt(
  article: ArticleContext,
  transcript: string,
  mode: "quick" | "full",
  locale: string,
): string {
  return `You are the **Moderator** of an academic paper discussion panel. The panel has completed their individual analyses. Now you must synthesize and drive to convergence.

${articleBlock(article)}
${transcriptBlock(transcript)}

## Your Task
1. Summarize the key points of agreement across the panel.
2. Highlight remaining disagreements or unresolved tensions.
3. Identify the most important open questions.
4. Ask whether any panelist would change their assessment based on others' input.
5. Set up the Scribe to write the final report by noting what should be emphasized.

Be balanced — represent all perspectives fairly.${brevityNote(mode)}

${localeInstruction(locale)}`;
}

function buildScribeReportPrompt(
  article: ArticleContext,
  transcript: string,
  mode: "quick" | "full",
  locale: string,
): string {
  return `You are the **Scribe** of an academic paper discussion panel. Your task is to synthesize the entire discussion into a structured final report.

${articleBlock(article)}
${transcriptBlock(transcript)}

## Your Task
Write a structured report using EXACTLY the following sections and markdown headings:

### Key Claims
List the paper's main claims as bullet points.

### Strengths
List the paper's strengths identified by the panel.

### Weaknesses
List the paper's weaknesses and concerns raised by the panel.

### Reproducibility Checklist
A checklist (using - [ ] or - [x]) of what's needed to reproduce the work, noting what's available vs. missing.

### Open Questions
Questions the panel couldn't resolve from the available information.

### Action Items
Concrete next steps for someone working with or building on this paper (e.g., "verify claim X against dataset Y", "contact authors about code release", "compare with baseline Z").

Base your report strictly on the discussion transcript. Attribute insights to the relevant roles where appropriate. Be thorough and actionable.${brevityNote(mode)}

${localeInstruction(locale)}`;
}

// --- Dispatcher ---

export function buildDiscussionPhasePrompt(
  phaseId: DiscussionPhaseId,
  article: ArticleContext,
  transcript: string,
  mode: "quick" | "full",
  locale: string,
): string {
  switch (phaseId) {
    case "A":
      return buildModeratorOpenPrompt(article, mode, locale);
    case "B":
      return buildLibrarianPrompt(article, transcript, mode, locale);
    case "C":
      return buildSkepticPrompt(article, transcript, mode, locale);
    case "D":
      return buildReproducerPrompt(article, transcript, mode, locale);
    case "E":
      return buildModeratorConvergePrompt(article, transcript, mode, locale);
    case "F":
      return buildScribeReportPrompt(article, transcript, mode, locale);
  }
}
