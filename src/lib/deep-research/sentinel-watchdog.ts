// =============================================================
// Deep Research — Sentinel Watchdog
// =============================================================
// Background quality monitor that runs after key nodes complete.
// Checks: NaN/Inf detection, paper-evidence consistency, 
// citation relevance scoring, anti-fabrication guard.
// Ported from AutoResearchClaw's sentinel.sh and verified_registry.py.

import type {
  DeepResearchSession,
  DeepResearchArtifact,
  DeepResearchNode,
  SentinelAlert,
  SentinelReport,
  SentinelAlertType,
  ClaimMap,
  EvidenceCard,
} from "./types";
import { DEFAULT_SENTINEL_CONFIG } from "./config-types";
import type { SentinelConfig } from "./config-types";

// =============================================================
// Numeric Sanity Checks
// =============================================================

/**
 * Check for NaN, Infinity, and suspicious numeric values in artifacts.
 */
function checkNumericSanity(
  artifacts: DeepResearchArtifact[],
): SentinelAlert[] {
  const alerts: SentinelAlert[] = [];

  for (const artifact of artifacts) {
    const content = artifact.content as Record<string, unknown> | null;
    if (!content) continue;

    const contentStr = JSON.stringify(content);

    // Check for NaN
    if (/\bNaN\b/i.test(contentStr)) {
      alerts.push({
        alertType: "nan_inf_detected",
        severity: "critical",
        message: `NaN value detected in artifact "${artifact.title}" (${artifact.artifactType})`,
        artifactId: artifact.id,
        details: {
          artifactType: artifact.artifactType,
          artifactTitle: artifact.title,
          specific: "NaN",
        },
        detectedAt: new Date().toISOString(),
      });
    }

    // Check for Infinity
    if (/\bInfinity\b|(?:-)?Inf(?:inity)?/i.test(contentStr)) {
      alerts.push({
        alertType: "nan_inf_detected",
        severity: "critical",
        message: `Infinity value detected in artifact "${artifact.title}" (${artifact.artifactType})`,
        artifactId: artifact.id,
        details: {
          artifactType: artifact.artifactType,
          artifactTitle: artifact.title,
          specific: "Infinity",
        },
        detectedAt: new Date().toISOString(),
      });
    }

    // Check for suspiciously large numbers (> 1e15)
    const largeNumberMatch = contentStr.match(
      /(?<!["'\\w])[0-9]{16,}(?:\.[0-9]+)?(?!["'\\w])/g,
    );
    if (largeNumberMatch && largeNumberMatch.length > 0) {
      alerts.push({
        alertType: "nan_inf_detected",
        severity: "warning",
        message: `Suspiciously large numbers (${largeNumberMatch.length}) detected in "${artifact.title}"`,
        artifactId: artifact.id,
        details: {
          sampleValues: largeNumberMatch.slice(0, 3),
          count: largeNumberMatch.length,
        },
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

// =============================================================
// Evidence Consistency Checks
// =============================================================

/**
 * Check that paper claims are supported by collected evidence.
 */
function checkEvidenceConsistency(
  artifacts: DeepResearchArtifact[],
): SentinelAlert[] {
  const alerts: SentinelAlert[] = [];

  const claimMap = artifacts.find((a) => a.artifactType === "claim_map");
  const finalReport = artifacts.find((a) => a.artifactType === "final_report");

  if (claimMap && finalReport) {
    const mapContent = claimMap.content as unknown as ClaimMap | null;
    const reportContent = finalReport.content as Record<string, unknown> | null;

    if (mapContent && reportContent) {
      const unsupportedClaims = mapContent.claims?.filter(
        (c) => c.strength === "unsupported",
      );

      if (unsupportedClaims && unsupportedClaims.length > 0) {
        alerts.push({
          alertType: "evidence_mismatch",
          severity: "warning",
          message: `${unsupportedClaims.length} claims in the report have no supporting evidence`,
          artifactId: finalReport.id,
          details: {
            unsupportedClaimCount: unsupportedClaims.length,
            unsupportedClaims: unsupportedClaims
              .slice(0, 3)
              .map((c) => c.text),
            recommendation:
              "Remove unsupported claims or conduct additional literature search to find supporting evidence.",
          },
          detectedAt: new Date().toISOString(),
        });
      }

      // Check contradictions
      if (
        mapContent.contradictions &&
        mapContent.contradictions.length > 0
      ) {
        alerts.push({
          alertType: "evidence_mismatch",
          severity: "warning",
          message: `${mapContent.contradictions.length} contradictions found between claims`,
          artifactId: finalReport.id,
          details: {
            contradictionCount: mapContent.contradictions.length,
            contradictions: mapContent.contradictions
              .slice(0, 3)
              .map((c) => c.description),
            recommendation:
              "Resolve contradictions before finalizing the report.",
          },
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  // Check that structured summaries have evidence backing
  const structuredSummaries = artifacts.filter(
    (a) => a.artifactType === "structured_summary",
  );
  const evidenceCards = artifacts.filter(
    (a) => a.artifactType === "evidence_card",
  );

  if (
    structuredSummaries.length > 0 &&
    evidenceCards.length === 0
  ) {
    alerts.push({
      alertType: "evidence_mismatch",
      severity: "warning",
      message: "Structured summaries exist but no evidence cards were collected",
      details: {
        summaryCount: structuredSummaries.length,
        evidenceCount: 0,
        recommendation:
          "Run evidence_gather nodes to collect supporting literature.",
      },
      detectedAt: new Date().toISOString(),
    });
  }

  return alerts;
}

// =============================================================
// Citation Relevance Check
// =============================================================

/**
 * Check if citations in the report reference real, collected sources.
 * Anti-fabrication guard — flags citations that don't map to collected evidence.
 */
function checkCitationRelevance(
  artifacts: DeepResearchArtifact[],
): SentinelAlert[] {
  const alerts: SentinelAlert[] = [];

  const finalReport = artifacts.find((a) => a.artifactType === "final_report");
  if (!finalReport) return alerts;

  const reportContent = finalReport.content as Record<string, unknown> | null;
  if (!reportContent) return alerts;

  const reportText =
    (reportContent.report as string) ?? JSON.stringify(reportContent);

  // Extract citation keys from evidence cards
  const evidenceCards = artifacts.filter(
    (a) => a.artifactType === "evidence_card",
  );
  const knownTitles = new Set<string>();
  const knownUrls = new Set<string>();

  for (const card of evidenceCards) {
    const ec = card.content as Record<string, unknown> | null;
    if (!ec) continue;
    const sources = (ec.sources as Array<Record<string, unknown>>) ?? [];
    for (const source of sources) {
      if (source.title) knownTitles.add(String(source.title).toLowerCase());
      if (source.url) knownUrls.add(String(source.url));
    }
  }

  // Extract citations from report text — look for patterns like [1], [Author 2024], etc.
  const citationPatterns = [
    /\[(\d+)\]/g,
    /\(([A-Z][a-z]+(?:\s+(?:et\s+al\.?|&\s+[A-Z][a-z]+))?(?:,\s*\d{4}[a-z]?)?)\)/g,
    /([A-Z][a-z]+\s+et\s+al\.?(?:\s*\(\d{4}[a-z]?\))?)/g,
  ];

  let totalCitations = 0;
  let unmatchedCitations = 0;

  for (const pattern of citationPatterns) {
    const matches = reportText.matchAll(pattern);
    for (const match of matches) {
      totalCitations++;
      const citeText = match[0].toLowerCase();
      const isKnown = Array.from(knownTitles).some(
        (t) => citeText.includes(t.slice(0, 20)),
      );
      if (!isKnown) {
        unmatchedCitations++;
      }
    }
  }

  if (unmatchedCitations > 0 && totalCitations > 5) {
    const ratio = unmatchedCitations / totalCitations;
    const severity: "warning" | "critical" =
      ratio > 0.3 ? "critical" : "warning";

    alerts.push({
      alertType: "citation_fabrication",
      severity,
      message: `${unmatchedCitations}/${totalCitations} citations (${(ratio * 100).toFixed(0)}%) could not be verified against collected evidence`,
      artifactId: finalReport.id,
      details: {
        totalCitations,
        unmatchedCitations,
        ratio,
        recommendation:
          ratio > 0.3
            ? "CRITICAL: High rate of unverified citations. Consider re-running literature collection or removing unverified claims."
            : "Some citations could not be verified. Review and either find supporting evidence or mark as speculative.",
      },
      detectedAt: new Date().toISOString(),
    });
  }

  return alerts;
}

// =============================================================
// Quality Degradation Check
// =============================================================

/**
 * Check for quality degradation across review rounds.
 */
function checkQualityDegradation(
  artifacts: DeepResearchArtifact[],
): SentinelAlert[] {
  const alerts: SentinelAlert[] = [];

  const reviewPackets = artifacts.filter(
    (a) => a.artifactType === "reviewer_packet",
  );

  if (reviewPackets.length >= 2) {
    // Check if review scores are declining
    const scores: number[] = [];
    for (const packet of reviewPackets) {
      const content = packet.content as Record<string, unknown> | null;
      const rating = content?.combinedConfidence as number | undefined;
      if (typeof rating === "number") scores.push(rating);
    }

    if (scores.length >= 2) {
      const first = scores[0];
      const last = scores[scores.length - 1];
      if (last < first * 0.5) {
        alerts.push({
          alertType: "quality_degradation",
          severity: "warning",
          message: `Review quality decreased from ${(first * 100).toFixed(0)}% to ${(last * 100).toFixed(0)}% across ${scores.length} rounds`,
          details: {
            initialScore: first,
            currentScore: last,
            reviewRounds: scores.length,
            recommendation:
              "Consider pivoting research direction or requesting additional literature.",
          },
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return alerts;
}

// =============================================================
// Main Sentinel Runner
// =============================================================

export interface SentinelRunOptions {
  config?: Partial<SentinelConfig>;
  artifacts: DeepResearchArtifact[];
  nodes: DeepResearchNode[];
  session: DeepResearchSession;
}

/**
 * Run all sentinel checks and return a report.
 */
export function runSentinelChecks(
  options: SentinelRunOptions,
): SentinelReport {
  const config = { ...DEFAULT_SENTINEL_CONFIG, ...options.config };
  const alerts: SentinelAlert[] = [];

  if (config.checkNumericSanity) {
    alerts.push(...checkNumericSanity(options.artifacts));
  }

  if (config.checkEvidenceConsistency) {
    alerts.push(...checkEvidenceConsistency(options.artifacts));
  }

  if (config.checkCitationRelevance) {
    alerts.push(...checkCitationRelevance(options.artifacts));
  }

  alerts.push(...checkQualityDegradation(options.artifacts));

  // Budget check
  const budgetRatio =
    options.session.budget.totalTokens /
    options.session.config.budget.maxTotalTokens;
  if (budgetRatio > 0.8) {
    alerts.push({
      alertType: "budget_exceeded",
      severity: budgetRatio > 0.95 ? "critical" : "warning",
      message: `Budget usage at ${(budgetRatio * 100).toFixed(0)}% (${options.session.budget.totalTokens}/${options.session.config.budget.maxTotalTokens} tokens)`,
      details: {
        currentUsage: options.session.budget.totalTokens,
        maxBudget: options.session.config.budget.maxTotalTokens,
        ratio: budgetRatio,
      },
      detectedAt: new Date().toISOString(),
    });
  }

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const infoCount = alerts.filter((a) => a.severity === "info").length;

  const overallHealth: SentinelReport["overallHealth"] =
    criticalCount > 0
      ? "critical"
      : warningCount > 2
        ? "degraded"
        : "healthy";

  const recommendations = alerts
    .filter((a) => a.details.recommendation)
    .map((a) => a.details.recommendation as string);

  return {
    sessionId: options.session.id,
    alerts,
    overallHealth,
    checksRun: 4, // numeric, evidence, citation, quality
    checksFailed: alerts.length,
    recommendations: [
      ...new Set(recommendations),
    ],
  };
}

/**
 * Check if sentinel report indicates auto-pause should trigger.
 */
export function shouldAutoPause(
  report: SentinelReport,
  config?: Partial<SentinelConfig>,
): boolean {
  const cfg = { ...DEFAULT_SENTINEL_CONFIG, ...config };
  const criticalAlerts = report.alerts.filter(
    (a) => a.severity === "critical",
  );

  if (criticalAlerts.length > 0) return true;

  if (report.overallHealth === "degraded") {
    const alertRatio = report.checksFailed / Math.max(report.checksRun, 1);
    return alertRatio >= cfg.autoPauseSeverityThreshold;
  }

  return false;
}
