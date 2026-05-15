// =============================================================
// Deep Research — Claim Verification / Anti-Fabrication
// =============================================================
// Inline fact-checking: extracts claims from AI-generated text and
// cross-references against collected literature. Flags ungrounded
// citations and fabricated numbers.
// Ported from AutoResearchClaw's verified_registry.py and paper_verifier.py.

import type {
  DeepResearchArtifact,
  DeepResearchNode,
  Claim,
  ClaimMap,
  EvidenceCard,
  VerifiedClaim,
  ClaimVerificationReport,
  FabricationFlag,
  ClaimVerificationStatus,
} from "./types";
import { DEFAULT_CLAIM_VERIFICATION_CONFIG } from "./config-types";
import type { ClaimVerificationConfig } from "./config-types";

// =============================================================
// Number extraction and verification
// =============================================================

/**
 * Extract numeric values from text that appear to be research results.
 * Filters out years, page numbers, reference numbers, etc.
 */
function extractResearchNumbers(text: string): Array<{
  value: number;
  context: string;
}> {
  const numbers: Array<{ value: number; context: string }> = [];

  // Match numbers with surrounding context (up to 50 chars before and after)
  const pattern = /(.{0,50}?)(\b\d+\.?\d*\s*%?)(.{0,50})/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const numStr = match[2].replace("%", "").trim();
    const numVal = parseFloat(numStr);

    // Skip years (2020-2030), page numbers, reference numbers
    if (numVal >= 2020 && numVal <= 2030 && Number.isInteger(numVal)) continue;
    if (numVal < 0.001 && numVal > -0.001) continue;
    if (numVal > 1e12) continue; // Infrastructure numbers

    const context = (match[1] + match[2] + match[3]).trim();

    // Skip non-research numbers
    const skipWords = [
      "page",
      "reference",
      "figure",
      "table",
      "section",
      "chapter",
      "equation",
      "epoch",
      "step",
      "iteration",
      "seed",
    ];
    if (skipWords.some((w) => context.toLowerCase().includes(w))) continue;

    numbers.push({ value: numVal, context });
  }

  return numbers;
}

/**
 * Check if a specific numeric value is grounded in collected evidence.
 */
function isNumberGrounded(
  value: number,
  evidenceCards: DeepResearchArtifact[],
): { grounded: boolean; sourceId?: string; matchValue?: number } {
  const tolerance = 0.02; // 2% tolerance for floating point comparison

  for (const card of evidenceCards) {
    const content = card.content as Record<string, unknown> | null;
    if (!content) continue;

    const contentStr = JSON.stringify(content);
    const cardNumbers = extractResearchNumbers(contentStr);

    for (const cn of cardNumbers) {
      if (Math.abs(cn.value - value) / Math.max(Math.abs(value), 1e-6) < tolerance) {
        return { grounded: true, sourceId: card.id, matchValue: cn.value };
      }
    }
  }

  return { grounded: false };
}

// =============================================================
// Claim Cross-Referencing
// =============================================================

/**
 * Verify claims against collected evidence using fuzzy or strict matching.
 */
function verifyClaimAgainstEvidence(
  claim: Claim,
  evidenceCards: DeepResearchArtifact[],
  config: ClaimVerificationConfig,
): VerifiedClaim {
  const status = determineClaimStatus(claim, evidenceCards, config);
  const numericResults = verifyNumericClaims(claim.text, evidenceCards);

  return {
    claimId: claim.id,
    claimText: claim.text,
    status,
    supportingSourceIds: claim.supportingSources.map(String),
    contradictingSourceIds: claim.contradictingSources.map(String),
    confidenceScore: claim.strength === "strong" ? 0.9 : claim.strength === "moderate" ? 0.6 : 0.3,
    numericGrounded: numericResults.allGrounded,
    groundTruthValues: numericResults.groundTruthValues,
    discrepancies: numericResults.discrepancies,
  };
}

function determineClaimStatus(
  claim: Claim,
  evidenceCards: DeepResearchArtifact[],
  config: ClaimVerificationConfig,
): ClaimVerificationStatus {
  if (claim.knowledgeType === "assumption" || claim.knowledgeType === "speculation") {
    return "pending";
  }

  const supportingCount = claim.supportingSources.length;
  if (supportingCount >= config.minSupportingSources) {
    // Verify the supporting sources actually exist in evidence cards
    const verifiedSources = claim.supportingSources.filter((srcIdx) => {
      return evidenceCards.some((card) => {
        const content = card.content as Record<string, unknown> | null;
        const sources = (content?.sources as Array<Record<string, unknown>>) ?? [];
        return srcIdx < sources.length;
      });
    });

    if (verifiedSources.length >= config.minSupportingSources) {
      return "verified";
    }
    return "partially_verified";
  }

  if (claim.contradictingSources.length > 0) {
    return "fabricated";
  }

  if (config.autoFlagUnsupported) {
    return "unverified";
  }

  return "pending";
}

function verifyNumericClaims(
  claimText: string,
  evidenceCards: DeepResearchArtifact[],
): {
  allGrounded: boolean;
  groundTruthValues: Record<string, number>;
  discrepancies: string[];
} {
  const numbers = extractResearchNumbers(claimText);
  const groundTruthValues: Record<string, number> = {};
  const discrepancies: string[] = [];
  let allGrounded = true;

  for (const num of numbers) {
    const result = isNumberGrounded(num.value, evidenceCards);
    if (result.grounded && result.matchValue !== undefined) {
      const key = `value_${num.value.toFixed(4)}`;
      groundTruthValues[key] = result.matchValue;

      // Check for significant discrepancy
      const relativeDiff =
        Math.abs(num.value - result.matchValue) /
        Math.max(Math.abs(num.value), 1e-6);
      if (relativeDiff > 0.01) {
        discrepancies.push(
          `Value ${num.value.toFixed(4)} differs from ground truth ${result.matchValue.toFixed(4)} (${(relativeDiff * 100).toFixed(1)}% difference)`,
        );
      }
    } else {
      allGrounded = false;
    }
  }

  return { allGrounded, groundTruthValues, discrepancies };
}

// =============================================================
// Main Verification Runner
// =============================================================

export interface ClaimVerificationInput {
  claimMap: ClaimMap | null;
  evidenceCards: DeepResearchArtifact[];
  finalReportText?: string;
  config?: Partial<ClaimVerificationConfig>;
}

/**
 * Run claim verification on a research report.
 * Cross-references all claims against collected evidence.
 */
export function verifyClaims(
  input: ClaimVerificationInput,
): ClaimVerificationReport {
  const config = { ...DEFAULT_CLAIM_VERIFICATION_CONFIG, ...input.config };

  if (!config.enabled || !input.claimMap) {
    return {
      totalClaims: 0,
      verifiedCount: 0,
      partiallyVerifiedCount: 0,
      unverifiedCount: 0,
      fabricatedCount: 0,
      claims: [],
      overallTrustScore: 1.0,
      recommendations: [],
    };
  }

  const claims = input.claimMap.claims ?? [];
  const verifiedClaims: VerifiedClaim[] = claims.map((claim) =>
    verifyClaimAgainstEvidence(claim, input.evidenceCards, config),
  );

  const verifiedCount = verifiedClaims.filter(
    (c) => c.status === "verified",
  ).length;
  const partiallyVerifiedCount = verifiedClaims.filter(
    (c) => c.status === "partially_verified",
  ).length;
  const unverifiedCount = verifiedClaims.filter(
    (c) => c.status === "unverified",
  ).length;
  const fabricatedCount = verifiedClaims.filter(
    (c) => c.status === "fabricated",
  ).length;

  // Calculate overall trust score
  const totalWeighted =
    verifiedCount * 1.0 +
    partiallyVerifiedCount * 0.5 +
    unverifiedCount * 0.1 +
    fabricatedCount * 0;
  const overallTrustScore =
    claims.length > 0 ? totalWeighted / claims.length : 1.0;

  const recommendations: string[] = [];
  if (fabricatedCount > 0) {
    recommendations.push(
      `Remove or re-verify ${fabricatedCount} fabricated claim(s). These claims contradict collected evidence.`,
    );
  }
  if (unverifiedCount > 0) {
    recommendations.push(
      `${unverifiedCount} claim(s) lack supporting evidence. Run additional evidence_gather nodes or mark as speculative.`,
    );
  }
  if (partiallyVerifiedCount > 0) {
    recommendations.push(
      `${partiallyVerifiedCount} claim(s) partially verified — some supporting sources could not be confirmed.`,
    );
  }

  return {
    totalClaims: claims.length,
    verifiedCount,
    partiallyVerifiedCount,
    unverifiedCount,
    fabricatedCount,
    claims: verifiedClaims,
    overallTrustScore,
    recommendations,
  };
}

/**
 * Extract fabrication flags from verification report.
 */
export function extractFabricationFlags(
  report: ClaimVerificationReport,
): FabricationFlag[] {
  return report.claims
    .filter(
      (c) => c.status === "fabricated" || c.status === "unverified",
    )
    .map((c) => ({
      claimId: c.claimId,
      claimText: c.claimText,
      reason:
        c.status === "fabricated"
          ? "Claim contradicts collected evidence"
          : "Claim lacks supporting evidence",
      severity:
        c.status === "fabricated"
          ? ("critical" as const)
          : ("warning" as const),
      suggestedFix:
        c.status === "fabricated"
          ? "Remove this claim or find alternative supporting evidence"
          : "Mark as speculative or run additional literature search",
    }));
}

/**
 * Check if verification report is acceptable for finalization.
 */
export function isVerificationAcceptable(
  report: ClaimVerificationReport,
  minTrustScore: number = 0.7,
): boolean {
  if (report.fabricatedCount > 0) return false;
  return report.overallTrustScore >= minTrustScore;
}
