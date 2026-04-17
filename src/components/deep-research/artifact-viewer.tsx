"use client";

import type { DeepResearchArtifact } from "@/lib/deep-research/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getNodeDisplayLabel } from "@/lib/deep-research/role-registry";
import {
  getMarkdownArtifactText,
  resolveArtifactRendererKind,
} from "./artifact-renderer-registry";
import { MarkdownDisplay } from "./artifact-renderer-primitives";
import {
  CheckpointDisplay,
  CollaborationPacketDisplay,
  KeyValueDisplay,
  ProtocolGraphDisplay,
  RoleSpecificationDisplay,
  TaskBoardDisplay,
  TaskGraphDisplay,
} from "./artifact-renderers/workflow-renderers";
import {
  EvidenceCardDisplay,
  StructuredSummaryDisplay,
} from "./artifact-renderers/evidence-renderers";
import {
  ExecutionManifestDisplay,
  ExecutionPlanDisplay,
  MainBrainAuditDisplay,
  ReviewAssessmentDisplay,
  ReviewerPacketDisplay,
  StepResultDisplay,
  ValidationPlanDisplay,
} from "./artifact-renderers/analysis-renderers";
import {
  FinalReportMarkdownDisplay,
  MemoryIndexDisplay,
  MemoryProfileDisplay,
  MemorySnapshotDisplay,
} from "./artifact-renderers/memory-renderers";

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
  const renderedContent = renderArtifactContent(artifact.artifactType, artifact.content, {
    evidenceExcerptLimit,
  });

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

function renderArtifactContent(
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
      return <FinalReportMarkdownDisplay content={content} />;
    case "task_graph":
      return <TaskGraphDisplay data={content} />;
    case "checkpoint":
      return <CheckpointDisplay data={content} />;
    default:
      return (
        <MarkdownDisplay text={typeof getMarkdownArtifactText(content) === "string"
          ? getMarkdownArtifactText(content)
          : JSON.stringify(content, null, 2)}
        />
      );
  }
}
