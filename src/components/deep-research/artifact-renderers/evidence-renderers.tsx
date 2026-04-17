import type {
  EvidenceRetrievalStatus,
  RawExcerpt,
  SourceEntry,
} from "@/lib/deep-research/types";
import { Badge } from "@/components/ui/badge";
import {
  normalizeDisplayList,
  truncateDisplayList,
} from "../artifact-display-utils";
import {
  ArtifactCard,
  ArtifactNotice,
  ArtifactSection,
  MarkdownDisplay,
  SectionList,
} from "../artifact-renderer-primitives";

export function EvidenceCardDisplay({
  data,
  excerptLimit,
}: {
  data: Record<string, unknown>;
  excerptLimit: number;
}) {
  const query = typeof data.query === "string" ? data.query : "Evidence retrieval";
  const retrievalStatus = typeof data.retrievalStatus === "string" ? data.retrievalStatus : "empty";
  const retrievalNotes = typeof data.retrievalNotes === "string" ? data.retrievalNotes : "";
  const coverageSummary = typeof data.coverageSummary === "string" ? data.coverageSummary : "";
  const recoveredFrom = typeof data.recoveredFrom === "string" ? data.recoveredFrom : "";
  const sourcesFound = typeof data.sourcesFound === "number"
    ? data.sourcesFound
    : typeof data.totalFound === "number"
      ? data.totalFound
      : 0;
  const sourcesAttempted = typeof data.sourcesAttempted === "number" ? data.sourcesAttempted : undefined;
  const searchQueries = Array.isArray(data.searchQueries)
    ? data.searchQueries.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const sources = Array.isArray(data.sources)
    ? data.sources.filter(isEvidenceSource)
    : [];
  const rawExcerpts = Array.isArray(data.rawExcerpts)
    ? data.rawExcerpts.filter(isEvidenceExcerpt)
    : [];
  const normalizedExcerptLimit = Number.isFinite(excerptLimit) ? Math.max(excerptLimit, 0) : rawExcerpts.length;
  const visibleExcerpts = rawExcerpts.slice(0, normalizedExcerptLimit);
  const hiddenExcerptCount = rawExcerpts.length - visibleExcerpts.length;

  return (
    <div className="space-y-4">
      <ArtifactCard className="space-y-3">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Research Query</div>
          <div className="text-sm font-medium leading-relaxed">{query}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={evidenceStatusColors[normalizeEvidenceStatus(retrievalStatus)]}>
            {formatEvidenceStatus(retrievalStatus)}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {sourcesFound} source{sourcesFound === 1 ? "" : "s"}
            {typeof sourcesAttempted === "number" ? ` found / ${sourcesAttempted} attempted` : " found"}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {rawExcerpts.length} excerpt{rawExcerpts.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {retrievalNotes ? (
          <ArtifactNotice title="Retrieval Notes" tone={sourcesFound > 0 ? "blue" : "yellow"}>
            {retrievalNotes}
          </ArtifactNotice>
        ) : null}

        {coverageSummary ? (
          <div className="text-xs text-muted-foreground">{coverageSummary}</div>
        ) : null}

        {searchQueries.length > 0 ? (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Search terms</div>
            <div className="flex flex-wrap gap-1.5">
              {searchQueries.map((searchQuery, index) => (
                <Badge key={`${searchQuery}-${index}`} variant="outline" className="max-w-full text-[10px]">
                  <span className="truncate">{searchQuery}</span>
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {recoveredFrom ? (
          <div className="text-[11px] text-muted-foreground">
            Evidence card was reconstructed from {recoveredFrom.replace(/_/g, " ")}.
          </div>
        ) : null}
      </ArtifactCard>

      {sources.length > 0 ? (
        <ArtifactSection title={`Sources (${sources.length})`}>
          <div className="space-y-2">
            {sources.map((source, index) => {
              const authorNames = normalizeDisplayList(source.authors);
              return (
                <ArtifactCard key={`${source.title}-${index}`} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-medium leading-snug">
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline-offset-2 hover:underline"
                          >
                            {source.title}
                          </a>
                        ) : (
                          source.title
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatSourceMetadata(source)}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      Source {index + 1}
                    </Badge>
                  </div>

                  {authorNames.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {truncateDisplayList(authorNames, 4)}
                    </div>
                  ) : null}

                  {source.doi ? (
                    <div className="text-[11px] text-muted-foreground">
                      DOI: {source.doi}
                    </div>
                  ) : null}
                </ArtifactCard>
              );
            })}
          </div>
        </ArtifactSection>
      ) : (
        <ArtifactNotice title="No Sources Retrieved" tone="yellow">
          This evidence step did not return any usable sources.
        </ArtifactNotice>
      )}

      {visibleExcerpts.length > 0 ? (
        <ArtifactSection title={`Key Excerpts (${rawExcerpts.length})`}>
          <div className="space-y-2">
            {visibleExcerpts.map((excerpt, index) => {
              const source = sources[excerpt.sourceIndex];
              const location = [excerpt.section, excerpt.page].filter(Boolean).join(" - ");

              return (
                <ArtifactCard key={`${excerpt.sourceIndex}-${index}`} className="space-y-2">
                  <div className="text-sm leading-relaxed text-foreground">
                    {truncateText(excerpt.text, 360)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {source?.title ?? `Source ${excerpt.sourceIndex + 1}`}
                    </Badge>
                    {location ? <span>{location}</span> : null}
                  </div>
                </ArtifactCard>
              );
            })}
          </div>
          {hiddenExcerptCount > 0 ? (
            <div className="text-[11px] text-muted-foreground">
              Showing first {visibleExcerpts.length} excerpts. {hiddenExcerptCount} more excerpt{hiddenExcerptCount === 1 ? "" : "s"} remain in the raw artifact.
            </div>
          ) : null}
        </ArtifactSection>
      ) : null}
    </div>
  );
}

export function StructuredSummaryDisplay({ data }: { data: Record<string, unknown> }) {
  const chapterPackets = Array.isArray(data.chapterPackets)
    ? data.chapterPackets.filter((packet): packet is Record<string, unknown> => Boolean(packet) && typeof packet === "object")
    : [];
  const crossSectionThemes = Array.isArray(data.crossSectionThemes)
    ? data.crossSectionThemes.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const globalOpenQuestions = Array.isArray(data.globalOpenQuestions)
    ? data.globalOpenQuestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  if (chapterPackets.length === 0) {
    return <MarkdownDisplay text={data.summary as string || JSON.stringify(data, null, 2)} />;
  }

  return (
    <div className="space-y-3">
      {typeof data.summary === "string" && data.summary.trim().length > 0 ? (
        <ArtifactCard className="text-sm leading-relaxed">
          {data.summary}
        </ArtifactCard>
      ) : null}

      {chapterPackets.map((packet, index) => {
        const title = typeof packet.title === "string" ? packet.title : `Chapter Packet ${index + 1}`;
        const takeaways = Array.isArray(packet.keyTakeaways)
          ? packet.keyTakeaways.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : [];
        const citationKeys = Array.isArray(packet.citationKeys)
          ? packet.citationKeys.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : [];
        const openQuestions = Array.isArray(packet.openQuestions)
          ? packet.openQuestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : [];
        const claims = Array.isArray(packet.claims)
          ? packet.claims.filter((claim): claim is Record<string, unknown> => Boolean(claim) && typeof claim === "object")
          : [];

        return (
          <ArtifactCard key={`${title}-${index}`} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="text-sm font-medium leading-snug">{title}</div>
                {typeof packet.summary === "string" && packet.summary.trim().length > 0 ? (
                  <div className="text-xs text-muted-foreground">{packet.summary}</div>
                ) : null}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                Packet {index + 1}
              </Badge>
            </div>

            {takeaways.length > 0 ? (
              <SectionList title="Key Takeaways" items={takeaways} compact />
            ) : null}

            {claims.length > 0 ? (
              <ArtifactSection title={`Claims (${claims.length})`}>
                <div className="space-y-2">
                  {claims.slice(0, 6).map((claim, claimIndex) => (
                    <ArtifactCard key={`${title}-claim-${claimIndex}`} className="space-y-1">
                      <div className="text-sm">{typeof claim.text === "string" ? claim.text : JSON.stringify(claim)}</div>
                      {typeof claim.strength === "string" ? (
                        <div className="text-[11px] text-muted-foreground">Strength: {claim.strength}</div>
                      ) : null}
                    </ArtifactCard>
                  ))}
                </div>
              </ArtifactSection>
            ) : null}

            {citationKeys.length > 0 ? (
              <SectionList title="Citation Keys" items={citationKeys} compact />
            ) : null}

            {openQuestions.length > 0 ? (
              <SectionList title="Open Questions" items={openQuestions} compact />
            ) : null}

            {typeof packet.recommendedSectionText === "string" && packet.recommendedSectionText.trim().length > 0 ? (
              <ArtifactSection title="Section Seed">
                <MarkdownDisplay text={packet.recommendedSectionText} />
              </ArtifactSection>
            ) : null}
          </ArtifactCard>
        );
      })}

      {crossSectionThemes.length > 0 ? (
        <SectionList title="Cross-Section Themes" items={crossSectionThemes} />
      ) : null}

      {globalOpenQuestions.length > 0 ? (
        <SectionList title="Global Open Questions" items={globalOpenQuestions} />
      ) : null}
    </div>
  );
}

const evidenceStatusColors: Record<EvidenceRetrievalStatus, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  partial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  insufficient_evidence: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  failed_retrieval: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  empty: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

function isEvidenceSource(value: unknown): value is SourceEntry {
  return Boolean(
    value
    && typeof value === "object"
    && typeof (value as SourceEntry).title === "string"
    && typeof (value as SourceEntry).url === "string",
  );
}

function isEvidenceExcerpt(value: unknown): value is RawExcerpt {
  return Boolean(
    value
    && typeof value === "object"
    && typeof (value as RawExcerpt).text === "string"
    && typeof (value as RawExcerpt).sourceIndex === "number",
  );
}

function formatEvidenceStatus(status: string): string {
  switch (status) {
    case "success":
      return "Retrieved";
    case "partial":
      return "Partial";
    case "insufficient_evidence":
      return "Limited Evidence";
    case "failed_retrieval":
      return "Retrieval Failed";
    case "empty":
      return "No Results";
    default:
      return status;
  }
}

function normalizeEvidenceStatus(status: string): EvidenceRetrievalStatus {
  switch (status) {
    case "success":
    case "partial":
    case "insufficient_evidence":
    case "failed_retrieval":
    case "empty":
      return status;
    default:
      return "empty";
  }
}

function formatSourceMetadata(source: SourceEntry): string {
  const parts = [source.year?.toString(), source.venue].filter(Boolean);
  return parts.length > 0 ? parts.join(" • ") : "Source metadata unavailable";
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}
