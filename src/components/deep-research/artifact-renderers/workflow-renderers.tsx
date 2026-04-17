import type { NodeDispatchPreview } from "@/lib/deep-research/node-spec-templates";
import { Badge } from "@/components/ui/badge";
import {
  ArtifactCard,
  ArtifactNotice,
  ArtifactSection,
  SectionList,
} from "../artifact-renderer-primitives";

export function RoleSpecificationDisplay({ data }: { data: Record<string, unknown> }) {
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

export function TaskBoardDisplay({ data }: { data: Record<string, unknown> }) {
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

export function CollaborationPacketDisplay({ data }: { data: Record<string, unknown> }) {
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

export function ProtocolGraphDisplay({ data }: { data: Record<string, unknown> }) {
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

export function KeyValueDisplay({ data }: { data: Record<string, unknown> }) {
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

export function CheckpointDisplay({ data }: { data: Record<string, unknown> }) {
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

export function TaskGraphDisplay({ data }: { data: Record<string, unknown> }) {
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
