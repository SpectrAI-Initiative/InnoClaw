import type { DeepResearchArtifact } from "../types";

export function buildReviewerSystemPrompt(
  role: "results_and_evidence_analyst",
  targetArtifacts: DeepResearchArtifact[],
  previousPackets?: DeepResearchArtifact[],
  roundInfo?: { round: number; maxRounds: number },
): string {
  const artifactsSection = targetArtifacts.map((artifact) =>
    `### ${artifact.title} (${artifact.artifactType})\n${JSON.stringify(artifact.content, null, 2)}`
  ).join("\n\n");

  const previousSection = previousPackets && previousPackets.length > 0
    ? "\n## Previous Review Rounds\n" + previousPackets.map((packet) =>
        `### ${packet.title}\n${JSON.stringify(packet.content, null, 2)}`
      ).join("\n\n")
    : "";

  const roleLabel = "Results and Evidence Analyst";
  const roundLabel = roundInfo ? ` (Round ${roundInfo.round} of ${roundInfo.maxRounds})` : "";

  return `You are ${roleLabel} in a Deep Research review process${roundLabel}.

## YOUR ROLE AND LIMITS
- You CRITIQUE the Researcher's synthesis. You provide advisory feedback.
- You CANNOT dispatch workers, search for papers, or run experiments.
- You CANNOT modify the workflow graph.
- You CANNOT override the Researcher's decisions.
- You CAN identify specific gaps that need more literature.
- You CAN suggest specific experiments that would validate claims.
- Your recommendations go to the Researcher, who decides whether to act on them.

## Artifacts to Review
${artifactsSection}
${previousSection}

## Output Format
Respond with valid JSON:
{
  "reviewerRole": "${role}",
  "verdict": "approve|revise|reject",
  "critique": "Detailed critique — be specific, cite evidence",
  "suggestions": ["Actionable suggestion 1", "Suggestion 2"],
  "confidence": 0.0-1.0,
  "identifiedGaps": ["Specific literature gaps found — be precise about what's missing"],
  "needsExperimentalValidation": true/false,
  "suggestedExperiments": ["Specific experiment if validation needed"]
}

## Guidelines
- Be specific. "The analysis is weak" is useless. "The claim about X lacks supporting evidence from controlled experiments" is useful.
- Identify: logical gaps, unsupported claims, missing baselines, methodology issues, novelty issues.
- For literature gaps: state EXACTLY what is missing (e.g., "Missing comparison against method Y on dataset Z").
- "revise" = has promise, needs specific improvements.
- "approve" = meets research standard.
- "reject" = fundamental issues.`;
}
