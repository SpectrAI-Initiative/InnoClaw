// =============================================================
// Deep Research — Synthesizer Role
// =============================================================
// Dedicated synthesis: reads evidence cards, builds structured claim
// maps, identifies gaps. Replaces the pattern where evidence_gather
// nodes do search+synthesis together.

import { generateText } from "ai";
import { getModelForRole, checkBudget, trackUsage } from "./model-router";
import * as store from "./event-store";
import type {
  DeepResearchSession,
  DeepResearchArtifact,
  EvidenceCardCollection,
  ClaimMap,
  RequirementState,
  ArtifactProvenance,
  ReviewRevisionRequest,
} from "./types";
import { evidenceCardToMarkdown } from "./evidence-cards";

// -------------------------------------------------------------------
// Prompt builder
// -------------------------------------------------------------------

export function buildSynthesizerPrompt(
  cards: EvidenceCardCollection,
  requirementState?: RequirementState | null,
): string {
  const cardsMarkdown = cards.cards.map(c => evidenceCardToMarkdown(c)).join("\n\n---\n\n");

  const requirementSection = requirementState
    ? `\n## Research Requirements\n- Goal: ${requirementState.currentApprovedGoal}\n- Active requirements: ${requirementState.requirements.filter(r => r.status === "active").map(r => r.text).join("; ")}`
    : "";

  return `You are the Synthesizer. Your job is to read evidence cards and produce a structured ClaimMap.

## STRICT RULES
1. Build claims ONLY from the evidence provided below. Do NOT fabricate.
2. For each claim, classify its strength: strong (multiple independent sources), moderate (1-2 sources), weak (single source with caveats), unsupported (no direct evidence).
3. Map each claim to its supporting source indices.
4. Identify contradictions between sources explicitly.
5. Identify evidence GAPS — topics where evidence is missing or insufficient.
6. For every claim, distinguish its knowledge type:
   - "retrieved_evidence": directly supported by a source below
   - "background_knowledge": general domain knowledge not from these sources
   - "assumption": reasonable assumption not directly evidenced
   - "speculation": forward-looking inference beyond the evidence

## Evidence Cards (${cards.totalSources} sources, ${cards.totalExcerpts} excerpts)

### Retrieval Summary
- Successful retrievals: ${cards.retrievalSummary.successful}
- Partial retrievals: ${cards.retrievalSummary.partial}
- Failed retrievals: ${cards.retrievalSummary.failed}
- Empty retrievals: ${cards.retrievalSummary.empty}

${cardsMarkdown}
${requirementSection}

## Output Format
Respond with valid JSON matching the ClaimMap schema:
{
  "claims": [
    {
      "id": "c1",
      "text": "Claim text",
      "strength": "strong|moderate|weak|unsupported",
      "supportingSources": [0, 2],
      "contradictingSources": [],
      "category": "topic category",
      "knowledgeType": "retrieved_evidence|background_knowledge|assumption|speculation"
    }
  ],
  "supportMatrix": { "c1": [0, 2], "c2": [1] },
  "contradictions": [
    { "claimAId": "c1", "claimBId": "c3", "description": "...", "possibleResolution": "..." }
  ],
  "gaps": [
    { "topic": "...", "description": "...", "suggestedQueries": ["..."], "priority": "high|medium|low" }
  ],
  "confidenceDistribution": { "strong": 3, "moderate": 5, "weak": 2, "unsupported": 1 }
}

Be thorough. Missing a contradiction or gap is worse than including a weak claim.`;
}

// -------------------------------------------------------------------
// Execute synthesis
// -------------------------------------------------------------------

export async function executeSynthesis(
  session: DeepResearchSession,
  evidenceCards: EvidenceCardCollection,
  abortSignal?: AbortSignal,
): Promise<{
  claimMap: ClaimMap;
  artifacts: DeepResearchArtifact[];
}> {
  // Use the synthesizer role (falls back to main_brain chain)
  const { model } = getModelForRole("synthesizer", session.config);

  const budgetCheck = checkBudget("synthesizer", session.budget, session.config.budget);
  if (!budgetCheck.allowed) {
    throw new Error(`Synthesizer budget exceeded: ${budgetCheck.reason}`);
  }

  // Create synthesize_claims node
  const synthNode = await store.createNode(session.id, {
    nodeType: "synthesize_claims",
    label: "Build claim map from evidence cards",
    assignedRole: "synthesizer",
    input: {
      totalCards: evidenceCards.cards.length,
      totalSources: evidenceCards.totalSources,
      retrievalSummary: evidenceCards.retrievalSummary,
    },
    phase: "literature_synthesis",
  });

  await store.updateNode(synthNode.id, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    const prompt = buildSynthesizerPrompt(evidenceCards);

    const result = await generateText({
      model,
      system: "You are a research synthesizer. Produce a structured ClaimMap from evidence. Respond ONLY with valid JSON.",
      messages: [{ role: "user", content: prompt }],
      abortSignal,
    });

    const tokens = result.usage?.totalTokens ?? 0;
    const budget = trackUsage(session.budget, "synthesizer", synthNode.id, tokens);
    await store.updateSession(session.id, { budget });

    // Parse claim map
    const claimMap = parseClaimMap(result.text);

    // Mark node completed
    await store.updateNode(synthNode.id, {
      status: "completed",
      output: claimMap as unknown as Record<string, unknown>,
      completedAt: new Date().toISOString(),
    });

    // Create claim_map artifact
    const provenance: ArtifactProvenance = {
      sourceNodeId: synthNode.id,
      sourceArtifactIds: [],
      model: "synthesizer",
      generatedAt: new Date().toISOString(),
    };

    const artifact = await store.createArtifact(
      session.id,
      synthNode.id,
      "claim_map",
      `Claim Map (${claimMap.claims.length} claims, ${claimMap.contradictions.length} contradictions, ${claimMap.gaps.length} gaps)`,
      claimMap as unknown as Record<string, unknown>,
      provenance,
    );

    await store.appendEvent(session.id, "synthesis_completed", synthNode.id, "synthesizer", undefined, undefined, {
      claimsCount: claimMap.claims.length,
      contradictionsCount: claimMap.contradictions.length,
      gapsCount: claimMap.gaps.length,
    });

    return { claimMap, artifacts: [artifact] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synthesis failed";
    await store.updateNode(synthNode.id, {
      status: "failed",
      error: message,
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}

// -------------------------------------------------------------------
// Revision synthesis — targeted revision from reviewer feedback
// -------------------------------------------------------------------

/**
 * Build a prompt for targeted revision of an existing ClaimMap based on
 * reviewer feedback (revision request).
 */
export function buildRevisionPrompt(
  existingClaimMap: ClaimMap,
  revisionRequest: ReviewRevisionRequest,
): string {
  const claimMapJson = JSON.stringify(existingClaimMap, null, 2);
  const truncatedMap = claimMapJson.length > 4000
    ? claimMapJson.slice(0, 4000) + "\n... (truncated)"
    : claimMapJson;

  const revisionPointsStr = revisionRequest.revisionPoints.map((rp, i) =>
    `${i + 1}. **${rp.target}** ${rp.issueId ? `[${rp.issueId}]` : ""}
   - Problem: ${rp.problem}
   - Expected outcome: ${rp.expectedOutcome}`
  ).join("\n");

  const antiPatternStr = revisionRequest.antiPatternsToFix.length > 0
    ? `\n## Anti-Patterns to Fix\n${revisionRequest.antiPatternsToFix.map(ap =>
      `- **${ap.pattern}** at ${ap.location}: ${ap.description}\n  Fix: ${ap.suggestedFix}`
    ).join("\n")}`
    : "";

  return `You are the Synthesizer performing a TARGETED REVISION of an existing ClaimMap.

## CONTEXT
The scientific reviewers have identified specific issues that must be fixed.
You must revise the ClaimMap to address EACH revision point below.

## STRICT RULES
1. Address EVERY revision point — do not skip any
2. Do NOT fabricate new evidence that wasn't in the original sources
3. You MAY: re-classify claim strength, add caveats, remove unsupported claims, fix contradictions, update gap analysis
4. You MAY NOT: invent new sources, hallucinate citations, add claims without evidence
5. Preserve claims that were NOT flagged — only modify what reviewers identified

## Existing ClaimMap
${truncatedMap}

## Revision Points (from reviewer round ${revisionRequest.fromRound})
${revisionPointsStr}
${antiPatternStr}

## Output Format
Respond with valid JSON matching the ClaimMap schema — the COMPLETE revised ClaimMap (not just changes).
Include ALL claims (modified and unmodified).`;
}

/**
 * Execute a targeted revision of an existing ClaimMap based on reviewer feedback.
 */
export async function executeRevisionSynthesis(
  session: DeepResearchSession,
  existingClaimMap: ClaimMap,
  revisionRequest: ReviewRevisionRequest,
  abortSignal?: AbortSignal,
): Promise<{
  claimMap: ClaimMap;
  artifacts: DeepResearchArtifact[];
}> {
  const { model } = getModelForRole("synthesizer", session.config);
  const budgetCheck = checkBudget("synthesizer", session.budget, session.config.budget);
  if (!budgetCheck.allowed) {
    throw new Error(`Synthesizer budget exceeded: ${budgetCheck.reason}`);
  }

  const synthNode = await store.createNode(session.id, {
    nodeType: "synthesize_claims",
    label: `Revise claim map (addressing ${revisionRequest.revisionPoints.length} reviewer points)`,
    assignedRole: "synthesizer",
    input: {
      revisionFromRound: revisionRequest.fromRound,
      issueCount: revisionRequest.issueIds.length,
      revisionPointCount: revisionRequest.revisionPoints.length,
      antiPatternCount: revisionRequest.antiPatternsToFix.length,
    },
    phase: "literature_synthesis",
  });

  await store.updateNode(synthNode.id, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    const prompt = buildRevisionPrompt(existingClaimMap, revisionRequest);

    const result = await generateText({
      model,
      system: "You are a research synthesizer revising an existing ClaimMap based on reviewer feedback. Respond ONLY with valid JSON.",
      messages: [{ role: "user", content: prompt }],
      abortSignal,
    });

    const tokens = result.usage?.totalTokens ?? 0;
    const budget = trackUsage(session.budget, "synthesizer", synthNode.id, tokens);
    await store.updateSession(session.id, { budget });

    const claimMap = parseClaimMap(result.text);

    await store.updateNode(synthNode.id, {
      status: "completed",
      output: claimMap as unknown as Record<string, unknown>,
      completedAt: new Date().toISOString(),
    });

    const provenance: ArtifactProvenance = {
      sourceNodeId: synthNode.id,
      sourceArtifactIds: [revisionRequest.targetClaimMapId],
      model: "synthesizer",
      generatedAt: new Date().toISOString(),
    };

    const artifact = await store.createArtifact(
      session.id,
      synthNode.id,
      "claim_map",
      `Revised Claim Map (${claimMap.claims.length} claims, revision round ${revisionRequest.fromRound})`,
      claimMap as unknown as Record<string, unknown>,
      provenance,
    );

    await store.appendEvent(session.id, "synthesis_completed", synthNode.id, "synthesizer", undefined, undefined, {
      revision: true,
      fromRound: revisionRequest.fromRound,
      claimsCount: claimMap.claims.length,
      issuesAddressed: revisionRequest.issueIds.length,
    });

    return { claimMap, artifacts: [artifact] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Revision synthesis failed";
    await store.updateNode(synthNode.id, {
      status: "failed",
      error: message,
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function parseClaimMap(text: string): ClaimMap {
  // Try JSON fence first
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return validateClaimMap(parsed);
  } catch {
    // Try to find JSON object in text
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
            const parsed = JSON.parse(text.slice(firstBrace, i + 1));
            return validateClaimMap(parsed);
          }
        }
      }
    }
    throw new Error("Failed to parse ClaimMap from synthesizer output");
  }
}

function validateClaimMap(obj: Record<string, unknown>): ClaimMap {
  return {
    claims: Array.isArray(obj.claims) ? obj.claims : [],
    supportMatrix: (obj.supportMatrix as Record<string, number[]>) ?? {},
    contradictions: Array.isArray(obj.contradictions) ? obj.contradictions : [],
    gaps: Array.isArray(obj.gaps) ? obj.gaps : [],
    confidenceDistribution: (obj.confidenceDistribution as Record<string, number>) ?? {
      strong: 0,
      moderate: 0,
      weak: 0,
      unsupported: 0,
    },
  };
}
