import type {
  DeepResearchSession,
  DeepResearchMessage,
  DeepResearchNode,
  DeepResearchArtifact,
  ContextTag,
  NodeType,
  CheckpointPackage,
  ConfirmationOutcome,
  ReviewAssessment,
  RequirementState,
} from "./types";
import {
  buildRuntimeRoleContract,
  listMetaWorkerRoleDefinitions,
} from "./role-registry";

// =============================================================
// RESEARCHER SYSTEM PROMPT
// =============================================================

/**
 * Build the system prompt for the Researcher orchestrator.
 * Includes full context: session state, messages, nodes, artifacts, and the legacy context tag.
 */
export function buildMainBrainSystemPrompt(
  session: DeepResearchSession,
  messages: DeepResearchMessage[],
  nodes: DeepResearchNode[],
  artifacts: DeepResearchArtifact[],
  contextTag: ContextTag,
  requirementState?: RequirementState | null,
  workstationContext?: string | null,
  memoryContext?: string | null,
  doctrineContext?: string | null,
): string {
  const specialistRoleNames = listMetaWorkerRoleDefinitions().map((role) => role.roleName).join(", ");
  const researcherContract = buildRuntimeRoleContract("researcher", "plan", {
    includeResponsibilities: true,
    includeCollaboration: true,
    includePerformance: true,
    maxItemsPerSection: 3,
  });
  const nodeStatusSummary = nodes.map((n) =>
    `  - [${n.id.slice(0, 8)}] ${n.label} (${n.nodeType}, ${n.status}, role=${n.assignedRole}, context=${n.contextTag})`
  ).join("\n");

  const artifactSummary = artifacts
    .filter((a) => !a.artifactType.startsWith("memory_"))
    .map((a) => {
    const contentStr = JSON.stringify(a.content);
    const preview = contentStr.length > 500 ? contentStr.slice(0, 500) + "..." : contentStr;
    return `  - [${a.id.slice(0, 8)}] ${a.title} (${a.artifactType}): ${preview}`;
    }).join("\n");

  const recentMessages = messages.slice(-10).map((m) =>
    `  [${m.role}]: ${m.content.slice(0, 300)}${m.content.length > 300 ? "..." : ""}`
  ).join("\n");

  const reviewerPackets = artifacts
    .filter((a) => a.artifactType === "reviewer_packet")
    .map((a) => `  Reviewer Packet [${a.id.slice(0, 8)}]: ${JSON.stringify(a.content).slice(0, 500)}`)
    .join("\n");

  const reviewAssessments = artifacts
    .filter((a) => a.artifactType === "review_assessment")
    .map((a) => `  Review Assessment [${a.id.slice(0, 8)}]: ${JSON.stringify(a.content).slice(0, 500)}`)
    .join("\n");

  // Build requirement state section
  let requirementSection = "";
  if (requirementState && requirementState.requirements.length > 0) {
    const reqLines = requirementState.requirements.map((r) =>
      `  - [${r.status}] (${r.priority}) ${r.text}${r.satisfiedByNodeIds.length > 0 ? ` [satisfied by: ${r.satisfiedByNodeIds.join(",")}]` : ""}`
    ).join("\n");
    const constraintLines = requirementState.constraints.map((c) =>
      `  - [${c.status}] (${c.type}) ${c.text}: ${c.value}`
    ).join("\n");
    requirementSection = `
## Requirements (v${requirementState.version})
IMPORTANT: Check each requirement's status before planning. Only create work for ACTIVE requirements.
${reqLines}

## Constraints
${constraintLines}
`;
  }

  const workstationSection = workstationContext
    ? `\n## Additional Coordination Context\n${workstationContext}\n`
    : "";

  const memorySection = memoryContext
    ? `\n${memoryContext}\n`
    : "";
  const doctrineSection = doctrineContext
    ? `\n${doctrineContext}\n`
    : "";

  return `You are GPT-5.4 High acting as the "Researcher" — the main-brain of an automated research tool.

## Core Mission
Lead the entire automated research workflow, make data-driven decisions, and keep the research process logical, rigorous, traceable, and aligned with the user's goals.

## Structured Role Contract
${researcherContract || "  (no structured role contract available)"}

## Specialist Topology
- Researcher (you) is the top-level coordinator and decision-maker.
- Results and Evidence Analyst reviews are advisory only. They cannot redefine the workflow.
- Specialist roles available for dispatch: ${specialistRoleNames}.

## Runtime Dispatch Rules
- Return at most ONE NodeCreationSpec in "nodesToCreate" for each decision.
- One clear task per node, with explicit inputs, outputs, stop conditions, and dependencies.
- Assign exactly one responsible role per node and keep assignments non-overlapping.
- Runtime dispatch is node-driven, not stage-driven. Decide the next worker from the confirmed plan, current evidence, and dependency state.
- Do not rely on hidden workflow stages. If a worker should act next, express that directly in "nodesToCreate".

## Ambiguity And Planning Gates
- On the first planning pass, you MUST use "messageToUser" to present a complete plan grounded in the workstation search before any worker dispatch can begin.
- The first plan must explain: objectives, task split, phases to execute, phases to skip, expected outputs, risks, and why the chosen workflow fits the user's question.
- Treat "nodesToCreate" as a proposed assignment set until the user confirms.
- If ambiguity remains, return action "respond_to_user" and ask targeted questions with no worker dispatch.
- When the next step is already clear and within confirmed scope, you may move directly into execution supervision and dispatch role-scoped tasks.
- Do NOT schedule experiment design or execution just because those roles exist. Use them only when the user explicitly asks for empirical validation, implementation, reproduction, benchmarking, or when the confirmed plan truly requires it.
- For survey, mechanism, taxonomy, comparison, conceptual-analysis, and desk-research requests, default to literature/synthesis/reporting workflows and explicitly skip unnecessary experimental phases.
- Any plan you present should explicitly cover objectives, task division, time nodes, resource requirements, risk prevention, and the four verification checks.

## Current State
- Session: "${session.title}" (id: ${session.id})
- Status: ${session.status}
- Legacy Context Tag: ${contextTag} (compatibility only; do not treat this as a required next step)
- Literature round: ${session.literatureRound} / ${session.config.literature.maxLiteratureRounds}
- Reviewer round: ${session.reviewerRound} / ${session.config.maxReviewerRounds}
- Execution loop: ${session.executionLoop} / ${session.config.maxExecutionLoops}
- Budget: ${session.budget.totalTokens} / ${session.config.budget.maxTotalTokens} total tokens
- Opus tokens: ${session.budget.opusTokens} / ${session.config.budget.maxOpusTokens}

## Task Graph Nodes
${nodeStatusSummary || "  (none yet)"}

## Artifacts
${artifactSummary || "  (none yet)"}

## Analytical Critique Feedback
${reviewerPackets || "  (none yet)"}

## Review Assessments
${reviewAssessments || "  (none yet)"}

## Recent Conversation
${recentMessages || "  (no messages yet)"}
${requirementSection}
${workstationSection}
${doctrineSection}
${memorySection}
## Output Format
You MUST respond with valid JSON matching the BrainDecision schema:
{
  "action": "advance_context" | "revise_plan" | "request_approval" | "complete" | "respond_to_user",
  "nextContextTag": "(optional legacy context tag for compatibility only)",
  "nodesToCreate": [(optional) array of NodeCreationSpec],
  "messageToUser": "(optional) message to display",
  "reasoning": "(optional) internal reasoning"
}

NodeCreationSpec:
{
  "nodeType": "evidence_gather|evidence_extract|summarize|synthesize|review|audit|validation_plan|resource_request|execute|monitor|result_collect|result_compare|approve|final_report",
  "label": "specific task description",
  "assignedRole": "researcher|literature_intelligence_analyst|experiment_architecture_designer|research_software_engineer|experiment_operations_engineer|results_and_evidence_analyst|research_asset_reuse_specialist",
  "input": { ... task-specific input ... },
  "dependsOn": ["nodeId1"],
  "parentId": "optional parent",
  "contextTag": "optional legacy context tag; omit unless needed for compatibility"
}

## Recommended "messageToUser" Structure For Planning Or Clarification
When you choose to present a plan or clarification request, prefer this structure:
1. Context Review Summary
2. Workstation Search Findings
3. Clarification Questions (only if ambiguity exists)
4. Plan Options
5. Recommended Plan
6. Verification Statement
7. User Confirmation Request

Inside Recommended Plan, include:
- 1. Core Research Objectives
- 2. Task Division & Responsible Roles
- 3. Time Nodes
- 4. Resource Requirements
- 5. Risk Prevention

Inside Plan Options, provide 2-3 concrete options when meaningful, each with:
- Scope and intended outcome
- Trade-offs
- Required roles/resources
- Why the user might choose it

The verification statement must explicitly cover alignment, feasibility, rigor, and completeness.

## Cost Awareness
- Use specialist roles for bulk work and keep your own reasoning focused on strategic decisions.
- Max specialist fan-out: 1
- Specialist execution is serial. Only one specialist task runs at a time.
- Literature bounds: max ${session.config.literature.maxPapersPerRound} papers/round, max ${session.config.literature.maxLiteratureRounds} rounds`;
}

// =============================================================
// CHECKPOINT + RESEARCHER AUDIT PROMPT
// =============================================================

/**
 * Build a prompt that asks the Researcher to produce a CheckpointPackage
 * WITH a MainBrainAudit section — the Researcher's opinion on the stage result.
 */
export function buildCheckpointPrompt(
  session: DeepResearchSession,
  completedNode: DeepResearchNode,
  artifacts: DeepResearchArtifact[],
  nodes: DeepResearchNode[],
  contextTag: ContextTag
): string {
  const isFinalReportingStep = completedNode.nodeType === "final_report" || contextTag === "final_report";
  const relevantNodeIds = isEvidenceAggregationPhase(contextTag, completedNode, nodes)
    ? new Set(
        nodes
          .filter((node) =>
            node.nodeType === "evidence_gather" &&
            node.contextTag === contextTag &&
            ["completed", "failed", "skipped"].includes(node.status)
          )
          .map((node) => node.id)
      )
    : null;

  const nodeArtifacts = relevantNodeIds
    ? artifacts.filter((artifact) =>
        artifact.artifactType === "evidence_card" &&
        Boolean(artifact.nodeId) &&
        relevantNodeIds.has(artifact.nodeId as string)
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

  const artifactPreviews = nodeArtifacts.map((a) => {
    const contentStr = JSON.stringify(a.content);
    return `  - [${a.id.slice(0, 8)}] ${a.title} (${a.artifactType}): ${contentStr.length > 400 ? contentStr.slice(0, 400) + "..." : contentStr}`;
  }).join("\n");

  const allNodesSummary = nodes.map((n) =>
    `  - [${n.id.slice(0, 8)}] ${n.label} (${n.nodeType}, ${n.status}, context=${n.contextTag})`
  ).join("\n");

  // Include analytical deliberation results if this context includes critique
  const reviewAssessments = isFinalReportingStep
    ? artifacts.filter((artifact) => artifact.artifactType === "review_assessment").slice(-1)
    : artifacts.filter((artifact) => artifact.artifactType === "review_assessment");
  const reviewSection = reviewAssessments.length > 0
    ? `\n## Review Assessments\n${reviewAssessments.map(review => JSON.stringify(review.content, null, 2)).join("\n")}`
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
NOT vague: "Continue will continue the research."`;
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
    ["completed", "failed", "skipped"].includes(node.status)
  );
}

// =============================================================
// CONFIRMATION INTERPRETATION PROMPT
// =============================================================

export function buildConfirmationInterpretationPrompt(
  session: DeepResearchSession,
  checkpoint: CheckpointPackage,
  outcome: ConfirmationOutcome,
  userFeedback: string | undefined,
  nodes: DeepResearchNode[],
  artifacts: DeepResearchArtifact[],
): string {
  const nodesSummary = nodes.map((n) =>
    `  - [${n.id.slice(0, 8)}] ${n.label} (${n.nodeType}, ${n.status})`
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

// =============================================================
// WORKER SYSTEM PROMPTS
// =============================================================

export function buildWorkerSystemPrompt(
  node: DeepResearchNode,
  parentArtifacts: DeepResearchArtifact[],
  taskType: NodeType
): string {
  const roleContract = buildRuntimeRoleContract(node.assignedRole, taskType, {
    includeResponsibilities: true,
    includeCollaboration: true,
    includePerformance: true,
    maxItemsPerSection: 2,
  });
  const contextSection = parentArtifacts.length > 0
    ? "## Context Artifacts\n" + parentArtifacts.map((a) =>
        `### ${a.title} (${a.artifactType})\n${JSON.stringify(a.content, null, 2)}`
      ).join("\n\n")
    : "";

  const outputSchema = getWorkerOutputSchema(taskType);

  return `You are a specialist role executing a specific, scoped subtask.

## RULES
- Focus ONLY on the assigned task. Do NOT address the broader research question.
- Cite provenance for all claims: which source, which section, what evidence.
- Do NOT hallucinate. If information is missing, say so.
- Do NOT self-assign additional tasks or redefine the plan.
- Do NOT dispatch other roles or make final conclusions.
- Be thorough but concise. Quality over quantity.

## Structured Role Contract
${roleContract || "  (no structured role contract available)"}

## Your Task
${node.label}

## Task Input
${node.input ? JSON.stringify(node.input, null, 2) : "(no specific input)"}

${contextSection}

## Output Requirements
${outputSchema}`;
}

function getWorkerOutputSchema(taskType: NodeType): string {
  switch (taskType) {
    case "evidence_gather":
      return `Produce an evidence card as JSON:
{
  "claims": [{"claim": "...", "evidence": "...", "source": "...", "confidence": "high|medium|low"}],
  "methods": ["methods identified"],
  "datasets": ["datasets mentioned"],
  "gaps": ["areas where evidence is insufficient"],
  "papersFound": 0,
  "searchQueries": ["queries used"],
  "confidence": 0.0-1.0
}
Stay within the specified paper limit. Do not do unbounded searching.`;

    case "evidence_extract":
      return `Extract structured information from the provided papers/sources:
{
  "extractions": [
    {"source": "...", "objective": "...", "method": "...", "results": "...", "limitations": "..."}
  ],
  "crossReferences": ["connections between sources"],
  "confidence": 0.0-1.0
}`;

    case "execute":
      return `Produce a step result as JSON:
{
  "status": "success|failure|partial",
  "outputs": { ... },
  "commands": ["commands executed"],
  "observations": ["key observations"],
  "errors": ["any errors"],
  "metrics": { ... }
}`;

    case "resource_request":
      return `Produce a resource request manifest as JSON:
{
  "launcherType": "rlaunch|rjob",
  "resources": {"gpu": N, "memoryMb": N, "cpu": N},
  "purpose": "what this resource is for",
  "estimatedDuration": "estimate",
  "manifest": { ... full manifest fields ... }
}`;

    case "monitor":
      return `Produce a monitoring report as JSON:
{
  "jobStatus": "running|completed|failed|unknown",
  "progress": "description of progress",
  "metrics": { ... },
  "issues": ["any issues observed"],
  "estimatedCompletion": "estimate"
}`;

    case "result_collect":
      return `Collect and package results as JSON:
{
  "outputs": { ... collected files/metrics ... },
  "summary": "brief summary of results",
  "completeness": "complete|partial|failed",
  "missingOutputs": ["expected outputs not found"]
}`;

    case "result_compare":
      return `Compare results against expectations as JSON:
{
  "hypothesis": "what was expected",
  "actualResult": "what happened",
  "match": "confirmed|partially_confirmed|contradicted|inconclusive",
  "metrics": { ... },
  "analysis": "detailed comparison",
  "confidence": 0.0-1.0
}`;

    case "summarize":
      return `Produce a structured summary in markdown. Include:
- Key findings organized by sub-question
- Evidence strength assessment
- Gaps and limitations
- Cross-references between findings`;

    case "synthesize":
      return `Produce a synthesis in markdown. Include:
- Integrated findings across all sub-questions
- Resolution of conflicting evidence
- Overall conclusions with confidence levels
- Recommendations`;

    default:
      return `Produce a clear, structured response addressing the assigned task.`;
  }
}

// =============================================================
// ANALYTICAL REVIEW PROMPT
// =============================================================

export function buildReviewerSystemPrompt(
  role: "results_and_evidence_analyst",
  targetArtifacts: DeepResearchArtifact[],
  previousPackets?: DeepResearchArtifact[],
  roundInfo?: { round: number; maxRounds: number }
): string {
  const artifactsSection = targetArtifacts.map((a) =>
    `### ${a.title} (${a.artifactType})\n${JSON.stringify(a.content, null, 2)}`
  ).join("\n\n");

  const previousSection = previousPackets && previousPackets.length > 0
    ? "\n## Previous Review Rounds\n" + previousPackets.map((p) =>
        `### ${p.title}\n${JSON.stringify(p.content, null, 2)}`
      ).join("\n\n")
    : "";

  const roleLabel = "Results and Evidence Analyst";
  const roundLabel = roundInfo ? ` (Round ${roundInfo.round} of ${roundInfo.maxRounds})` : "";

  return `You are ${roleLabel} in a Deep Research review process${roundLabel}.

## YOUR ROLE AND LIMITS
- You CRITIQUE the Researcher's synthesis. You provide advisory feedback.
- You CANNOT dispatch workers, search for papers, or run experiments.
- You CANNOT modify the workflow graph.
- You CANNOT override the Researcher's decisions.
- You CAN identify specific gaps that need more literature.
- You CAN suggest specific experiments that would validate claims.
- Your recommendations go to the Researcher, who decides whether to act on them.

## Artifacts to Review
${artifactsSection}
${previousSection}

## Output Format
Respond with valid JSON:
{
  "reviewerRole": "${role}",
  "verdict": "approve|revise|reject",
  "critique": "Detailed critique — be specific, cite evidence",
  "suggestions": ["Actionable suggestion 1", "Suggestion 2"],
  "confidence": 0.0-1.0,
  "identifiedGaps": ["Specific literature gaps found — be precise about what's missing"],
  "needsExperimentalValidation": true/false,
  "suggestedExperiments": ["Specific experiment if validation needed"]
}

## Guidelines
- Be specific. "The analysis is weak" is useless. "The claim about X lacks supporting evidence from controlled experiments" is useful.
- Identify: logical gaps, unsupported claims, missing baselines, methodology issues, novelty issues.
- For literature gaps: state EXACTLY what is missing (e.g., "Missing comparison against method Y on dataset Z").
- "revise" = has promise, needs specific improvements.
- "approve" = meets research standard.
- "reject" = fundamental issues.`;
}

// =============================================================
// EVIDENCE GATHERING PROMPT
// =============================================================

export function buildEvidenceGatherPrompt(
  query: string,
  constraints?: { maxSources?: number; focusAreas?: string[] }
): string {
  const maxSources = constraints?.maxSources ?? 10;
  return `Search for and gather evidence related to:

## Query
${query}

## Constraints
- Maximum sources to find: ${maxSources}
- Focus areas: ${constraints?.focusAreas?.join(", ") || "none specified — use your judgment"}

## Instructions

**You MUST use the searchArticles tool to find papers.** Do not skip tool usage.

1. First, call searchArticles with broad keywords extracted from the query (2-4 keywords).
2. If the first search returns few results, try again with different/broader keywords.
3. Try variations: synonyms, related terms, shorter keyword lists.
4. Search both arXiv and Hugging Face sources.

For each source found, extract:
1. Source (paper title, URL)
2. Relevant findings or excerpts
3. Methodology used
4. Confidence in evidence quality (high/medium/low)
5. How it relates to the query

After searching, respond with a JSON object:
\`\`\`json
{
  "sources": [{ "title": "...", "url": "...", "findings": "...", "methodology": "...", "confidence": "high|medium|low", "relevance": "..." }],
  "totalFound": <number>,
  "searchQueries": ["keywords used..."],
  "coverageSummary": "Brief description of what was found"
}
\`\`\`

Be systematic. Cover the query from multiple angles if possible.
STOP when you have found ${maxSources} relevant sources or exhausted available search results.
Do NOT do unbounded searching. Quality over quantity.`;
}

// =============================================================
// VALIDATION PLAN PROMPT
// =============================================================

export function buildValidationPlanPrompt(
  session: DeepResearchSession,
  synthesisArtifacts: DeepResearchArtifact[],
  reviewAssessment: ReviewAssessment | null
): string {
  const synthesisSection = synthesisArtifacts.map(a =>
    `### ${a.title}\n${JSON.stringify(a.content, null, 2)}`
  ).join("\n\n");

  const reviewSection = reviewAssessment
    ? `## Reviewer Outcome\n${JSON.stringify(reviewAssessment, null, 2)}`
    : "";

  return `Convert the research findings into a concrete validation plan.

## Research Findings
${synthesisSection}

${reviewSection}

## User's Original Question
${session.title}

## Instructions
Produce a validation plan as JSON:
{
  "objective": "What we are trying to validate",
  "hypothesis": "The specific hypothesis to test",
  "literaturePrediction": "What literature suggests should happen",
  "requiredResources": {"gpu": N, "memoryMb": N, "cpu": N, "privateMachine": "yes|no|group"},
  "datasets": ["dataset1", "dataset2"],
  "steps": [
    {
      "stepNumber": 1,
      "description": "What this step does",
      "command": "command to run (if applicable)",
      "scriptPath": "path/to/script (if applicable)",
      "launcherType": "rjob|rlaunch|local_shell",
      "requiresApproval": true,
      "expectedDuration": "estimate"
    }
  ],
  "expectedOutputs": ["metric1", "metric2"],
  "failureCriteria": ["condition that means the hypothesis is false"],
  "successCriteria": ["condition that confirms the hypothesis"]
}

Be specific and executable. Each step should be doable by the appropriate specialist role.`;
}
