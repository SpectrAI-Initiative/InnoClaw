import type {
  CheckpointPackage,
  ConfirmationOutcome,
  ContextTag,
  DeepResearchArtifact,
  DeepResearchNode,
  DeepResearchSession,
} from "../types";

export function buildCheckpointPrompt(
  session: DeepResearchSession,
  completedNode: DeepResearchNode,
  artifacts: DeepResearchArtifact[],
  nodes: DeepResearchNode[],
  contextTag: ContextTag,
): string {
  const isFinalReportingStep = completedNode.nodeType === "final_report" || contextTag === "final_report";
  const relevantNodeIds = isEvidenceAggregationPhase(contextTag, completedNode, nodes)
    ? new Set(
        nodes
          .filter((node) =>
            node.nodeType === "evidence_gather" &&
            node.contextTag === contextTag &&
            ["completed", "failed", "skipped"].includes(node.status),
          )
          .map((node) => node.id),
      )
    : null;

  const nodeArtifacts = relevantNodeIds
    ? artifacts.filter((artifact) =>
        artifact.artifactType === "evidence_card" &&
        Boolean(artifact.nodeId) &&
        relevantNodeIds.has(artifact.nodeId as string),
      )
    : artifacts.filter((artifact) => artifact.nodeId === completedNode.id);

  const evidenceTotalSources = nodeArtifacts.reduce((sum, artifact) => {
    const sources = Array.isArray(artifact.content.sources) ? artifact.content.sources : [];
    const totalFound = typeof artifact.content.totalFound === "number"
      ? artifact.content.totalFound
      : typeof artifact.content.papersFound === "number"
        ? artifact.content.papersFound
        : sources.length;
    return sum + Math.max(totalFound, sources.length);
  }, 0);

  const artifactPreviews = nodeArtifacts.map((artifact) => {
    const contentString = JSON.stringify(artifact.content);
    return `  - [short=${artifact.id.slice(0, 8)} | id=${artifact.id}] ${artifact.title} (${artifact.artifactType}): ${contentString.length > 400 ? `${contentString.slice(0, 400)}...` : contentString}`;
  }).join("\n");

  const allNodesSummary = nodes.map((node) =>
    `  - [short=${node.id.slice(0, 8)} | id=${node.id}] ${node.label} (${node.nodeType}, ${node.status}, context=${node.contextTag})`,
  ).join("\n");

  const reviewAssessments = isFinalReportingStep
    ? artifacts.filter((artifact) => artifact.artifactType === "review_assessment").slice(-1)
    : artifacts.filter((artifact) => artifact.artifactType === "review_assessment");
  const reviewSection = reviewAssessments.length > 0
    ? `\n## Review Assessments\n${reviewAssessments.map((review) => JSON.stringify(review.content, null, 2)).join("\n")}`
    : "";
  const finalReportingRule = isFinalReportingStep
    ? `

## Final Report Phase Rule
- You are already in the report-writing/final-report phase.
- Do NOT recommend restarting broad literature discovery, restarting literature round counting, or returning to an earlier "round 1/N" style search loop.
- The default next action here is to let the user review/accept the final report or request targeted revisions.
- Only recommend additional literature work if there is a clearly blocking evidence gap that prevents the report from standing as a final deliverable, and frame it as a targeted revision request rather than a restart of the workflow.
`
    : "";

  return `You have just completed a step in a step-gated deep research workflow.
The system will HALT and present your summary to the user for review.

## Completed Step
- Node: "${completedNode.label}" (${completedNode.nodeType})
- Role: ${completedNode.assignedRole}
- Status: ${completedNode.status}
- Context Tag: ${contextTag}
${isEvidenceAggregationPhase(contextTag, completedNode, nodes) ? `- Aggregated evidence cards in this literature execution context: ${nodeArtifacts.length}\n- Aggregated sources/papers found in this literature execution context: ${evidenceTotalSources}` : ""}

## Artifacts Produced
${artifactPreviews || "  (none)"}

## Current Task Graph
${allNodesSummary || "  (none)"}
${reviewSection}
${finalReportingRule}

## Session
- Title: "${session.title}"
- Literature round: ${session.literatureRound}
- Reviewer round: ${session.reviewerRound}
- Execution loop: ${session.executionLoop}
- Tokens used: ${session.budget.totalTokens} / ${session.config.budget.maxTotalTokens}

## Instructions
Produce a checkpoint summary with your AUDIT/OPINION as JSON:
{
  "title": "Short title for this checkpoint",
  "humanSummary": "Clear 2-5 sentence summary for the user. Be specific.",
  "machineSummary": "Compact internal summary for your own context.",
  "mainBrainAudit": {
    "whatWasCompleted": "Description of what this stage accomplished",
    "resultAssessment": "good|acceptable|concerning|problematic",
    "issuesAndRisks": ["Issue 1", "Issue 2"],
    "recommendedNextAction": "What you recommend doing next",
    "continueWillDo": "Exactly what clicking Continue will do",
    "alternativeActions": [
      {"label": "Continue", "description": "Proceed with recommendation", "actionType": "continue"},
      {"label": "Revise", "description": "Change approach", "actionType": "revise"},
      {"label": "More Literature", "description": "Search for more papers", "actionType": "more_literature"},
      {"label": "Stop", "description": "End research", "actionType": "stop"}
    ],
    "canProceed": true
  },
  "currentFindings": "What we know so far",
  "openQuestions": ["Question 1"],
  "recommendedNextAction": "What should happen next",
  "continueWillDo": "Exactly what clicking Continue will trigger",
  "alternativeNextActions": ["Alternative 1"],
  "requiresUserConfirmation": true
}

IMPORTANT: The "continueWillDo" field must clearly state what "Continue" means at this point.
Example: "Continue will let the Researcher route the next workflow, beginning with 3 literature-analysis tasks searching for papers."
NOT vague: "Continue will continue the research."
- When you mention node or artifact identifiers in any proposed next task, use the full canonical id shown as \`id=...\`, not the short display prefix.`;
}

export function buildConfirmationInterpretationPrompt(
  session: DeepResearchSession,
  checkpoint: CheckpointPackage,
  outcome: ConfirmationOutcome,
  userFeedback: string | undefined,
  nodes: DeepResearchNode[],
  artifacts: DeepResearchArtifact[],
): string {
  const nodesSummary = nodes.map((node) =>
    `  - [short=${node.id.slice(0, 8)} | id=${node.id}] ${node.label} (${node.nodeType}, ${node.status})`,
  ).join("\n");

  const latestTaskGraph = artifacts
    .filter((artifact) => artifact.artifactType === "task_graph")
    .slice(-1)[0];
  const proposedPlanSummary = latestTaskGraph
    ? JSON.stringify({
        title: latestTaskGraph.title,
        nextTaskCount: latestTaskGraph.content.nextTaskCount ?? latestTaskGraph.content.totalNodes,
        skillsUsed: latestTaskGraph.content.skillsUsed,
        suggestedNextContextTag: latestTaskGraph.content.suggestedNextContextTag,
        nextTask: latestTaskGraph.content.nextTask ?? latestTaskGraph.content.proposedNodeSpecs,
      }, null, 2)
    : "(no task_graph artifact available)";
  const isFinalReportingCheckpoint = checkpoint.isFinalStep || checkpoint.contextTag === "final_report";
  const finalReportRule = isFinalReportingCheckpoint
    ? `

## Final-Report Confirmation Rule
This checkpoint is already in the final report phase.
- If the user confirms, treat that as accepting the final report path rather than reopening broad literature discovery.
- Do NOT dispatch new evidence-gather work unless the user explicitly asks to reopen literature review or requests targeted evidence additions.
- If the user wants changes, prefer targeted revisions to the report or its supporting claims instead of restarting from an earlier literature round.`
    : "";

  return `The user has responded to a checkpoint in the step-gated deep research workflow.

## Checkpoint That Was Presented
- Title: "${checkpoint.title}"
- Context Tag: ${checkpoint.contextTag}
- Summary: ${checkpoint.humanSummary}
- Your recommended next: ${checkpoint.recommendedNextAction}
- "Continue" was described as: ${checkpoint.continueWillDo || checkpoint.recommendedNextAction}

## User's Response
- Outcome: ${outcome}
${userFeedback ? `- Feedback: "${userFeedback}"` : "- (no additional feedback)"}

## Current Task Graph
${nodesSummary}

## Latest Next-Task Plan
${proposedPlanSummary}
${finalReportRule}

## CRITICAL SEMANTIC RULE
"Continue" means: proceed according to YOUR recommended next action.
It does NOT mean "blindly run the old pipeline." It means the user accepts YOUR recommendation.

## Next-Task Confirmation Rule
If the checkpoint included a task_graph artifact and the user confirmed it:
- treat the approved next-task artifact as authorized for dispatch;
- return only the NEXT approved worker task in "nodesToCreate";
- set "nextContextTag" to "planning" unless the approved work is a final report.

## Literature-Dispatch Rule
If the user confirmed a checkpoint that recommends literature work:
- return at most one explicit evidence_gather task in "nodesToCreate" when new literature work is required;
- assign those tasks to "literature_intelligence_analyst";
- do not rely on any hidden runtime handler to fabricate fallback searches.

## Re-Planning Rule
If the checkpoint proposed a next task and the user feedback changes core objectives, task division, time nodes, or resources:
- do NOT dispatch workers;
- return "action": "revise" or "branch" and keep the workflow in planning.

## Instructions
Respond with JSON:
{
  "action": "continue" | "revise" | "retry" | "branch" | "supersede" | "stop",
  "reasoning": "Brief explanation",
  "nodesToCreate": [/* optional */],
  "nextContextTag": "optional context tag",
  "messageToUser": "optional message"
}`;
}

function isEvidenceAggregationPhase(
  contextTag: ContextTag,
  completedNode: DeepResearchNode,
  nodes: DeepResearchNode[],
): boolean {
  if (contextTag !== "planning") {
    return false;
  }

  if (completedNode.nodeType === "evidence_gather") {
    return true;
  }

  return nodes.some((node) =>
    node.nodeType === "evidence_gather" &&
    node.contextTag === "planning" &&
    ["completed", "failed", "skipped"].includes(node.status),
  );
}
