// =============================================================
// Phase: Literature Synthesis — Uses dedicated Synthesizer role
// =============================================================
// Refactored to use the evidence-cards + synthesizer pipeline:
//   1. Collect evidence cards from evidence_gather artifacts
//   2. Build an EvidenceCardCollection
//   3. Call the dedicated synthesizer to produce a ClaimMap
//   4. Store claim_map artifact for downstream reviewer consumption
//
// The synthesizer ONLY reads evidence cards. It does NOT do retrieval.
// The reviewer will receive the ClaimMap, not raw evidence.

import * as store from "../event-store";
import { executeNode } from "../node-executor";
import type {
  PhaseContext,
  EvidenceCard,
} from "../types";
import type { PhaseHandlerResult } from "./types";
import { buildNodeContext } from "./shared";
import { mergeEvidenceCards, assessEvidenceHonesty } from "../evidence-cards";
import { executeSynthesis } from "../synthesizer";

export async function handleLiteratureSynthesis(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  // ---------------------------------------------------------------
  // Step 1: Collect all evidence cards from completed evidence_gather nodes
  // ---------------------------------------------------------------
  const nodes = await store.getNodes(session.id);
  const artifacts = await store.getArtifacts(session.id);

  const evidenceNodes = nodes.filter(n =>
    n.nodeType === "evidence_gather" &&
    (n.status === "completed" || n.status === "failed")
  );

  const evidenceCardArtifacts = artifacts.filter(a =>
    a.artifactType === "evidence_card" || a.artifactType === "evidence_card_collection"
  );

  // ---------------------------------------------------------------
  // Step 2: Build EvidenceCardCollection from artifacts
  // ---------------------------------------------------------------
  const cards: EvidenceCard[] = [];
  const honestyWarnings: string[] = [];

  for (const art of evidenceCardArtifacts) {
    const content = art.content;

    // Handle evidence_card_collection artifacts (multiple cards)
    if (content.cards && Array.isArray(content.cards)) {
      for (const cardData of content.cards as EvidenceCard[]) {
        cards.push(cardData);
        const honesty = assessEvidenceHonesty(cardData);
        if (!honesty.honest) {
          honestyWarnings.push(...honesty.issues.map(i => `[${cardData.query}] ${i}`));
        }
      }
      continue;
    }

    // Handle single evidence_card artifacts — convert to EvidenceCard shape
    const card: EvidenceCard = {
      id: art.id,
      query: (content.query as string) ?? art.title,
      sources: Array.isArray(content.sources) ? content.sources as EvidenceCard["sources"] : [],
      rawExcerpts: Array.isArray(content.rawExcerpts) ? content.rawExcerpts as EvidenceCard["rawExcerpts"] : [],
      retrievalStatus: (content.retrievalStatus as EvidenceCard["retrievalStatus"]) ?? "success",
      sourcesFound: (content.sourcesFound as number) ??
        (content.totalFound as number) ??
        (content.papersFound as number) ??
        (Array.isArray(content.sources) ? content.sources.length : 0),
      sourcesAttempted: (content.sourcesAttempted as number) ?? (content.sourcesFound as number) ?? 1,
      retrievalNotes: (content.retrievalNotes as string) ?? "",
      createdAt: art.createdAt,
    };

    cards.push(card);
    const honesty = assessEvidenceHonesty(card);
    if (!honesty.honest) {
      honestyWarnings.push(...honesty.issues.map(i => `[${card.query}] ${i}`));
    }
  }

  // Also try to extract from legacy evidence_gather node outputs
  for (const eNode of evidenceNodes) {
    const hasCard = cards.some(c => c.id === eNode.id);
    const hasArtifact = evidenceCardArtifacts.some(a => a.nodeId === eNode.id);
    if (hasCard || hasArtifact) continue;

    // Legacy node: extract from output
    if (eNode.output) {
      const output = eNode.output;
      const legacyCard: EvidenceCard = {
        id: eNode.id,
        query: eNode.label,
        sources: Array.isArray(output.sources) ? output.sources as EvidenceCard["sources"] : [],
        rawExcerpts: [],
        retrievalStatus: (output.retrievalStatus as EvidenceCard["retrievalStatus"]) ?? "success",
        sourcesFound: (output.papersFound as number) ?? (output.totalFound as number) ?? 0,
        sourcesAttempted: 1,
        retrievalNotes: (output.coverageSummary as string) ?? "",
        createdAt: eNode.completedAt ?? eNode.createdAt,
      };
      cards.push(legacyCard);
    }
  }

  const collection = mergeEvidenceCards(cards);

  // ---------------------------------------------------------------
  // Step 3: Log honesty warnings
  // ---------------------------------------------------------------
  if (honestyWarnings.length > 0) {
    await store.addMessage(
      session.id,
      "system",
      `Evidence honesty check found ${honestyWarnings.length} warning(s):\n` +
      honestyWarnings.map(w => `- ${w}`).join("\n")
    );
  }

  // ---------------------------------------------------------------
  // Step 4: Check if we have enough evidence to synthesize
  // ---------------------------------------------------------------
  if (collection.totalSources === 0) {
    // No evidence at all — create a diagnostic node
    const emptyNode = await store.createNode(session.id, {
      nodeType: "synthesize",
      label: "Synthesis blocked: no evidence retrieved",
      assignedRole: "main_brain",
      input: {
        reason: "Zero sources across all evidence cards",
        retrievalSummary: collection.retrievalSummary,
      },
      phase: "literature_synthesis",
    });
    await store.updateNode(emptyNode.id, {
      status: "failed",
      error: "Cannot synthesize: no evidence was retrieved",
      completedAt: new Date().toISOString(),
    });

    return { completedNode: emptyNode, suggestedNextPhase: "evidence_collection" };
  }

  // ---------------------------------------------------------------
  // Step 5: Save evidence card collection as artifact
  // ---------------------------------------------------------------
  await store.createArtifact(
    session.id,
    null,
    "evidence_card_collection",
    `Evidence Collection (${collection.totalSources} sources, ${collection.cards.length} cards)`,
    collection as unknown as Record<string, unknown>,
  );

  // ---------------------------------------------------------------
  // Step 6: Run dedicated synthesizer to produce ClaimMap
  // ---------------------------------------------------------------
  try {
    const { claimMap, artifacts: synthArtifacts } = await executeSynthesis(
      session,
      collection,
      abortSignal,
    );

    // Also produce a structured_summary artifact for backward compatibility
    // (the reviewer-deliberation phase looks for structured_summary artifacts)
    const summaryContent = {
      claimMapId: synthArtifacts[0]?.id ?? null,
      totalClaims: claimMap.claims.length,
      strongClaims: claimMap.claims.filter(c => c.strength === "strong").length,
      moderateClaims: claimMap.claims.filter(c => c.strength === "moderate").length,
      weakClaims: claimMap.claims.filter(c => c.strength === "weak").length,
      unsupportedClaims: claimMap.claims.filter(c => c.strength === "unsupported").length,
      contradictions: claimMap.contradictions.length,
      gaps: claimMap.gaps.length,
      honestyWarnings: honestyWarnings.length,
      evidenceBase: {
        totalSources: collection.totalSources,
        totalExcerpts: collection.totalExcerpts,
        retrievalSummary: collection.retrievalSummary,
      },
      // Include claim summaries for backward compat
      claims: claimMap.claims.map(c => ({
        text: c.text,
        strength: c.strength,
        knowledgeType: c.knowledgeType,
        category: c.category,
      })),
      gapAnalysis: claimMap.gaps,
    };

    const synthNode = (await store.getNodes(session.id))
      .filter(n => n.nodeType === "synthesize_claims" && n.phase === "literature_synthesis")
      .pop();

    await store.createArtifact(
      session.id,
      synthNode?.id ?? null,
      "structured_summary",
      `Literature Synthesis Summary (${claimMap.claims.length} claims)`,
      summaryContent,
    );

    // Use the synth node as the completed node for checkpoint
    const completedNode = synthNode ?? (await store.getNodes(session.id)).slice(-1)[0];

    return { completedNode, suggestedNextPhase: "reviewer_deliberation" };
  } catch (error) {
    // Fallback: run the old-style synthesis via main brain node execution
    console.warn("[literature-synthesis] Dedicated synthesizer failed, falling back to main brain:", error);

    const emptyStreams = cards.filter(c => c.sourcesFound === 0).map(c => c.query);
    const successStreams = cards.filter(c => c.sourcesFound > 0).map(c => c.query);

    let evidenceStatusNote = "";
    if (emptyStreams.length > 0) {
      evidenceStatusNote = `\n\nEVIDENCE STATUS WARNING:\n` +
        `- ${successStreams.length} stream(s) returned evidence successfully\n` +
        `- ${emptyStreams.length} stream(s) returned EMPTY: ${emptyStreams.join(", ")}\n\n` +
        `CRITICAL RULES FOR SYNTHESIS:\n` +
        `1. ONLY cite findings from streams that actually returned evidence\n` +
        `2. For empty streams, mark those topics as "Evidence Not Retrieved"\n` +
        `3. Do NOT fabricate findings for empty streams\n` +
        `4. Clearly distinguish: "Retrieved Evidence" vs "Background Knowledge" vs "Assumptions"\n` +
        `5. Flag evidence gaps explicitly so reviewers can assess`;
    }

    const synthNode = await store.createNode(session.id, {
      nodeType: "synthesize",
      label: "Synthesize literature evidence (fallback)",
      assignedRole: "main_brain",
      input: { evidenceStatusNote, emptyStreams, successStreams },
      phase: "literature_synthesis",
    });

    const nodeCtx = await buildNodeContext(session.id);
    await executeNode(synthNode, nodeCtx, abortSignal);

    return { completedNode: synthNode, suggestedNextPhase: "reviewer_deliberation" };
  }
}
