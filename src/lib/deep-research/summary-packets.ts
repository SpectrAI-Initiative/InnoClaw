import type {
  ChapterPacket,
  ChapterPacketClaim,
  ChapterPacketQuote,
  Claim,
  ClaimMap,
  ClaimStrength,
  DeepResearchArtifact,
  RawExcerpt,
  SourceEntry,
  StructuredSummaryArtifactContent,
} from "./types";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const collected: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    collected.push(normalized);
    if (collected.length >= limit) {
      break;
    }
  }

  return collected;
}

function citationKeyFromSource(source: Partial<SourceEntry>): string | null {
  const title = normalizeText(source.title);
  if (!title) {
    return null;
  }

  return typeof source.year === "number" ? `${title}, ${source.year}` : title;
}

function normalizeClaimStrength(value: unknown): ClaimStrength {
  switch (value) {
    case "strong":
    case "moderate":
    case "weak":
    case "unsupported":
      return value;
    default:
      return "moderate";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function normalizeQuote(raw: unknown): ChapterPacketQuote | null {
  if (!isRecord(raw)) {
    return null;
  }

  const quote = normalizeText(raw.quote ?? raw.text);
  const sourceTitle = normalizeText(raw.sourceTitle ?? raw.title);
  const citationKey = normalizeText(raw.citationKey);
  if (!quote || !sourceTitle || !citationKey) {
    return null;
  }

  return {
    citationKey,
    sourceTitle,
    quote,
    relevance: normalizeText(raw.relevance) || "Supports the section's core analytical point.",
    year: typeof raw.year === "number" ? raw.year : undefined,
    url: normalizeText(raw.url) || undefined,
  };
}

function normalizeChapterClaim(raw: unknown, fallbackIndex: number): ChapterPacketClaim | null {
  if (!isRecord(raw)) {
    return null;
  }

  const text = normalizeText(raw.text ?? raw.claim);
  if (!text) {
    return null;
  }

  return {
    id: normalizeText(raw.id) || `claim_${fallbackIndex + 1}`,
    text,
    strength: normalizeClaimStrength(raw.strength),
    citationKeys: normalizeStringArray(raw.citationKeys, 6),
    supportingSourceTitles: normalizeStringArray(raw.supportingSourceTitles ?? raw.sources, 6),
    counterpoints: normalizeStringArray(raw.counterpoints, 4),
  };
}

function normalizeChapterPacket(raw: unknown, index: number): ChapterPacket | null {
  if (!isRecord(raw)) {
    return null;
  }

  const title = normalizeText(raw.title);
  if (!title) {
    return null;
  }

  const supportingQuotes = Array.isArray(raw.supportingQuotes)
    ? raw.supportingQuotes
        .map((quote) => normalizeQuote(quote))
        .filter((quote): quote is ChapterPacketQuote => Boolean(quote))
        .slice(0, 6)
    : [];
  const claims = Array.isArray(raw.claims)
    ? raw.claims
        .map((claim, claimIndex) => normalizeChapterClaim(claim, claimIndex))
        .filter((claim): claim is ChapterPacketClaim => Boolean(claim))
        .slice(0, 8)
    : [];
  const citationKeys = new Set<string>(normalizeStringArray(raw.citationKeys, 12));
  for (const quote of supportingQuotes) {
    if (quote.citationKey) {
      citationKeys.add(quote.citationKey);
    }
  }
  for (const claim of claims) {
    for (const citationKey of claim.citationKeys) {
      citationKeys.add(citationKey);
    }
  }

  return {
    id: normalizeText(raw.id) || `chapter_${index + 1}`,
    title,
    objective: normalizeText(raw.objective) || title,
    summary: normalizeText(raw.summary) || normalizeText(raw.objective) || title,
    keyTakeaways: normalizeStringArray(raw.keyTakeaways, 6),
    claims,
    supportingQuotes,
    citationKeys: [...citationKeys],
    openQuestions: normalizeStringArray(raw.openQuestions, 6),
    recommendedSectionText: normalizeText(raw.recommendedSectionText),
  };
}

function collectEvidenceSources(artifacts: DeepResearchArtifact[]): Array<SourceEntry & { citationKey: string }> {
  const collected: Array<SourceEntry & { citationKey: string }> = [];
  const seen = new Set<string>();

  for (const artifact of artifacts) {
    if (artifact.artifactType !== "evidence_card" || !Array.isArray(artifact.content.sources)) {
      continue;
    }

    for (const source of artifact.content.sources) {
      if (!isRecord(source)) {
        continue;
      }

      const citationKey = citationKeyFromSource(source as Partial<SourceEntry>);
      if (!citationKey || seen.has(citationKey)) {
        continue;
      }
      seen.add(citationKey);

      collected.push({
        title: normalizeText(source.title),
        url: normalizeText(source.url),
        authors: Array.isArray(source.authors)
          ? source.authors.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : undefined,
        year: typeof source.year === "number" ? source.year : undefined,
        venue: normalizeText(source.venue) || undefined,
        doi: normalizeText(source.doi) || undefined,
        retrievalMethod: normalizeText(source.retrievalMethod) || "artifact",
        retrievedAt: normalizeText(source.retrievedAt) || new Date().toISOString(),
        citationKey,
      });
    }
  }

  return collected;
}

function collectRepresentativeExcerpts(
  artifact: DeepResearchArtifact,
  sources: Array<SourceEntry & { citationKey: string }>,
): ChapterPacketQuote[] {
  const rawExcerpts = Array.isArray(artifact.content.rawExcerpts) ? artifact.content.rawExcerpts as RawExcerpt[] : [];
  const normalized: ChapterPacketQuote[] = [];

  for (const excerpt of rawExcerpts.slice(0, 4)) {
    const source = sources[excerpt.sourceIndex];
    if (!source || !excerpt.text?.trim()) {
      continue;
    }

    normalized.push({
      citationKey: source.citationKey,
      sourceTitle: source.title,
      quote: truncateText(excerpt.text.trim(), 240),
      relevance: [excerpt.section, excerpt.page].filter(Boolean).join(" - ") || "Representative excerpt",
      year: source.year,
      url: source.url,
    });
  }

  return normalized;
}

function buildFallbackChapterPackets(
  artifacts: DeepResearchArtifact[],
  label: string,
  fallbackSummaryText = "",
): ChapterPacket[] {
  const evidenceArtifacts = artifacts.filter((artifact) => artifact.artifactType === "evidence_card");
  const packets = evidenceArtifacts.map((artifact, index) => {
    const query = normalizeText(artifact.content.query) || artifact.title;
    const sources = Array.isArray(artifact.content.sources)
      ? artifact.content.sources
          .filter((source): source is Record<string, unknown> => isRecord(source))
          .slice(0, 6)
          .map((source) => ({
            title: normalizeText(source.title),
            url: normalizeText(source.url),
            year: typeof source.year === "number" ? source.year : undefined,
            venue: normalizeText(source.venue) || undefined,
            doi: normalizeText(source.doi) || undefined,
            retrievalMethod: normalizeText(source.retrievalMethod) || "artifact",
            retrievedAt: normalizeText(source.retrievedAt) || new Date().toISOString(),
            citationKey: citationKeyFromSource(source as Partial<SourceEntry>) || normalizeText(source.title),
          }))
      : [];
    const citationKeys = sources
      .map((source) => source.citationKey)
      .filter((citationKey): citationKey is string => Boolean(citationKey))
      .slice(0, 6);
    const supportingQuotes = collectRepresentativeExcerpts(artifact, sources);
    const coverageSummary = normalizeText(artifact.content.coverageSummary);
    const recommendedSectionText = [
      coverageSummary || `This section synthesizes the evidence gathered for "${query}".`,
      sources.length > 0
        ? `Representative works include ${sources.slice(0, 3).map((source) => `[${source.citationKey}]`).join(", ")}.`
        : "The evidence base is thin and should be treated cautiously.",
    ].join(" ");

    return {
      id: `chapter_${index + 1}`,
      title: query.length > 80 ? `${query.slice(0, 77)}...` : query,
      objective: query,
      summary: coverageSummary || query,
      keyTakeaways: sources.slice(0, 4).map((source) => source.title),
      claims: [
        {
          id: `claim_${index + 1}`,
          text: coverageSummary || `Evidence relevant to "${query}" was collected from the cited literature.`,
          strength: sources.length >= 3 ? "strong" : sources.length >= 1 ? "moderate" : "weak",
          citationKeys,
          supportingSourceTitles: sources.slice(0, 4).map((source) => source.title),
          counterpoints: [],
        },
      ],
      supportingQuotes,
      citationKeys,
      openQuestions: [],
      recommendedSectionText,
    } satisfies ChapterPacket;
  });

  if (packets.length > 0) {
    return packets;
  }

  return [{
    id: "chapter_1",
    title: label,
    objective: label,
    summary: fallbackSummaryText || `Synthesis for ${label}`,
    keyTakeaways: [],
    claims: [{
      id: "claim_1",
      text: fallbackSummaryText || `The available evidence has been summarized for ${label}.`,
      strength: "weak",
      citationKeys: [],
      supportingSourceTitles: [],
      counterpoints: [],
    }],
    supportingQuotes: [],
    citationKeys: [],
    openQuestions: [],
    recommendedSectionText: fallbackSummaryText,
  }];
}

export function normalizeStructuredSummaryArtifact(input: {
  rawOutput: Record<string, unknown>;
  parentArtifacts: DeepResearchArtifact[];
  label: string;
}): StructuredSummaryArtifactContent {
  const fallbackSummaryText = normalizeText(input.rawOutput.summary) || normalizeText(input.rawOutput.text);
  const normalizedPackets = Array.isArray(input.rawOutput.chapterPackets)
    ? input.rawOutput.chapterPackets
        .map((packet, index) => normalizeChapterPacket(packet, index))
        .filter((packet): packet is ChapterPacket => Boolean(packet))
    : [];
  const chapterPackets = normalizedPackets.length > 0
    ? normalizedPackets
    : buildFallbackChapterPackets(input.parentArtifacts, input.label, fallbackSummaryText);
  const citationKeys = new Set<string>();
  for (const packet of chapterPackets) {
    for (const citationKey of packet.citationKeys) {
      citationKeys.add(citationKey);
    }
  }

  return {
    summary: fallbackSummaryText
      || chapterPackets.map((packet) => `${packet.title}: ${packet.summary}`).join(" "),
    chapterPackets,
    crossSectionThemes: normalizeStringArray(input.rawOutput.crossSectionThemes, 8),
    globalOpenQuestions: normalizeStringArray(input.rawOutput.globalOpenQuestions, 8),
    citationKeys: [...citationKeys],
    recommendedReportNarrative: normalizeText(input.rawOutput.recommendedReportNarrative) || undefined,
  };
}

export function buildClaimMapFromStructuredSummary(
  summary: StructuredSummaryArtifactContent,
  parentArtifacts: DeepResearchArtifact[],
): ClaimMap {
  const globalSources = collectEvidenceSources(parentArtifacts);
  const citationIndex = new Map(globalSources.map((source, index) => [source.citationKey, index]));
  const claims: Claim[] = [];
  const supportMatrix: Record<string, number[]> = {};
  const gaps = summary.chapterPackets
    .flatMap((packet) => packet.openQuestions.map((topic) => ({
      topic,
      description: `Open question in ${packet.title}`,
      suggestedQueries: [packet.objective],
      priority: "medium" as const,
    })));

  for (const packet of summary.chapterPackets) {
    for (const packetClaim of packet.claims) {
      const supportingSources = packetClaim.citationKeys
        .map((citationKey) => citationIndex.get(citationKey))
        .filter((index): index is number => typeof index === "number");
      claims.push({
        id: packetClaim.id,
        text: packetClaim.text,
        strength: packetClaim.strength,
        supportingSources,
        contradictingSources: [],
        category: packet.title,
        knowledgeType: supportingSources.length > 0 ? "retrieved_evidence" : "assumption",
      });
      supportMatrix[packetClaim.id] = supportingSources;
    }
  }

  const confidenceDistribution: Record<ClaimStrength, number> = {
    strong: 0,
    moderate: 0,
    weak: 0,
    unsupported: 0,
  };
  for (const claim of claims) {
    confidenceDistribution[claim.strength] += 1;
  }

  return {
    claims,
    supportMatrix,
    contradictions: [],
    gaps,
    confidenceDistribution,
  };
}

export function extractChapterPacketsFromArtifacts(
  artifacts: DeepResearchArtifact[],
): ChapterPacket[] {
  const packets: ChapterPacket[] = [];

  for (const artifact of artifacts) {
    if (artifact.artifactType !== "structured_summary" || !Array.isArray(artifact.content.chapterPackets)) {
      continue;
    }

    for (const rawPacket of artifact.content.chapterPackets) {
      const normalized = normalizeChapterPacket(rawPacket, packets.length);
      if (!normalized) {
        continue;
      }
      packets.push(normalized);
    }
  }

  return packets;
}

export function selectChapterPacketsForSection(input: {
  sectionTitle: string;
  sectionSummary: string;
  citationFocus: string[];
  chapterPackets: ChapterPacket[];
  limit?: number;
}): ChapterPacket[] {
  const query = `${input.sectionTitle} ${input.sectionSummary} ${input.citationFocus.join(" ")}`.toLowerCase();
  const queryTokens = new Set(query.split(/[^a-z0-9\u4e00-\u9fff]+/i).filter(Boolean));
  if (queryTokens.size === 0) {
    return input.chapterPackets.slice(0, input.limit ?? 2);
  }

  return [...input.chapterPackets]
    .map((packet) => {
      const packetText = `${packet.title} ${packet.objective} ${packet.summary} ${packet.keyTakeaways.join(" ")} ${packet.citationKeys.join(" ")}`.toLowerCase();
      const packetTokens = packetText.split(/[^a-z0-9\u4e00-\u9fff]+/i).filter(Boolean);
      let score = 0;
      for (const token of packetTokens) {
        if (queryTokens.has(token)) {
          score += 1;
        }
      }
      return { packet, score };
    })
    .sort((left, right) => right.score - left.score || left.packet.title.localeCompare(right.packet.title))
    .slice(0, input.limit ?? 2)
    .map((item) => item.packet);
}
