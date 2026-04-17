import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { writeFile } from "@/lib/files/filesystem";
import * as store from "./event-store";
import type {
  CheckpointPackage,
  ClaimMap,
  DeepResearchArtifact,
  DeepResearchMessage,
  DeepResearchSession,
  ReviewAssessment,
} from "./types";

const ARCHIVE_DIR_NAME = "deep-research-memory";
const ARCHIVE_MANIFEST_KIND = "context_archive";
const ARCHIVE_SOURCE_CHAR_THRESHOLD = 12_000;
const ARCHIVE_SOURCE_COUNT_THRESHOLD = 10;
const MAX_ARCHIVE_SOURCE_FILES = 18;
const MAX_ARCHIVE_SOURCE_CHARS = 14_000;
const MAX_ARCHIVE_EXCERPTS_PER_FILE = 6;
const DEFAULT_EXCERPT_CHAR_LIMIT = 900;
const DEFAULT_RETRIEVAL_TOP_K = 6;
const DEFAULT_PROMPT_BLOCK_CHAR_LIMIT = 2_800;

interface ArchiveSourceDocument {
  id: string;
  title: string;
  category: "artifact" | "message";
  artifactId?: string;
  artifactType?: DeepResearchArtifact["artifactType"];
  nodeId?: string | null;
  messageId?: string;
  createdAt: string;
  updatedAt: string;
  importance: number;
  content: string;
  summary: string;
  keywords: string[];
}

export interface ResearchContextArchiveExcerpt {
  id: string;
  title: string;
  heading: string;
  text: string;
  keywords: string[];
  charCount: number;
}

export interface ResearchContextArchiveRecord {
  id: string;
  title: string;
  category: "artifact" | "message";
  artifactId?: string;
  artifactType?: DeepResearchArtifact["artifactType"];
  nodeId?: string | null;
  messageId?: string;
  createdAt: string;
  updatedAt: string;
  importance: number;
  summary: string;
  keywords: string[];
  charCount: number;
  filePath: string;
  excerptCount: number;
  excerpts: ResearchContextArchiveExcerpt[];
}

export interface ResearchContextArchiveManifest {
  manifestKind: "context_archive";
  sessionId: string;
  generatedAt: string;
  archiveDir: string;
  fileCount: number;
  sourceFingerprint: string;
  records: ResearchContextArchiveRecord[];
}

export interface RetrievedArchiveExcerpt extends ResearchContextArchiveExcerpt {
  filePath: string;
  artifactId?: string;
  artifactType?: DeepResearchArtifact["artifactType"];
  nodeId?: string | null;
  messageId?: string;
  summary: string;
  retrievalScore: number;
}

export async function buildResearchContextArchivePromptBlock(input: {
  session: DeepResearchSession;
  messages: DeepResearchMessage[];
  artifacts: DeepResearchArtifact[];
  query: string;
  topK?: number;
  maxChars?: number;
}): Promise<string | null> {
  const manifest = await ensureResearchContextArchive(input);
  if (!manifest) {
    return null;
  }

  const retrieved = retrieveResearchContextArchive(
    manifest,
    input.query,
    input.topK ?? DEFAULT_RETRIEVAL_TOP_K,
  );
  if (retrieved.length === 0) {
    return null;
  }

  return formatResearchContextArchivePromptBlock({
    query: input.query,
    archiveDir: manifest.archiveDir,
    excerpts: retrieved,
    maxChars: input.maxChars ?? DEFAULT_PROMPT_BLOCK_CHAR_LIMIT,
  });
}

export async function ensureResearchContextArchive(input: {
  session: DeepResearchSession;
  messages: DeepResearchMessage[];
  artifacts: DeepResearchArtifact[];
}): Promise<ResearchContextArchiveManifest | null> {
  const sourceDocs = buildArchiveSourceDocuments(input.messages, input.artifacts);
  if (!shouldPersistContextArchive(sourceDocs)) {
    return null;
  }

  const existingManifest = getLatestContextArchiveManifest(input.artifacts);
  const sourceFingerprint = buildArchiveSourceFingerprint(sourceDocs);
  if (existingManifest?.sourceFingerprint === sourceFingerprint) {
    return existingManifest;
  }

  const workspace = await resolveWorkspace(input.session.workspaceId);
  if (!workspace) {
    return null;
  }

  const archiveDir = path.join(workspace.folderPath, ARCHIVE_DIR_NAME, input.session.id);
  const records = sourceDocs.map((source) => {
    const safeTitle = slugifyFileName(source.title || source.id);
    const filePath = path.join(archiveDir, `${source.id}-${safeTitle}.md`);
    const excerpts = splitContextTextIntoExcerpts(source.content, DEFAULT_EXCERPT_CHAR_LIMIT)
      .slice(0, MAX_ARCHIVE_EXCERPTS_PER_FILE)
      .map((excerpt, index) => ({
        id: `${source.id}:excerpt:${index + 1}`,
        title: source.title,
        heading: excerpt.heading,
        text: excerpt.text,
        keywords: dedupeStrings([
          ...source.keywords,
          ...extractKeywords(excerpt.heading),
          ...extractKeywords(excerpt.text),
        ]).slice(0, 18),
        charCount: excerpt.text.length,
      }));

    return {
      id: source.id,
      title: source.title,
      category: source.category,
      artifactId: source.artifactId,
      artifactType: source.artifactType,
      nodeId: source.nodeId,
      messageId: source.messageId,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      importance: source.importance,
      summary: source.summary,
      keywords: source.keywords,
      charCount: source.content.length,
      filePath,
      excerptCount: excerpts.length,
      excerpts,
    } satisfies ResearchContextArchiveRecord;
  });

  for (const source of sourceDocs) {
    const record = records.find((candidate) => candidate.id === source.id);
    if (!record) continue;
    await writeFile(record.filePath, buildArchiveMarkdown(source, record));
  }

  const manifest: ResearchContextArchiveManifest = {
    manifestKind: ARCHIVE_MANIFEST_KIND,
    sessionId: input.session.id,
    generatedAt: new Date().toISOString(),
    archiveDir,
    fileCount: records.length,
    sourceFingerprint,
    records,
  };

  await store.createArtifact(
    input.session.id,
    null,
    "data_manifest",
    `Context Archive (${records.length} files)`,
    manifest as unknown as Record<string, unknown>,
  );

  return manifest;
}

export function retrieveResearchContextArchive(
  manifest: ResearchContextArchiveManifest,
  query: string,
  topK = DEFAULT_RETRIEVAL_TOP_K,
): RetrievedArchiveExcerpt[] {
  const scored = manifest.records.flatMap((record) =>
    record.excerpts.map((excerpt) => ({
      ...excerpt,
      filePath: record.filePath,
      artifactId: record.artifactId,
      artifactType: record.artifactType,
      nodeId: record.nodeId,
      messageId: record.messageId,
      summary: record.summary,
      retrievalScore: scoreArchiveExcerpt(record, excerpt, query),
    })),
  );

  return scored
    .filter((item) => item.retrievalScore > 0)
    .sort((left, right) => right.retrievalScore - left.retrievalScore)
    .slice(0, topK);
}

export function formatResearchContextArchivePromptBlock(input: {
  query: string;
  archiveDir: string;
  excerpts: RetrievedArchiveExcerpt[];
  maxChars?: number;
}): string | null {
  if (input.excerpts.length === 0) {
    return null;
  }

  const lines: string[] = [
    "## Persisted Context Archive",
    `- Overflow-safe session memory was persisted to workspace files under: ${input.archiveDir}`,
    `- Retrieved archive excerpts for "${input.query}":`,
  ];

  for (const excerpt of input.excerpts) {
    lines.push(
      `- ${excerpt.title} [${excerpt.artifactType ?? "message"}]`,
      `  file=${excerpt.filePath}`,
      `  summary=${excerpt.summary}`,
      `  excerpt(${excerpt.heading})=${excerpt.text}`,
    );
  }

  return truncatePromptBlock(lines.join("\n"), input.maxChars ?? DEFAULT_PROMPT_BLOCK_CHAR_LIMIT);
}

export function splitContextTextIntoExcerpts(
  text: string,
  maxChars = DEFAULT_EXCERPT_CHAR_LIMIT,
): Array<{ heading: string; text: string }> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const sections = normalized
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  const excerpts: Array<{ heading: string; text: string }> = [];
  let currentHeading = "context";

  for (const section of sections) {
    if (/^#{1,6}\s+/.test(section)) {
      currentHeading = section.replace(/^#{1,6}\s+/, "").trim();
    }

    if (section.length <= maxChars) {
      excerpts.push({
        heading: currentHeading,
        text: section,
      });
      continue;
    }

    let cursor = 0;
    while (cursor < section.length) {
      const chunk = section.slice(cursor, cursor + maxChars).trim();
      if (chunk.length > 0) {
        excerpts.push({
          heading: currentHeading,
          text: chunk,
        });
      }
      cursor += maxChars;
    }
  }

  return excerpts;
}

export function buildArchiveSourceFingerprint(documents: ArchiveSourceDocument[]): string {
  return documents
    .map((document) => `${document.id}:${document.updatedAt}:${document.content.length}`)
    .join("|");
}

function shouldPersistContextArchive(documents: ArchiveSourceDocument[]): boolean {
  const totalChars = documents.reduce((sum, document) => sum + document.content.length, 0);
  return totalChars >= ARCHIVE_SOURCE_CHAR_THRESHOLD || documents.length >= ARCHIVE_SOURCE_COUNT_THRESHOLD;
}

function getLatestContextArchiveManifest(
  artifacts: DeepResearchArtifact[],
): ResearchContextArchiveManifest | null {
  const manifests = artifacts
    .filter((artifact) => artifact.artifactType === "data_manifest")
    .map((artifact) => artifact.content as unknown as Partial<ResearchContextArchiveManifest>)
    .filter((artifact): artifact is ResearchContextArchiveManifest =>
      artifact.manifestKind === ARCHIVE_MANIFEST_KIND
      && typeof artifact.archiveDir === "string"
      && Array.isArray(artifact.records),
    );

  return manifests.length > 0 ? manifests[manifests.length - 1] : null;
}

function buildArchiveSourceDocuments(
  messages: DeepResearchMessage[],
  artifacts: DeepResearchArtifact[],
): ArchiveSourceDocument[] {
  const docs: ArchiveSourceDocument[] = [];

  const relevantArtifacts = artifacts
    .filter((artifact) => !artifact.artifactType.startsWith("memory_") && artifact.artifactType !== "data_manifest")
    .filter((artifact) => isArchivableArtifactType(artifact.artifactType))
    .slice(-MAX_ARCHIVE_SOURCE_FILES);

  for (const artifact of relevantArtifacts) {
    const content = buildArchivableArtifactText(artifact).trim();
    if (content.length === 0) {
      continue;
    }

    docs.push({
      id: `artifact-${artifact.id}`,
      title: artifact.title,
      category: "artifact",
      artifactId: artifact.id,
      artifactType: artifact.artifactType,
      nodeId: artifact.nodeId,
      createdAt: artifact.createdAt,
      updatedAt: artifact.createdAt,
      importance: getArtifactArchiveImportance(artifact),
      content: truncateContentForArchive(content),
      summary: truncateSummary(extractArtifactSummary(artifact, content)),
      keywords: dedupeStrings([
        ...extractKeywords(artifact.title),
        ...extractKeywords(content),
      ]).slice(0, 18),
    });
  }

  const recentMessages = messages
    .filter((message) => message.role === "user" || message.role === "main_brain")
    .slice(-8);

  for (const message of recentMessages) {
    const content = message.content.trim();
    if (content.length < 280) {
      continue;
    }

    docs.push({
      id: `message-${message.id}`,
      title: `${message.role} message ${message.createdAt}`,
      category: "message",
      messageId: message.id,
      createdAt: message.createdAt,
      updatedAt: message.createdAt,
      importance: message.role === "user" ? 0.92 : 0.7,
      content: truncateContentForArchive(content),
      summary: truncateSummary(content),
      keywords: extractKeywords(content).slice(0, 18),
    });
  }

  return docs.sort((left, right) => {
    if (left.importance !== right.importance) {
      return right.importance - left.importance;
    }
    return left.createdAt.localeCompare(right.createdAt);
  });
}

function buildArchivableArtifactText(artifact: DeepResearchArtifact): string {
  switch (artifact.artifactType) {
    case "evidence_card":
      return buildEvidenceCardArchiveText(artifact);
    case "claim_map":
      return buildClaimMapArchiveText(artifact);
    case "checkpoint":
      return buildCheckpointArchiveText(artifact);
    case "review_assessment":
      return buildReviewArchiveText(artifact);
    default:
      return extractArtifactTextCandidate(artifact);
  }
}

function buildEvidenceCardArchiveText(artifact: DeepResearchArtifact): string {
  const query = typeof artifact.content.query === "string" ? artifact.content.query : artifact.title;
  const coverage = typeof artifact.content.coverageSummary === "string" ? artifact.content.coverageSummary : "";
  const sources = Array.isArray(artifact.content.sources) ? artifact.content.sources as Array<Record<string, unknown>> : [];
  const excerpts = Array.isArray(artifact.content.rawExcerpts) ? artifact.content.rawExcerpts as Array<Record<string, unknown>> : [];

  return [
    `# ${artifact.title}`,
    "",
    `## Query`,
    query,
    coverage ? `\n## Coverage Summary\n${coverage}` : "",
    sources.length > 0
      ? `\n## Sources\n${sources.slice(0, 20).map((source) => {
          const title = typeof source.title === "string" ? source.title : "Untitled source";
          const year = typeof source.year === "number" ? ` (${source.year})` : "";
          const venue = typeof source.venue === "string" && source.venue.trim().length > 0 ? ` - ${source.venue.trim()}` : "";
          const url = typeof source.url === "string" && source.url.trim().length > 0 ? ` | ${source.url.trim()}` : "";
          return `- ${title}${year}${venue}${url}`;
        }).join("\n")}`
      : "",
    excerpts.length > 0
      ? `\n## Representative Excerpts\n${excerpts.slice(0, 8).map((excerpt, index) => {
          const text = typeof excerpt.text === "string" ? excerpt.text : JSON.stringify(excerpt);
          const section = typeof excerpt.section === "string" ? ` (${excerpt.section})` : "";
          return `### Excerpt ${index + 1}${section}\n${text}`;
        }).join("\n\n")}`
      : "",
  ].filter(Boolean).join("\n");
}

function buildClaimMapArchiveText(artifact: DeepResearchArtifact): string {
  const claimMap = artifact.content as unknown as ClaimMap;
  return [
    `# ${artifact.title}`,
    "",
    `## Claims`,
    (claimMap.claims ?? []).slice(0, 20).map((claim) =>
      `- [${claim.strength}] ${claim.text} (knowledge=${claim.knowledgeType}, category=${claim.category})`
    ).join("\n"),
    `\n## Contradictions`,
    (claimMap.contradictions ?? []).slice(0, 10).map((item) =>
      `- ${item.description} | resolution=${item.possibleResolution}`
    ).join("\n"),
    `\n## Gaps`,
    (claimMap.gaps ?? []).slice(0, 12).map((gap) =>
      `- ${gap.topic} [${gap.priority}] ${gap.description} | queries=${gap.suggestedQueries.join("; ")}`
    ).join("\n"),
  ].join("\n");
}

function buildCheckpointArchiveText(artifact: DeepResearchArtifact): string {
  const checkpoint = artifact.content as unknown as CheckpointPackage;
  return [
    `# ${checkpoint.title}`,
    "",
    `## Human Summary`,
    checkpoint.humanSummary,
    `\n## Machine Summary`,
    checkpoint.machineSummary,
    `\n## Current Findings`,
    checkpoint.currentFindings,
    checkpoint.openQuestions.length > 0
      ? `\n## Open Questions\n${checkpoint.openQuestions.map((item) => `- ${item}`).join("\n")}`
      : "",
    `\n## Recommended Next Action`,
    checkpoint.recommendedNextAction,
  ].filter(Boolean).join("\n");
}

function buildReviewArchiveText(artifact: DeepResearchArtifact): string {
  const review = artifact.content as unknown as ReviewAssessment;
  const openIssues = review.openIssues ?? [];
  const literatureGaps = review.literatureGaps ?? [];
  const suggestedExperiments = review.suggestedExperiments ?? [];
  return [
    `# ${artifact.title}`,
    "",
    `## Verdict`,
    `${review.combinedVerdict} (confidence=${review.combinedConfidence})`,
    review.reviewerSummary ? `\n## Summary\n${review.reviewerSummary}` : "",
    openIssues.length > 0
      ? `\n## Open Issues\n${openIssues.map((item) => `- ${item}`).join("\n")}`
      : "",
    literatureGaps.length > 0
      ? `\n## Literature Gaps\n${literatureGaps.map((item) => `- ${item}`).join("\n")}`
      : "",
    suggestedExperiments.length > 0
      ? `\n## Suggested Experiments\n${suggestedExperiments.map((item) => `- ${item}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");
}

function extractArtifactTextCandidate(artifact: DeepResearchArtifact): string {
  const candidates = [
    artifact.content.report,
    artifact.content.summary,
    artifact.content.machineSummary,
    artifact.content.humanSummary,
    artifact.content.currentFindings,
    artifact.content.messageToUser,
    artifact.content.text,
    artifact.content.content,
  ];

  const preferred = candidates.find((candidate): candidate is string =>
    typeof candidate === "string" && candidate.trim().length > 0
  );
  if (preferred) {
    return preferred.trim();
  }

  return JSON.stringify(artifact.content, null, 2);
}

function extractArtifactSummary(artifact: DeepResearchArtifact, content: string): string {
  if (typeof artifact.content.summary === "string" && artifact.content.summary.trim().length > 0) {
    return artifact.content.summary.trim();
  }
  if (typeof artifact.content.coverageSummary === "string" && artifact.content.coverageSummary.trim().length > 0) {
    return artifact.content.coverageSummary.trim();
  }
  return `${artifact.title}: ${content}`;
}

function buildArchiveMarkdown(
  source: ArchiveSourceDocument,
  record: ResearchContextArchiveRecord,
): string {
  return [
    `# ${source.title}`,
    "",
    `- category: ${source.category}`,
    source.artifactType ? `- artifactType: ${source.artifactType}` : null,
    source.artifactId ? `- artifactId: ${source.artifactId}` : null,
    source.messageId ? `- messageId: ${source.messageId}` : null,
    source.nodeId ? `- nodeId: ${source.nodeId}` : null,
    `- createdAt: ${source.createdAt}`,
    `- importance: ${source.importance.toFixed(2)}`,
    "",
    "## Summary",
    source.summary,
    "",
    "## Retrieved Excerpts Index",
    ...record.excerpts.map((excerpt, index) => `- ${index + 1}. ${excerpt.heading} (${excerpt.charCount} chars)`),
    "",
    "## Archived Content",
    source.content,
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function scoreArchiveExcerpt(
  record: ResearchContextArchiveRecord,
  excerpt: ResearchContextArchiveExcerpt,
  query: string,
): number {
  const queryTokens = extractKeywords(query);
  if (queryTokens.length === 0) {
    return record.importance;
  }

  const tokenSet = new Set([
    ...record.keywords,
    ...excerpt.keywords,
    ...extractKeywords(record.title),
    ...extractKeywords(record.summary),
  ]);

  let overlap = 0;
  for (const token of queryTokens) {
    if (tokenSet.has(token)) {
      overlap += 1;
    }
  }

  return overlap * 2.6 + record.importance * 1.8 + computeRecencyBonus(record.updatedAt);
}

function isArchivableArtifactType(type: DeepResearchArtifact["artifactType"]): boolean {
  return new Set<DeepResearchArtifact["artifactType"]>([
    "research_brief",
    "task_graph",
    "evidence_card",
    "literature_round_summary",
    "structured_summary",
    "reviewer_packet",
    "review_assessment",
    "provisional_conclusion",
    "validation_report",
    "final_report",
    "checkpoint",
    "claim_map",
  ]).has(type);
}

function getArtifactArchiveImportance(artifact: DeepResearchArtifact): number {
  switch (artifact.artifactType) {
    case "final_report":
      return 0.95;
    case "claim_map":
    case "structured_summary":
    case "provisional_conclusion":
    case "validation_report":
      return 0.9;
    case "review_assessment":
    case "checkpoint":
      return 0.82;
    case "evidence_card":
      return 0.78;
    default:
      return 0.68;
  }
}

async function resolveWorkspace(workspaceId: string): Promise<{ folderPath: string } | null> {
  const [workspace] = await db
    .select({ folderPath: workspaces.folderPath })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  return workspace ?? null;
}

function truncateContentForArchive(content: string): string {
  if (content.length <= MAX_ARCHIVE_SOURCE_CHARS) {
    return content;
  }
  return `${content.slice(0, MAX_ARCHIVE_SOURCE_CHARS).trimEnd()}\n\n…truncated for archive safety`;
}

function truncateSummary(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length <= 220 ? compact : `${compact.slice(0, 217).trimEnd()}...`;
}

function truncatePromptBlock(block: string, maxChars: number): string {
  if (block.length <= maxChars) {
    return block;
  }
  return `${block.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function slugifyFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "context";
}

function extractKeywords(value: string): string[] {
  return dedupeStrings(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function computeRecencyBonus(timestamp: string): number {
  const ageMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return 0.3;
  }
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 1) return 1.1;
  if (ageDays <= 7) return 0.8;
  if (ageDays <= 30) return 0.35;
  return 0.1;
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "been",
  "between",
  "from",
  "have",
  "into",
  "just",
  "more",
  "most",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "using",
  "with",
  "without",
  "what",
  "when",
  "where",
  "which",
  "while",
  "would",
  "research",
  "study",
  "session",
  "node",
  "task",
]);
