import { Badge } from "@/components/ui/badge";
import {
  ArtifactCard,
  ArtifactNotice,
  ArtifactSection,
} from "../artifact-renderer-primitives";

export function ReviewerPacketDisplay({ data }: { data: Record<string, unknown> }) {
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
            {(data.suggestions as string[]).map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ExecutionPlanDisplay({ data }: { data: Record<string, unknown> }) {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  return (
    <div className="space-y-2">
      {steps.map((step: Record<string, unknown>, index: number) => (
        <div key={index} className="flex items-start gap-2 text-sm p-2 border rounded">
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">
            {index + 1}
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

export function StepResultDisplay({ data }: { data: Record<string, unknown> }) {
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
          {(data.observations as string[]).map((observation, index) => (
            <li key={index}>{observation}</li>
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

export function ReviewAssessmentDisplay({ data }: { data: Record<string, unknown> }) {
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
            {reviewHighlights.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      )}

      {openIssues.length > 0 && (
        <div>
          <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Open Issues</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {openIssues.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      )}

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

export function MainBrainAuditDisplay({ data }: { data: Record<string, unknown> }) {
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
            {(data.issuesAndRisks as string[]).map((risk, index) => <li key={index}>{risk}</li>)}
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
          {(data.alternativeActions as Array<{ label: string; description: string }>).map((alternative, index) => (
            <div key={index} className="p-1.5 bg-muted rounded">
              <span className="font-medium">{alternative.label}:</span> {alternative.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ValidationPlanDisplay({ data }: { data: Record<string, unknown> }) {
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
          {steps.map((step: Record<string, unknown>, index: number) => (
            <ArtifactCard key={index} className="flex items-start gap-2 p-2 text-xs">
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{Number(step.stepNumber) || index + 1}</span>
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
            {(data.successCriteria as string[]).map((criterion, index) => <li key={index}>{criterion}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ExecutionManifestDisplay({ data }: { data: Record<string, unknown> }) {
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
