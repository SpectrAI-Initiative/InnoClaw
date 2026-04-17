"use client";

import type {
  DeepResearchArtifact,
  EvidenceRetrievalStatus,
  RawExcerpt,
  SourceEntry,
} from "@/lib/deep-research/types";
import type { NodeDispatchPreview } from "@/lib/deep-research/node-spec-templates";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getNodeDisplayLabel } from "@/lib/deep-research/role-registry";
import {
  getMarkdownArtifactText,
  resolveArtifactRendererKind,
} from "./artifact-renderer-registry";
import {
  normalizeDisplayList,
  truncateDisplayList,
} from "./artifact-display-utils";
import {
  ArtifactCard,
  ArtifactNotice,
  ArtifactSection,
  MarkdownDisplay,
  SectionList,
} from "./artifact-renderer-primitives";

interface ArtifactViewerProps {
  artifact: DeepResearchArtifact;
  disableScroll?: boolean;
  evidenceExcerptLimit?: number;
}

export function ArtifactViewer({
  artifact,
  disableScroll = false,
  evidenceExcerptLimit = 5,
}: ArtifactViewerProps) {
  const content = artifact.content;
  const renderedContent = renderContent(artifact.artifactType, content, { evidenceExcerptLimit });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold flex-1">{getNodeDisplayLabel(artifact.title)}</h4>
        <Badge variant="outline" className="text-[10px]">
          {artifact.artifactType}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          v{artifact.version}
        </Badge>
      </div>

      {disableScroll ? (
        renderedContent
      ) : (
        <ScrollArea className="max-h-[600px]">
          {renderedContent}
        </ScrollArea>
      )}
    </div>
  );
}

function renderContent(
  type: string,
  content: Record<string, unknown>,
  options?: { evidenceExcerptLimit?: number },
) {
  switch (resolveArtifactRendererKind(type, content)) {
    case "task_board":
      return <TaskBoardDisplay data={content} />;

    case "collaboration_packet":
      return <CollaborationPacketDisplay data={content} />;

    case "role_specification":
      return <RoleSpecificationDisplay data={content} />;

    case "protocol_graph":
      return <ProtocolGraphDisplay data={content} />;

    case "research_brief":
      return <KeyValueDisplay data={content} />;

    case "evidence_card":
      return <EvidenceCardDisplay data={content} excerptLimit={options?.evidenceExcerptLimit ?? 5} />;

    case "structured_summary":
      return <StructuredSummaryDisplay data={content} />;

    case "reviewer_packet":
      return <ReviewerPacketDisplay data={content} />;

    case "review_assessment":
      return <ReviewAssessmentDisplay data={content} />;

    case "main_brain_audit":
      return <MainBrainAuditDisplay data={content} />;

    case "provisional_conclusion":
      return <KeyValueDisplay data={content} />;

    case "validation_plan":
      return <ValidationPlanDisplay data={content} />;

    case "execution_manifest":
      return <ExecutionManifestDisplay data={content} />;

    case "execution_plan":
      return <ExecutionPlanDisplay data={content} />;

    case "step_result":
      return <StepResultDisplay data={content} />;

    case "memory_profile":
      return <MemoryProfileDisplay data={content} />;

    case "memory_snapshot":
      return <MemorySnapshotDisplay data={content} />;

    case "memory_index":
      return <MemoryIndexDisplay data={content} />;

    case "final_report":
      return <MarkdownDisplay text={getMarkdownArtifactText(content)} />;

    case "task_graph":
      return <TaskGraphDisplay data={content} />;

    case "checkpoint":
      return <CheckpointDisplay data={content} />;

    default:
      return <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(content, null, 2)}</pre>;
  }
}

function RoleSpecificationDisplay({ data }: { data: Record<string, unknown> }) {
  const prompts = Array.isArray(data.prompts) ? data.prompts as Array<Record<string, unknown>> : [];
  const skills = Array.isArray(data.skills) ? data.skills as Array<Record<string, unknown>> : [];
  const collaborations = Array.isArray(data.collaborations) ? data.collaborations as Array<Record<string, unknown>> : [];
  const responsibilities = Array.isArray(data.coreResponsibilities) ? data.coreResponsibilities as string[] : [];
  const standards = Array.isArray(data.performanceStandards) ? data.performanceStandards as string[] : [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{String(data.roleName)}</div>
        <div className="text-xs text-muted-foreground">{String(data.workflowSegment)}</div>
        <p className="text-sm leading-relaxed">{String(data.corePositioning ?? "")}</p>
      </div>

      <SectionList title="Core Responsibilities" items={responsibilities} />
      <SectionList title="Performance Standards" items={standards} />

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prompts</div>
        <div className="space-y-2">
          {prompts.map((item, index) => (
            <div key={index} className="rounded border p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{String(item.title ?? "")}</span>
                <Badge variant="outline" className="text-[10px]">{String(item.kind ?? "")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{String(item.objective ?? "")}</p>
              <SectionList title="Required Sections" items={Array.isArray(item.requiredSections) ? item.requiredSections as string[] : []} compact />
              <SectionList title="Constraints" items={Array.isArray(item.constraints) ? item.constraints as string[] : []} compact />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Skills</div>
        <div className="space-y-2">
          {skills.map((item, index) => (
            <div key={index} className="rounded border p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{String(item.name ?? "")}</span>
                <Badge variant="secondary" className="text-[10px]">{String(item.kind ?? "")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{String(item.purpose ?? "")}</p>
              <SectionList title="Inputs" items={Array.isArray(item.inputs) ? item.inputs as string[] : []} compact />
              <SectionList title="Outputs" items={Array.isArray(item.outputs) ? item.outputs as string[] : []} compact />
              <SectionList title="Quality Checks" items={Array.isArray(item.qualityChecks) ? item.qualityChecks as string[] : []} compact />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collaboration</div>
        <div className="space-y-2">
          {collaborations.map((item, index) => (
            <div key={index} className="rounded border p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{String(item.partnerRoleId ?? "")}</span>
                <Badge variant="outline" className="text-[10px]">{String(item.collaborationType ?? "")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{String(item.trigger ?? "")}</p>
              <SectionList title="Payload" items={Array.isArray(item.payload) ? item.payload as string[] : []} compact />
              <SectionList title="Expected Response" items={Array.isArray(item.expectedResponse) ? item.expectedResponse as string[] : []} compact />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskBoardDisplay({ data }: { data: Record<string, unknown> }) {
  const assignments = Array.isArray(data.assignments) ? data.assignments as Array<Record<string, unknown>> : [];
  const milestones = Array.isArray(data.milestones) ? data.milestones as string[] : [];
  const completionCriteria = Array.isArray(data.completionCriteria) ? data.completionCriteria as string[] : [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold">Research Coordination Task Board</div>
        <p className="text-sm leading-relaxed">{String(data.objective ?? "")}</p>
        <div className="text-xs text-muted-foreground">Coordinator: {String(data.coordinatorRoleId ?? "")}</div>
      </div>

      <SectionList title="Milestones" items={milestones} />
      <SectionList title="Completion Criteria" items={completionCriteria} />

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assignments</div>
        <div className="space-y-2">
          {assignments.map((assignment, index) => (
            <div key={index} className="rounded border p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{String(assignment.roleName ?? "")}</span>
                <Badge variant="outline" className="text-[10px]">{String(assignment.status ?? "")}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{String(assignment.workflowSegment ?? "")}</div>
              <p className="text-xs">{String(assignment.objective ?? "")}</p>
              <SectionList title="Deliverables" items={Array.isArray(assignment.deliverables) ? assignment.deliverables as string[] : []} compact />
              <SectionList title="Dependencies" items={Array.isArray(assignment.dependencies) ? assignment.dependencies as string[] : []} compact />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CollaborationPacketDisplay({ data }: { data: Record<string, unknown> }) {
  const packet = (data.packet && typeof data.packet === "object" ? data.packet as Record<string, unknown> : null);
  const prompts = Array.isArray(data.roleResponseContract) ? data.roleResponseContract as Array<Record<string, unknown>> : [];
  const skills = Array.isArray(data.roleSkills) ? data.roleSkills as Array<Record<string, unknown>> : [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{String(data.roleName ?? "")} Collaboration Packet</div>
        <div className="text-xs text-muted-foreground">{String(data.workflowSegment ?? "")}</div>
      </div>

      {packet && (
        <div className="rounded border p-3 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{String(packet.type ?? "")}</Badge>
            <span className="text-xs text-muted-foreground">
              {String(packet.fromRoleId ?? "")} -&gt; {String(packet.toRoleId ?? "")}
            </span>
          </div>
          <p className="text-sm">{String(packet.goal ?? "")}</p>
          <SectionList title="Payload" items={Array.isArray(packet.payload) ? packet.payload as string[] : []} compact />
          <SectionList title="Expected Response" items={Array.isArray(packet.expectedResponse) ? packet.expectedResponse as string[] : []} compact />
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response Contract</div>
        <div className="space-y-2">
          {prompts.map((item, index) => (
            <div key={index} className="rounded border p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{String(item.title ?? "")}</span>
                <Badge variant="outline" className="text-[10px]">{String(item.kind ?? "")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{String(item.objective ?? "")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Skills</div>
        <div className="space-y-2">
          {skills.map((item, index) => (
            <div key={index} className="rounded border p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{String(item.name ?? "")}</span>
                <Badge variant="secondary" className="text-[10px]">{String(item.kind ?? "")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{String(item.purpose ?? "")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProtocolGraphDisplay({ data }: { data: Record<string, unknown> }) {
  const roles = Array.isArray(data.roles) ? data.roles as Array<Record<string, unknown>> : [];
  const protocols = Array.isArray(data.protocols) ? data.protocols as Array<Record<string, unknown>> : [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roles</div>
        <div className="grid gap-2 md:grid-cols-2">
          {roles.map((role, index) => (
            <div key={index} className="rounded border p-3">
              <div className="text-sm font-medium">{String(role.roleName ?? "")}</div>
              <div className="text-xs text-muted-foreground">{String(role.workflowSegment ?? "")}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Communication Protocols</div>
        <div className="space-y-2">
          {protocols.map((protocol, index) => (
            <div key={index} className="rounded border p-3 space-y-1.5">
              <div className="text-sm font-medium">{String(protocol.id ?? "")}</div>
              <div className="text-xs text-muted-foreground">
                {String(protocol.fromRoleId ?? "")} -&gt; {String(protocol.toRoleId ?? "")}
              </div>
              <p className="text-xs">{String(protocol.goal ?? "")}</p>
              <SectionList title="Required Payload" items={Array.isArray(protocol.requiredPayload) ? protocol.requiredPayload as string[] : []} compact />
              <SectionList title="Response Contract" items={Array.isArray(protocol.responseContract) ? protocol.responseContract as string[] : []} compact />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KeyValueDisplay({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="text-sm">
          <span className="font-medium text-muted-foreground capitalize">
            {key.replace(/_/g, " ")}:
          </span>{" "}
          <span>{typeof value === "string" ? value : JSON.stringify(value)}</span>
        </div>
      ))}
    </div>
  );
}

function EvidenceCardDisplay({
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
    && typeof (value as SourceEntry).url === "string"
  );
}

function isEvidenceExcerpt(value: unknown): value is RawExcerpt {
  return Boolean(
    value
    && typeof value === "object"
    && typeof (value as RawExcerpt).text === "string"
    && typeof (value as RawExcerpt).sourceIndex === "number"
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

function StructuredSummaryDisplay({ data }: { data: Record<string, unknown> }) {
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

function ReviewerPacketDisplay({ data }: { data: Record<string, unknown> }) {
  const verdict = data.verdict as string;
  const verdictColors: Record<string, string> = {
    approve: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    revise: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    reject: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge className={verdictColors[verdict] || ""}>
          {verdict}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Confidence: {((data.confidence as number) * 100).toFixed(0)}%
        </span>
      </div>
      <div className="text-sm">{data.critique as string}</div>
      {Array.isArray(data.suggestions) && data.suggestions.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Suggestions</div>
          <ul className="list-disc list-inside text-sm space-y-0.5">
            {(data.suggestions as string[]).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ExecutionPlanDisplay({ data }: { data: Record<string, unknown> }) {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  return (
    <div className="space-y-2">
      {steps.map((step: Record<string, unknown>, i: number) => (
        <div key={i} className="flex items-start gap-2 text-sm p-2 border rounded">
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">
            {i + 1}
          </span>
          <div className="flex-1">
            <div className="font-medium">{String(step.label || step.description || "")}</div>
            {step.requiresApproval ? (
              <Badge variant="outline" className="text-[10px] mt-1">Needs Approval</Badge>
            ) : null}
          </div>
        </div>
      ))}
      {steps.length === 0 && (
        <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}

function StepResultDisplay({ data }: { data: Record<string, unknown> }) {
  const statusColors: Record<string, string> = {
    success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    failure: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    partial: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  };

  return (
    <div className="space-y-2">
      <Badge className={statusColors[data.status as string] || ""}>
        {data.status as string}
      </Badge>
      {Array.isArray(data.observations) && (
        <ul className="list-disc list-inside text-sm space-y-0.5">
          {(data.observations as string[]).map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      )}
      {data.outputs != null && (
        <pre className="text-xs bg-muted p-2 rounded overflow-auto">
          {JSON.stringify(data.outputs, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ReviewAssessmentDisplay({ data }: { data: Record<string, unknown> }) {
  const verdict = data.combinedVerdict as string;
  const reviewerSummary = (data.reviewerSummary as string) || "";
  const reviewHighlights = Array.isArray(data.reviewHighlights)
    ? data.reviewHighlights as string[]
    : [];
  const openIssues = Array.isArray(data.openIssues)
    ? data.openIssues as string[]
    : [];
  const verdictColors: Record<string, string> = {
    approve: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    revise: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    reject: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge className={verdictColors[verdict] || ""}>
          {verdict}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Reviewer confidence: {((data.combinedConfidence as number) * 100).toFixed(0)}%
        </span>
      </div>

      {reviewerSummary && (
        <ArtifactNotice title="Results and Evidence Analyst" tone="blue">
          {reviewerSummary}
        </ArtifactNotice>
      )}

      {reviewHighlights.length > 0 && (
        <div className="text-xs">
          <div className="mb-1 font-medium text-green-700 dark:text-green-300">Review Highlights</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {reviewHighlights.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {openIssues.length > 0 && (
        <div>
          <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Open Issues</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {openIssues.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {/* Needs more literature / experiments */}
      <div className="flex flex-wrap gap-2">
        {Boolean(data.needsMoreLiterature) && (
          <Badge variant="outline" className="text-[10px] text-amber-600">Needs More Literature</Badge>
        )}
        {Boolean(data.needsExperimentalValidation) && (
          <Badge variant="outline" className="text-[10px] text-purple-600">Needs Experiments</Badge>
        )}
      </div>
    </div>
  );
}

function MainBrainAuditDisplay({ data }: { data: Record<string, unknown> }) {
  const assessment = data.resultAssessment as string;
  const assessmentColors: Record<string, string> = {
    good: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    acceptable: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    concerning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    problematic: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge className={assessmentColors[assessment] || ""}>
          {assessment}
        </Badge>
        {Boolean(data.canProceed) ? (
          <Badge variant="outline" className="text-[10px] text-green-600">Can Proceed</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-red-600">Cannot Proceed</Badge>
        )}
      </div>

      <div className="text-sm">{data.whatWasCompleted as string}</div>

      {Array.isArray(data.issuesAndRisks) && data.issuesAndRisks.length > 0 && (
        <ArtifactNotice title="Issues & Risks" tone="yellow">
          <ul className="list-disc list-inside space-y-0.5">
            {(data.issuesAndRisks as string[]).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </ArtifactNotice>
      )}

      {typeof data.continueWillDo === "string" && data.continueWillDo && (
        <ArtifactNotice tone="green">
          <span className="font-medium">Continue will: </span>
          <span>{data.continueWillDo}</span>
        </ArtifactNotice>
      )}

      {Array.isArray(data.alternativeActions) && data.alternativeActions.length > 0 && (
        <div className="text-xs space-y-1">
          <div className="font-medium text-muted-foreground">Alternatives</div>
          {(data.alternativeActions as Array<{ label: string; description: string }>).map((alt, i) => (
            <div key={i} className="p-1.5 bg-muted rounded">
              <span className="font-medium">{alt.label}:</span> {alt.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValidationPlanDisplay({ data }: { data: Record<string, unknown> }) {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  return (
    <div className="space-y-3">
      {typeof data.objective === "string" && data.objective && (
        <div className="text-sm"><span className="font-medium">Objective:</span> {data.objective}</div>
      )}
      {typeof data.hypothesis === "string" && data.hypothesis && (
        <div className="text-sm"><span className="font-medium">Hypothesis:</span> {data.hypothesis}</div>
      )}
      {steps.length > 0 && (
        <ArtifactSection title="Steps">
          {steps.map((step: Record<string, unknown>, i: number) => (
            <ArtifactCard key={i} className="flex items-start gap-2 p-2 text-xs">
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{Number(step.stepNumber) || i + 1}</span>
              <div className="flex-1">
                <div className="font-medium">{String(step.description || "")}</div>
                {typeof step.command === "string" && step.command && <code className="text-[10px] text-muted-foreground">{step.command}</code>}
                {Boolean(step.requiresApproval) && <Badge variant="outline" className="text-[10px] mt-1">Needs Approval</Badge>}
              </div>
            </ArtifactCard>
          ))}
        </ArtifactSection>
      )}
      {Array.isArray(data.successCriteria) && data.successCriteria.length > 0 && (
        <div className="text-xs">
          <div className="font-medium text-green-700 dark:text-green-300 mb-1">Success Criteria</div>
          <ul className="list-disc list-inside space-y-0.5">
            {(data.successCriteria as string[]).map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ExecutionManifestDisplay({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">{String(data.launcherType)}</Badge>
        {typeof data.purpose === "string" && data.purpose && <span className="text-xs text-muted-foreground">{data.purpose}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {data.gpu != null && <div><span className="text-muted-foreground">GPU:</span> {String(data.gpu)}</div>}
        {data.memoryMb != null && <div><span className="text-muted-foreground">Memory:</span> {String(data.memoryMb)}MB</div>}
        {data.cpu != null && <div><span className="text-muted-foreground">CPU:</span> {String(data.cpu)}</div>}
      </div>
      {typeof data.command === "string" && data.command && (
        <pre className="text-xs bg-muted p-2 rounded overflow-auto">{data.command}</pre>
      )}
      {typeof data.chargedGroup === "string" && data.chargedGroup && (
        <div className="text-[10px] text-muted-foreground">Charged to: {data.chargedGroup}</div>
      )}
    </div>
  );
}

function MemoryProfileDisplay({ data }: { data: Record<string, unknown> }) {
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

function MemorySnapshotDisplay({ data }: { data: Record<string, unknown> }) {
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

function MemoryIndexDisplay({ data }: { data: Record<string, unknown> }) {
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

function CheckpointDisplay({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string || "Checkpoint";
  const humanSummary = data.humanSummary as string || "";
  const currentFindings = data.currentFindings as string || "";
  const openQuestions = Array.isArray(data.openQuestions) ? data.openQuestions as string[] : [];
  const recommended = data.recommendedNextAction as string || "";
  const recommendedWorker = (data.recommendedWorker as Record<string, unknown> | undefined) ?? undefined;
  const promptUsed = (data.promptUsed as Record<string, unknown> | undefined) ?? undefined;
  const alternatives = Array.isArray(data.alternativeNextActions) ? data.alternativeNextActions as string[] : [];
  const stepType = data.stepType as string || "";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">{title}</span>
        {stepType && <Badge variant="secondary" className="text-[10px]">{stepType}</Badge>}
      </div>

      {humanSummary && <div className="text-sm leading-relaxed">{humanSummary}</div>}

      {currentFindings && (
        <ArtifactNotice title="Findings">
          {currentFindings}
        </ArtifactNotice>
      )}

      {openQuestions.length > 0 && (
        <div className="text-xs">
          <div className="mb-1 font-medium text-muted-foreground">Open Questions</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {openQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      {recommended && (
        <ArtifactNotice tone="green">
          <span className="font-medium">Next step: </span>
          <span>{recommended}</span>
        </ArtifactNotice>
      )}

      {recommendedWorker && (
        <ArtifactNotice tone="emerald">
          <span className="font-medium">Next task owner: </span>
          <span>
            {String(recommendedWorker.roleName ?? "")} ({String(recommendedWorker.nodeType ?? "")}) - {String(recommendedWorker.label ?? "")}
          </span>
        </ArtifactNotice>
      )}

      {promptUsed && (
        <ArtifactNotice tone="slate">
          <span className="font-medium">Prompt used: </span>
          <span>{String(promptUsed.title ?? "")}</span>
          <div className="mt-1 text-muted-foreground">
            {String(promptUsed.kind ?? "")} - {String(promptUsed.objective ?? "")}
          </div>
        </ArtifactNotice>
      )}

      {alternatives.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Alternatives: </span>
          {alternatives.join(" · ")}
        </div>
      )}
    </div>
  );
}

function TaskGraphDisplay({ data }: { data: Record<string, unknown> }) {
  const nextTask = (
    (data.nextTask as Record<string, unknown> | undefined)
    ?? (Array.isArray(data.proposedNodeSpecs) ? data.proposedNodeSpecs[0] as Record<string, unknown> : undefined)
  );
  const dispatchPreviews = Array.isArray(data.dispatchPreviews)
    ? data.dispatchPreviews as NodeDispatchPreview[]
    : [];
  const nextTaskCount = typeof data.nextTaskCount === "number"
    ? data.nextTaskCount
    : typeof data.totalNodes === "number"
      ? data.totalNodes
      : (nextTask ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          Next Task
        </Badge>
        <span className="text-xs text-muted-foreground">
          {nextTaskCount > 0 ? "Single-task dispatch is enabled." : "No task queued."}
        </span>
      </div>

      {nextTask ? (
        <ArtifactCard className="space-y-2">
          <div className="text-sm font-medium">{String(nextTask.label ?? "Untitled task")}</div>
          <div className="flex flex-wrap gap-1.5">
            {typeof nextTask.nodeType === "string" && (
              <Badge variant="secondary" className="text-[10px]">
                {String(nextTask.nodeType)}
              </Badge>
            )}
            {typeof nextTask.assignedRole === "string" && (
              <Badge variant="outline" className="text-[10px]">
                {String(nextTask.assignedRole)}
              </Badge>
            )}
            {typeof nextTask.contextTag === "string" && (
              <Badge variant="outline" className="text-[10px]">
                {String(nextTask.contextTag)}
              </Badge>
            )}
          </div>
          {Boolean(nextTask.input) && typeof nextTask.input === "object" && (
            <pre className="overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(nextTask.input, null, 2)}
            </pre>
          )}
        </ArtifactCard>
      ) : (
        <div className="text-xs text-muted-foreground">No next task captured in this artifact.</div>
      )}

      {dispatchPreviews.length > 0 && (
        <ArtifactSection title={`Worker Payload Preview (${dispatchPreviews.length})`}>
          <div className="space-y-2">
            {dispatchPreviews.map((preview, index) => {
              const payload = preview.workerPayload && typeof preview.workerPayload === "object"
                ? preview.workerPayload as Record<string, unknown>
                : {};
              const deliverables = Array.isArray(preview.deliverables) ? preview.deliverables as string[] : [];
              const completionCriteria = Array.isArray(preview.completionCriteria) ? preview.completionCriteria as string[] : [];
              const requiredInputKeys = Array.isArray(preview.requiredInputKeys) ? preview.requiredInputKeys as string[] : [];

              return (
                <ArtifactCard key={String(preview.label ?? index)} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium">{String(preview.label ?? `Task ${index + 1}`)}</div>
                    {typeof preview.nodeType === "string" && (
                      <Badge variant="secondary" className="text-[10px]">
                        {String(preview.nodeType)}
                      </Badge>
                    )}
                    {typeof preview.assignedRole === "string" && (
                      <Badge variant="outline" className="text-[10px]">
                        {String(preview.assignedRole)}
                      </Badge>
                    )}
                  </div>

                  {typeof preview.templatePurpose === "string" && preview.templatePurpose && (
                    <div className="text-xs text-muted-foreground">{String(preview.templatePurpose)}</div>
                  )}

                  {deliverables.length > 0 && (
                    <SectionList title="Deliverables" items={deliverables} compact />
                  )}
                  {completionCriteria.length > 0 && (
                    <SectionList title="Completion Criteria" items={completionCriteria} compact />
                  )}

                  {requiredInputKeys.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-muted-foreground">Expected payload keys</div>
                      <div className="flex flex-wrap gap-1.5">
                        {requiredInputKeys.map((key) => (
                          <Badge key={key} variant="outline" className="text-[10px]">
                            {key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </ArtifactCard>
              );
            })}
          </div>
        </ArtifactSection>
      )}

      {typeof data.suggestedNextContextTag === "string" && data.suggestedNextContextTag && (
        <div className="text-xs text-muted-foreground">
          Context after this task: {data.suggestedNextContextTag}
        </div>
      )}
    </div>
  );
}
