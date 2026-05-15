// =============================================================
// Deep Research — Evolution Store (Cross-Session Learning)
// =============================================================
// Records lessons from each research session and injects them
// into future sessions as prompt overlays with 30-day time-decay.
// Ported from AutoResearchClaw's evolution.py.
//
// Architecture:
//   LessonCategory — 6 categories for classification
//   EvolutionLesson — single lesson record
//   EvolutionStore — JSONL-backed persistent store with append + query
//   extractLessons() — auto-extract from session artifacts
//   buildOverlay() — generate per-stage prompt overlay

import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { deepResearchSessions, deepResearchArtifacts, deepResearchNodes } from "@/lib/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  EvolutionLesson,
  EvolutionOverlay,
  LessonCategory,
  LessonSeverity,
  DeepResearchSession,
  DeepResearchArtifact,
  DeepResearchNode,
  SentinelAlert,
} from "./types";
import { DEFAULT_EVOLUTION_CONFIG } from "./config-types";
import type { EvolutionConfig } from "./config-types";

// =============================================================
// Time-decay weighting
// =============================================================

const MS_PER_DAY = 86_400_000;

function computeTimeDecayWeight(
  recordedAt: string,
  halfLifeDays: number = 30,
): number {
  const ageMs = Date.now() - new Date(recordedAt).getTime();
  const ageDays = ageMs / MS_PER_DAY;
  // Exponential decay: weight = 2^(-age/halfLife)
  return Math.pow(2, -ageDays / halfLifeDays);
}

// =============================================================
// Lesson Extraction
// =============================================================

function classifySeverityFromArtifact(
  artifact: DeepResearchArtifact,
): LessonSeverity {
  const content = JSON.stringify(artifact.content ?? {}).toLowerCase();
  if (
    content.includes("failed") ||
    content.includes("error") ||
    content.includes("critical") ||
    content.includes("fabricated")
  ) {
    return "critical";
  }
  if (
    content.includes("warning") ||
    content.includes("concern") ||
    content.includes("issue")
  ) {
    return "high";
  }
  if (
    content.includes("improve") ||
    content.includes("suggestion") ||
    content.includes("note")
  ) {
    return "medium";
  }
  return "low";
}

function mapArtifactTypeToCategory(
  artifactType: string,
): LessonCategory {
  const mapping: Record<string, LessonCategory> = {
    evidence_card: "literature",
    literature_round_summary: "literature",
    structured_summary: "literature",
    reviewer_packet: "review",
    review_assessment: "review",
    pivot_decision: "hypothesis",
    experiment_result: "experiment",
    step_result: "experiment",
    repair_cycle_log: "experiment",
    final_report: "writing",
    validation_report: "review",
    sentinel_report: "system",
    fabrication_flag: "writing",
    claim_verification_report: "review",
  };
  return mapping[artifactType] ?? "system";
}

function extractLessonFromArtifact(
  artifact: DeepResearchArtifact,
  sessionId: string,
  nodeId?: string,
): EvolutionLesson | null {
  const content = artifact.content as Record<string, unknown> | null;
  if (!content) return null;

  const description = (content.summary as string) ??
    (content.description as string) ??
    (content.message as string) ??
    (content.error as string) ??
    `Artifact: ${artifact.title}`;

  const recommendation = (content.recommendation as string) ??
    (content.suggestedFix as string) ??
    (content.recommendedAction as string) ??
    "";

  if (!description || description.length < 10) return null;

  const category = mapArtifactTypeToCategory(artifact.artifactType);
  const severity = classifySeverityFromArtifact(artifact);

  // Only extract lessons from high-signal artifacts
  if (severity === "low" && artifact.artifactType !== "final_report") {
    return null;
  }

  return {
    id: nanoid(),
    category,
    severity,
    stage: artifact.artifactType,
    description,
    recommendation,
    sourceSessionId: sessionId,
    sourceNodeId: nodeId ?? artifact.nodeId ?? undefined,
    recordedAt: new Date().toISOString(),
    tags: [artifact.artifactType, category, severity],
    contextData: {
      artifactTitle: artifact.title,
      artifactType: artifact.artifactType,
    },
  };
}

/**
 * Extract lessons from completed session artifacts.
 * Scans all artifacts and generates EvolutionLesson entries.
 */
export async function extractLessons(
  sessionId: string,
): Promise<EvolutionLesson[]> {
  const artifacts = await db
    .select()
    .from(deepResearchArtifacts)
    .where(eq(deepResearchArtifacts.sessionId, sessionId));

  const lessons: EvolutionLesson[] = [];
  for (const artifact of artifacts) {
    const lesson = extractLessonFromArtifact(
      artifact as unknown as DeepResearchArtifact,
      sessionId,
      artifact.nodeId ?? undefined,
    );
    if (lesson) {
      lessons.push(lesson);
    }
  }

  return lessons;
}

/**
 * Extract lessons from sentinel alerts.
 */
export function extractLessonsFromAlerts(
  alerts: SentinelAlert[],
  sessionId: string,
): EvolutionLesson[] {
  return alerts.map((alert) => ({
    id: nanoid(),
    category: "system" as LessonCategory,
    severity: alert.severity as LessonSeverity,
    stage: "sentinel_check",
    description: `[${alert.alertType}] ${alert.message}`,
    recommendation: alert.details.recommendation as string ?? "Review the alert and take corrective action.",
    sourceSessionId: sessionId,
    sourceNodeId: alert.nodeId,
    recordedAt: alert.detectedAt,
    tags: ["sentinel", alert.alertType, alert.severity],
    contextData: alert.details,
  }));
}

// =============================================================
// Evolution Store — Persistent JSONL-backed store
// =============================================================

export class EvolutionStore {
  private storePath: string;
  private config: EvolutionConfig;

  constructor(storeDir: string, config?: Partial<EvolutionConfig>) {
    this.storePath = path.join(storeDir, "evolution-lessons.jsonl");
    this.config = { ...DEFAULT_EVOLUTION_CONFIG, ...config };
  }

  /**
   * Append lessons to the persistent store.
   */
  async append(lessons: EvolutionLesson[]): Promise<void> {
    if (!this.config.enabled) return;

    const lines = lessons
      .filter((l) => this.config.enabledCategories.includes(l.category))
      .map((l) => JSON.stringify(l) + "\n")
      .join("");

    if (!lines) return;

    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    await fs.appendFile(this.storePath, lines, "utf-8");
  }

  /**
   * Query lessons relevant to a given stage/category with time-decay weighting.
   */
  async query(params: {
    category?: LessonCategory;
    stage?: string;
    maxLessons?: number;
    minSeverity?: LessonSeverity;
  }): Promise<EvolutionLesson[]> {
    const maxLessons = params.maxLessons ?? this.config.maxLessonsPerSession;

    try {
      const raw = await fs.readFile(this.storePath, "utf-8");
      const allLessons: EvolutionLesson[] = raw
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as EvolutionLesson);

      const severityOrder: LessonSeverity[] = [
        "critical",
        "high",
        "medium",
        "low",
      ];
      const minSeverityIdx = params.minSeverity
        ? severityOrder.indexOf(params.minSeverity)
        : severityOrder.indexOf("low");

      const filtered = allLessons
        .filter((l) => {
          if (params.category && l.category !== params.category) return false;
          if (params.stage && l.stage !== params.stage) return false;
          const severityIdx = severityOrder.indexOf(l.severity);
          if (severityIdx > minSeverityIdx) return false;
          return true;
        })
        .map((l) => ({
          lesson: l,
          score:
            computeTimeDecayWeight(l.recordedAt, this.config.timeDecayDays) *
            (1 + severityOrder.indexOf(l.severity) * 0.25), // Boost by severity
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxLessons);

      return filtered.map((f) => f.lesson);
    } catch {
      // Store file doesn't exist yet — no lessons available
      return [];
    }
  }

  /**
   * Build a prompt overlay from relevant lessons for injection into LLM context.
   */
  async buildOverlay(params: {
    stage: string;
    category?: LessonCategory;
    maxLessons?: number;
  }): Promise<EvolutionOverlay | null> {
    if (!this.config.enabled) return null;

    const lessons = await this.query({
      stage: params.stage,
      category: params.category,
      maxLessons: params.maxLessons ?? this.config.maxLessonsPerSession,
    });

    if (lessons.length === 0) return null;

    const relevanceScore =
      lessons.reduce((sum, l) => {
        return (
          sum +
          computeTimeDecayWeight(l.recordedAt, this.config.timeDecayDays)
        );
      }, 0) / lessons.length;

    const promptOverlay = `

## Lessons from Past Research Runs

${lessons
      .map(
        (l, i) =>
          `${i + 1}. **[${l.severity.toUpperCase()}] ${l.category}** — ${l.description}
   Recommendation: ${l.recommendation || "Review and avoid repeating this issue."}`,
      )
      .join("\n\n")}

Use these lessons to avoid repeating past mistakes and improve research quality.`;

    return {
      lessons,
      relevanceScore,
      promptOverlay,
    };
  }

  /**
   * Get all unique categories present in the store.
   */
  async getCategories(): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.storePath, "utf-8");
      const categories = new Set<string>();
      for (const line of raw.split("\n").filter(Boolean)) {
        const lesson = JSON.parse(line) as EvolutionLesson;
        categories.add(lesson.category);
      }
      return Array.from(categories);
    } catch {
      return [];
    }
  }

  /**
   * Count total lessons in store.
   */
  async count(): Promise<number> {
    try {
      const raw = await fs.readFile(this.storePath, "utf-8");
      return raw.split("\n").filter(Boolean).length;
    } catch {
      return 0;
    }
  }
}

/**
 * Extract lessons from a completed session and append to the evolution store.
 * Called when a session completes.
 */
export async function harvestSessionLessons(
  sessionId: string,
  store: EvolutionStore,
): Promise<EvolutionLesson[]> {
  const lessons = await extractLessons(sessionId);

  // Also check for sentinel reports
  const sentinelArtifacts = await db
    .select()
    .from(deepResearchArtifacts)
    .where(
      and(
        eq(deepResearchArtifacts.sessionId, sessionId),
        eq(deepResearchArtifacts.artifactType, "sentinel_report"),
      ),
    );

  for (const art of sentinelArtifacts) {
    const content = art.contentJson
      ? (JSON.parse(art.contentJson) as Record<string, unknown>)
      : null;
    if (content?.alerts) {
      const alertLessons = extractLessonsFromAlerts(
        (content.alerts as SentinelAlert[]).filter(
          (a) => a.severity === "critical" || a.severity === "warning",
        ),
        sessionId,
      );
      lessons.push(...alertLessons);
    }
  }

  await store.append(lessons);
  return lessons;
}

// =============================================================
// Singleton store access
// =============================================================

let _defaultStore: EvolutionStore | null = null;

export function getEvolutionStore(
  dataDir: string = "./data",
  config?: Partial<EvolutionConfig>,
): EvolutionStore {
  if (!_defaultStore) {
    _defaultStore = new EvolutionStore(dataDir, config);
  }
  return _defaultStore;
}

export function resetEvolutionStore(): void {
  _defaultStore = null;
}
