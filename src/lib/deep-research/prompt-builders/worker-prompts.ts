import type {
  DeepResearchArtifact,
  DeepResearchNode,
  DeepResearchSession,
  NodeType,
  ReviewAssessment,
} from "../types";
import { buildRuntimeRoleContract } from "../role-registry";

export function buildWorkerSystemPrompt(
  node: DeepResearchNode,
  parentArtifacts: DeepResearchArtifact[],
  taskType: NodeType,
): string {
  const roleContract = buildRuntimeRoleContract(node.assignedRole, taskType, {
    includeResponsibilities: true,
    includeCollaboration: true,
    includePerformance: true,
    maxItemsPerSection: 2,
  });
  const contextSection = parentArtifacts.length > 0
    ? "## Context Artifacts\n" + parentArtifacts.map((artifact) =>
        `### ${artifact.title} (${artifact.artifactType})\n${JSON.stringify(artifact.content, null, 2)}`
      ).join("\n\n")
    : "";

  const outputSchema = getWorkerOutputSchema(taskType);

  return `You are a specialist role executing a specific, scoped subtask.

## RULES
- Focus ONLY on the assigned task. Do NOT address the broader research question.
- Cite provenance for all claims: which source, which section, what evidence.
- Do NOT hallucinate. If information is missing, say so.
- Do NOT self-assign additional tasks or redefine the plan.
- Do NOT dispatch other roles or make final conclusions.
- Be thorough but concise. Quality over quantity.

## Structured Role Contract
${roleContract || "  (no structured role contract available)"}

## Your Task
${node.label}

## Task Input
${node.input ? JSON.stringify(node.input, null, 2) : "(no specific input)"}

${contextSection}

## Output Requirements
${outputSchema}`;
}

export function buildEvidenceGatherPrompt(
  query: string,
  constraints?: { maxSources?: number; focusAreas?: string[] },
): string {
  const maxSources = constraints?.maxSources ?? 15;
  return `Search for and gather evidence related to:

## Query
${query}

## Constraints
- Maximum sources to find: ${maxSources}
- Focus areas: ${constraints?.focusAreas?.join(", ") || "none specified — use your judgment"}

## Instructions

**You MUST use the searchArticles tool to find papers.** Do not skip tool usage. Call the tool at least 3 times with different keyword variations.

1. First, call searchArticles with broad keywords extracted from the query (3-5 keywords).
2. Call searchArticles again with alternative keywords (synonyms, related terms, different angles).
3. Call searchArticles a third time with more specific/narrow keywords if needed.
4. If results are still thin, try shorter keyword lists or broader terms.
5. Search ALL available sources: arXiv, Semantic Scholar, bioRxiv, PubMed.

For each source found, you MUST extract ALL of the following:
1. **Full citation**: Authors (all), year, title, journal/venue/conference, DOI if available
2. **Relevant findings**: Direct quotes or paraphrased findings with page/section context
3. **Methodology**: What approach/methods were used
4. **Confidence**: high/medium/low in the evidence quality
5. **Relevance**: How this specific finding relates to the query

## CRITICAL — Citation Requirements
- Every source MUST include authors and year for proper citation tracking
- Format each citation as: "Author1, Author2, et al. (Year). Title. Venue."
- Include DOI or URL for every cited paper
- Track ALL papers found by the search tool, not just the first few

After searching, respond with a JSON object:
\`\`\`json
{
  "sources": [
    {
      "title": "Full paper title",
      "authors": ["Author1 Last", "Author2 Last"],
      "year": 2024,
      "venue": "Conference or Journal name",
      "doi": "10.xxxx/xxxxx",
      "url": "https://...",
      "findings": "Key findings relevant to the query",
      "methodology": "Methods used",
      "confidence": "high|medium|low",
      "relevance": "How this relates to the query",
      "citationKey": "Author1 et al., 2024"
    }
  ],
  "totalFound": <number>,
  "searchQueries": ["keywords used in search 1", "keywords used in search 2"],
  "coverageSummary": "Thorough description of what was found across all searches",
  "citationCount": <number of unique papers found>
}
\`\`\`

Be systematic and thorough. Cover the query from multiple angles.
AIM for at LEAST ${maxSources} sources. More sources = better coverage.
Quality AND quantity both matter for research depth.`;
}

export function buildValidationPlanPrompt(
  session: DeepResearchSession,
  synthesisArtifacts: DeepResearchArtifact[],
  reviewAssessment: ReviewAssessment | null,
): string {
  const synthesisSection = synthesisArtifacts.map((artifact) =>
    `### ${artifact.title}\n${JSON.stringify(artifact.content, null, 2)}`
  ).join("\n\n");

  const reviewSection = reviewAssessment
    ? `## Reviewer Outcome\n${JSON.stringify(reviewAssessment, null, 2)}`
    : "";

  return `Convert the research findings into a concrete validation plan.

## Research Findings
${synthesisSection}

${reviewSection}

## User's Original Question
${session.title}

## Instructions
Produce a validation plan as JSON:
{
  "objective": "What we are trying to validate",
  "hypothesis": "The specific hypothesis to test",
  "literaturePrediction": "What literature suggests should happen",
  "requiredResources": {"gpu": N, "memoryMb": N, "cpu": N, "privateMachine": "yes|no|group"},
  "datasets": ["dataset1", "dataset2"],
  "steps": [
    {
      "stepNumber": 1,
      "description": "What this step does",
      "command": "command to run (if applicable)",
      "scriptPath": "path/to/script (if applicable)",
      "launcherType": "rjob|rlaunch|local_shell",
      "requiresApproval": true,
      "expectedDuration": "estimate"
    }
  ],
  "expectedOutputs": ["metric1", "metric2"],
  "failureCriteria": ["condition that means the hypothesis is false"],
  "successCriteria": ["condition that confirms the hypothesis"]
}

Be specific and executable. Each step should be doable by the appropriate specialist role.`;
}

function getWorkerOutputSchema(taskType: NodeType): string {
  switch (taskType) {
    case "evidence_gather":
      return `Produce an evidence card as JSON:
{
  "claims": [{"claim": "...", "evidence": "...", "source": "...", "confidence": "high|medium|low"}],
  "methods": ["methods identified"],
  "datasets": ["datasets mentioned"],
  "gaps": ["areas where evidence is insufficient"],
  "papersFound": 0,
  "searchQueries": ["queries used"],
  "confidence": 0.0-1.0
}
Stay within the specified paper limit. Do not do unbounded searching.`;

    case "evidence_extract":
      return `Extract structured information from the provided papers/sources:
{
  "extractions": [
    {"source": "...", "objective": "...", "method": "...", "results": "...", "limitations": "..."}
  ],
  "crossReferences": ["connections between sources"],
  "confidence": 0.0-1.0
}`;

    case "execute":
      return `Produce a step result as JSON:
{
  "status": "success|failure|partial",
  "outputs": { ... },
  "commands": ["commands executed"],
  "observations": ["key observations"],
  "errors": ["any errors"],
  "metrics": { ... }
}`;

    case "resource_request":
      return `Produce a resource request manifest as JSON:
{
  "launcherType": "rlaunch|rjob",
  "resources": {"gpu": N, "memoryMb": N, "cpu": N},
  "purpose": "what this resource is for",
  "estimatedDuration": "estimate",
  "manifest": { ... full manifest fields ... }
}`;

    case "monitor":
      return `Produce a monitoring report as JSON:
{
  "jobStatus": "running|completed|failed|unknown",
  "progress": "description of progress",
  "metrics": { ... },
  "issues": ["any issues observed"],
  "estimatedCompletion": "estimate"
}`;

    case "result_collect":
      return `Collect and package results as JSON:
{
  "outputs": { ... collected files/metrics ... },
  "summary": "brief summary of results",
  "completeness": "complete|partial|failed",
  "missingOutputs": ["expected outputs not found"]
}`;

    case "result_compare":
      return `Compare results against expectations as JSON:
{
  "hypothesis": "what was expected",
  "actualResult": "what happened",
  "match": "confirmed|partially_confirmed|contradicted|inconclusive",
  "metrics": { ... },
  "analysis": "detailed comparison",
  "confidence": 0.0-1.0
}`;

    case "summarize":
      return `Produce a structured summary as JSON:
{
  "summary": "overall synthesis paragraph",
  "chapterPackets": [
    {
      "id": "chapter_1",
      "title": "section-ready chapter title",
      "objective": "what this chapter should establish",
      "summary": "2-4 sentence synthesis for this chapter",
      "keyTakeaways": ["takeaway 1", "takeaway 2"],
      "claims": [
        {
          "id": "claim_1",
          "text": "specific evidence-backed claim",
          "strength": "strong|moderate|weak|unsupported",
          "citationKeys": ["Informer, 2021"],
          "supportingSourceTitles": ["Informer"],
          "counterpoints": ["optional caveat"]
        }
      ],
      "supportingQuotes": [
        {
          "citationKey": "Informer, 2021",
          "sourceTitle": "Informer",
          "quote": "short excerpt or precise evidence statement",
          "relevance": "why it matters for this chapter"
        }
      ],
      "citationKeys": ["Informer, 2021", "Autoformer, 2021"],
      "openQuestions": ["remaining uncertainty"],
      "recommendedSectionText": "draft-quality section seed text with inline citations like [Informer, 2021]."
    }
  ],
  "crossSectionThemes": ["theme 1"],
  "globalOpenQuestions": ["question 1"],
  "recommendedReportNarrative": "how the final report should connect the chapter packets"
}
Rules:
- Build chapterPackets that can be consumed directly by a final-report writer.
- Every non-trivial chapter should carry explicit citationKeys.
- recommendedSectionText should already read like a report section seed, not a bullet memo.
- Do not return markdown outside the JSON.`;

    case "synthesize":
      return `Produce a synthesis in markdown. Include:
- Integrated findings across all sub-questions
- Resolution of conflicting evidence
- Overall conclusions with confidence levels
- Recommendations`;

    default:
      return "Produce a clear, structured response addressing the assigned task.";
  }
}
