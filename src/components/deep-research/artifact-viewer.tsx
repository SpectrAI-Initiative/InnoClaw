"use client";

import type { DeepResearchArtifact } from "@/lib/deep-research/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ArtifactViewerProps {
  artifact: DeepResearchArtifact;
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  const content = artifact.content;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold flex-1">{artifact.title}</h4>
        <Badge variant="outline" className="text-[10px]">
          {artifact.artifactType}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          v{artifact.version}
        </Badge>
      </div>

      <ScrollArea className="max-h-[600px]">
        {renderContent(artifact.artifactType, content)}
      </ScrollArea>
    </div>
  );
}

function renderContent(type: string, content: Record<string, unknown>) {
  switch (type) {
    case "research_brief":
      return <KeyValueDisplay data={content} />;

    case "evidence_card":
      return <EvidenceCardDisplay data={content} />;

    case "structured_summary":
    case "literature_round_summary":
      return <MarkdownDisplay text={content.summary as string || JSON.stringify(content, null, 2)} />;

    case "reviewer_packet":
      return <ReviewerPacketDisplay data={content} />;

    case "reviewer_battle_result":
      return <ReviewerBattleDisplay data={content} />;

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
    case "experiment_result":
      return <StepResultDisplay data={content} />;

    case "final_report":
      return <MarkdownDisplay text={
        content.text as string
        || content.report as string
        || content.messageToUser as string
        || content.content as string
        || JSON.stringify(content, null, 2)
      } />;

    case "task_graph":
      return <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(content, null, 2)}</pre>;

    case "checkpoint":
      return <CheckpointDisplay data={content} />;

    default:
      return <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(content, null, 2)}</pre>;
  }
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

function EvidenceCardDisplay({ data }: { data: Record<string, unknown> }) {
  const claims = Array.isArray(data.claims) ? data.claims : [];
  const gaps = Array.isArray(data.gaps) ? data.gaps : [];

  return (
    <div className="space-y-3">
      {claims.map((claim: Record<string, unknown>, i: number) => (
        <div key={i} className="p-2 border rounded text-sm space-y-1">
          <div className="font-medium">{claim.claim as string}</div>
          <div className="text-xs text-muted-foreground">{claim.evidence as string}</div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {claim.source as string}
            </Badge>
            <ConfidenceBadge confidence={claim.confidence as string} />
          </div>
        </div>
      ))}
      {gaps.length > 0 && (
        <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded text-sm">
          <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Gaps</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {gaps.map((gap: string, i: number) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </div>
      )}
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

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colors: Record<string, string> = {
    high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    low: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return (
    <Badge className={colors[confidence] || ""} variant="outline">
      {confidence}
    </Badge>
  );
}

function MarkdownDisplay({ text }: { text: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function ReviewerBattleDisplay({ data }: { data: Record<string, unknown> }) {
  const verdict = data.combinedVerdict as string;
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
          Combined confidence: {((data.combinedConfidence as number) * 100).toFixed(0)}%
        </span>
      </div>

      {/* Reviewer positions */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded text-xs">
          <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">Reviewer A</div>
          <div className="text-blue-700 dark:text-blue-300">{data.reviewerAPosition as string}</div>
        </div>
        <div className="p-2 bg-cyan-50 dark:bg-cyan-950/50 rounded text-xs">
          <div className="font-medium text-cyan-800 dark:text-cyan-200 mb-1">Reviewer B</div>
          <div className="text-cyan-700 dark:text-cyan-300">{data.reviewerBPosition as string}</div>
        </div>
      </div>

      {/* Agreements */}
      {Array.isArray(data.agreements) && data.agreements.length > 0 && (
        <div>
          <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Agreements</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {(data.agreements as string[]).map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {/* Disagreements */}
      {Array.isArray(data.disagreements) && data.disagreements.length > 0 && (
        <div>
          <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Disagreements</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {(data.disagreements as string[]).map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      )}

      {/* Unresolved gaps */}
      {Array.isArray(data.unresolvedGaps) && data.unresolvedGaps.length > 0 && (
        <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded text-xs">
          <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Unresolved Gaps</div>
          <ul className="list-disc list-inside space-y-0.5">
            {(data.unresolvedGaps as string[]).map((g, i) => <li key={i}>{g}</li>)}
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
        <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded text-xs">
          <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Issues & Risks</div>
          <ul className="list-disc list-inside space-y-0.5">
            {(data.issuesAndRisks as string[]).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {typeof data.continueWillDo === "string" && data.continueWillDo && (
        <div className="p-2 bg-green-50 dark:bg-green-950/50 rounded text-xs">
          <span className="font-medium text-green-800 dark:text-green-200">Continue will: </span>
          <span className="text-green-700 dark:text-green-300">{data.continueWillDo}</span>
        </div>
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
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Steps</div>
          {steps.map((step: Record<string, unknown>, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs p-2 border rounded">
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{Number(step.stepNumber) || i + 1}</span>
              <div className="flex-1">
                <div className="font-medium">{String(step.description || "")}</div>
                {typeof step.command === "string" && step.command && <code className="text-[10px] text-muted-foreground">{step.command}</code>}
                {Boolean(step.requiresApproval) && <Badge variant="outline" className="text-[10px] mt-1">Needs Approval</Badge>}
              </div>
            </div>
          ))}
        </div>
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

function CheckpointDisplay({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string || "Checkpoint";
  const humanSummary = data.humanSummary as string || "";
  const currentFindings = data.currentFindings as string || "";
  const openQuestions = Array.isArray(data.openQuestions) ? data.openQuestions as string[] : [];
  const recommended = data.recommendedNextAction as string || "";
  const alternatives = Array.isArray(data.alternativeNextActions) ? data.alternativeNextActions as string[] : [];
  const phase = data.phase as string || "";
  const stepType = data.stepType as string || "";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">{title}</span>
        {phase && <Badge variant="outline" className="text-[10px]">{phase}</Badge>}
        {stepType && <Badge variant="secondary" className="text-[10px]">{stepType}</Badge>}
      </div>

      {humanSummary && <div className="text-sm leading-relaxed">{humanSummary}</div>}

      {currentFindings && (
        <div className="text-xs p-2 bg-muted rounded">
          <div className="font-medium text-muted-foreground mb-1">Findings</div>
          {currentFindings}
        </div>
      )}

      {openQuestions.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Open Questions</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {openQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      {recommended && (
        <div className="text-xs p-2 bg-green-50 dark:bg-green-950/50 rounded">
          <span className="font-medium text-green-800 dark:text-green-200">Recommended: </span>
          <span className="text-green-700 dark:text-green-300">{recommended}</span>
        </div>
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
