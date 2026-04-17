import { Badge } from "@/components/ui/badge";
import {
  ArtifactCard,
  ArtifactNotice,
  MarkdownDisplay,
  SectionList,
} from "../artifact-renderer-primitives";

export function MemoryProfileDisplay({ data }: { data: Record<string, unknown> }) {
  const activeRequirements = Array.isArray(data.activeRequirements) ? data.activeRequirements as string[] : [];
  const activeConstraints = Array.isArray(data.activeConstraints) ? data.activeConstraints as string[] : [];
  const openQuestions = Array.isArray(data.openQuestions) ? data.openQuestions as string[] : [];
  const activeHypotheses = Array.isArray(data.activeHypotheses) ? data.activeHypotheses as string[] : [];
  const keyDecisions = Array.isArray(data.keyDecisions) ? data.keyDecisions as string[] : [];

  return (
    <div className="space-y-3">
      <ArtifactCard className="space-y-2">
        <div className="text-sm font-medium">{String(data.objective ?? "No objective recorded")}</div>
        <div className="flex flex-wrap gap-2">
          {typeof data.currentPhase === "string" && (
            <Badge variant="outline" className="text-[10px]">
              {String(data.currentPhase)}
            </Badge>
          )}
          {typeof data.latestCheckpointTitle === "string" && data.latestCheckpointTitle && (
            <Badge variant="secondary" className="text-[10px]">
              {String(data.latestCheckpointTitle)}
            </Badge>
          )}
        </div>
        {typeof data.latestRecommendedNextAction === "string" && data.latestRecommendedNextAction && (
          <ArtifactNotice tone="green" title="Latest Next Action">
            {String(data.latestRecommendedNextAction)}
          </ArtifactNotice>
        )}
        {typeof data.latestPlanSummary === "string" && data.latestPlanSummary && (
          <div className="text-xs text-muted-foreground">{String(data.latestPlanSummary)}</div>
        )}
      </ArtifactCard>

      <SectionList title="Active Requirements" items={activeRequirements} />
      <SectionList title="Active Constraints" items={activeConstraints} />
      <SectionList title="Open Questions" items={openQuestions} />
      <SectionList title="Active Hypotheses" items={activeHypotheses} />
      <SectionList title="Key Decisions" items={keyDecisions} />
    </div>
  );
}

export function MemorySnapshotDisplay({ data }: { data: Record<string, unknown> }) {
  const acceptedFacts = Array.isArray(data.acceptedFacts) ? data.acceptedFacts as string[] : [];
  const contestedFacts = Array.isArray(data.contestedFacts) ? data.contestedFacts as string[] : [];
  const unresolvedGaps = Array.isArray(data.unresolvedGaps) ? data.unresolvedGaps as string[] : [];
  const focusAreas = Array.isArray(data.focusAreas) ? data.focusAreas as string[] : [];

  return (
    <div className="space-y-3">
      <ArtifactCard className="space-y-2">
        <div className="text-sm font-medium">{String(data.title ?? "Memory Snapshot")}</div>
        {typeof data.summary === "string" && data.summary && (
          <div className="text-sm leading-relaxed">{String(data.summary)}</div>
        )}
        {typeof data.nextStep === "string" && data.nextStep && (
          <ArtifactNotice title="Next Step" tone="blue">
            {String(data.nextStep)}
          </ArtifactNotice>
        )}
        {focusAreas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {focusAreas.map((focusArea, index) => (
              <Badge key={`${focusArea}-${index}`} variant="outline" className="text-[10px]">
                {focusArea}
              </Badge>
            ))}
          </div>
        )}
      </ArtifactCard>

      <SectionList title="Accepted Facts" items={acceptedFacts} />
      <SectionList title="Contested Facts" items={contestedFacts} />
      <SectionList title="Unresolved Gaps" items={unresolvedGaps} />
    </div>
  );
}

export function MemoryIndexDisplay({ data }: { data: Record<string, unknown> }) {
  const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
  const sourceOfTruth = typeof data.sourceOfTruth === "string" ? data.sourceOfTruth : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {typeof data.itemCount === "number" && (
          <Badge variant="outline" className="text-[10px]">
            {Number(data.itemCount)} item(s)
          </Badge>
        )}
        {Boolean(data.stats && typeof data.stats === "object") && (
          <span>{JSON.stringify(data.stats)}</span>
        )}
        {sourceOfTruth && (
          <span>source-of-truth: {sourceOfTruth}</span>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <ArtifactCard key={String(item.id ?? index)} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-medium">{String(item.title ?? "Untitled memory")}</div>
              {typeof item.kind === "string" && (
                <Badge variant="secondary" className="text-[10px]">
                  {String(item.kind)}
                </Badge>
              )}
              {typeof item.category === "string" && (
                <Badge variant="outline" className="text-[10px]">
                  {String(item.category)}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {String(item.summary ?? "")}
            </div>
            {Array.isArray(item.anchors) && (item.anchors as Array<Record<string, unknown>>).length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                Anchor: {(item.anchors as Array<Record<string, unknown>>).slice(0, 2).map((anchor) => {
                  const parts: string[] = [];
                  if (typeof anchor.artifactType === "string") parts.push(String(anchor.artifactType));
                  if (typeof anchor.artifactId === "string") parts.push(String(anchor.artifactId));
                  if (typeof anchor.messageId === "string") parts.push(`message:${String(anchor.messageId)}`);
                  if (typeof anchor.sourceIndex === "number") parts.push(`source#${Number(anchor.sourceIndex) + 1}`);
                  if (typeof anchor.excerptIndex === "number") parts.push(`excerpt#${Number(anchor.excerptIndex) + 1}`);
                  if (typeof anchor.claimId === "string") parts.push(`claim:${String(anchor.claimId)}`);
                  if (typeof anchor.gapIndex === "number") parts.push(`gap#${Number(anchor.gapIndex) + 1}`);
                  if (typeof anchor.field === "string") parts.push(String(anchor.field));
                  return parts.join(" / ");
                }).filter(Boolean).join(" | ")}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {Array.isArray(item.tags) && (item.tags as string[]).slice(0, 6).map((tag, tagIndex) => (
                <Badge key={`${tag}-${tagIndex}`} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </ArtifactCard>
        ))}
      </div>
    </div>
  );
}

export function FinalReportMarkdownDisplay({ content }: { content: Record<string, unknown> }) {
  const text = content.text as string
    || content.report as string
    || content.messageToUser as string
    || content.content as string
    || JSON.stringify(content, null, 2);
  return <MarkdownDisplay text={text} />;
}
