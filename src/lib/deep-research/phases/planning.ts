// =============================================================
// Phase: Planning — with Dynamic Skill Routing
// =============================================================
// Refactored to support two planning modes:
//   1. Skill-routed planning — MainBrain receives the skill catalog
//      and dynamically chooses which skills to deploy based on task type
//   2. Classic planning — MainBrain plans without skill catalog (fallback)

import * as store from "../event-store";
import { generateText } from "ai";
import { getModelForRole, checkBudget, trackUsage } from "../model-router";
import type {
  PhaseContext,
  BrainDecision,
  NodeCreationSpec,
  SkillRoutingDecision,
} from "../types";
import type { PhaseHandlerResult } from "./types";
import { callMainBrain, createNodesFromSpecs } from "./shared";
import { defaultSkillRegistry } from "../skill-library";

export async function handlePlanning(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  const useSkillRouting = session.config.skillRouting?.enabled === true;

  let decision: BrainDecision;
  let skillRoutingResult: SkillRoutingDecision | null = null;

  if (useSkillRouting) {
    // ---------------------------------------------------------------
    // Path A: Skill-Routed Planning
    // ---------------------------------------------------------------
    const routingResult = await planWithSkillRouting(ctx);
    decision = routingResult.decision;
    skillRoutingResult = routingResult.skillRouting;

    // Log skill routing decision
    if (skillRoutingResult) {
      await store.addMessage(
        session.id,
        "system",
        `Skill routing selected ${skillRoutingResult.selectedSkills.length} skill(s): ` +
        `${skillRoutingResult.selectedSkills.join(", ")}. ` +
        `Reasoning: ${skillRoutingResult.reasoning}`,
      );

      await store.appendEvent(
        session.id,
        "skill_routing_completed",
        undefined,
        "main_brain",
        undefined,
        undefined,
        {
          selectedSkills: skillRoutingResult.selectedSkills,
          reasoning: skillRoutingResult.reasoning,
          nodeCount: skillRoutingResult.nodeSpecs.length,
        },
      );
    }
  } else {
    // ---------------------------------------------------------------
    // Path B: Classic Planning (unchanged)
    // ---------------------------------------------------------------
    decision = await callMainBrain(session, abortSignal, ctx.requirementState);
  }

  // Create nodes from decision
  const allSpecs: NodeCreationSpec[] = [
    ...(decision.nodesToCreate ?? []),
    ...(skillRoutingResult?.nodeSpecs ?? []),
  ];

  if (allSpecs.length > 0) {
    await createNodesFromSpecs(session.id, allSpecs, "evidence_collection");
  }

  if (decision.messageToUser) {
    await store.addMessage(session.id, "main_brain", decision.messageToUser);
  }

  // Create plan node
  const planNode = await store.createNode(session.id, {
    nodeType: "plan",
    label: useSkillRouting ? "Research plan (skill-routed)" : "Research plan",
    assignedRole: "main_brain",
    input: {
      decision,
      skillRouting: skillRoutingResult,
      planningMode: useSkillRouting ? "skill_routed" : "classic",
    },
    phase: "planning",
  });
  await store.updateNode(planNode.id, {
    status: "completed",
    output: {
      ...decision as unknown as Record<string, unknown>,
      skillRouting: skillRoutingResult,
    },
    completedAt: new Date().toISOString(),
  });

  // Create task_graph artifact
  await store.createArtifact(
    session.id,
    planNode.id,
    "task_graph",
    `Research Plan (${allSpecs.length} tasks)`,
    {
      planningMode: useSkillRouting ? "skill_routed" : "classic",
      totalNodes: allSpecs.length,
      nodesByType: countNodesByType(allSpecs),
      skillsUsed: skillRoutingResult?.selectedSkills ?? [],
      decision,
    },
  );

  return { completedNode: planNode, suggestedNextPhase: "evidence_collection" };
}

// -------------------------------------------------------------------
// Skill-routed planning
// -------------------------------------------------------------------

async function planWithSkillRouting(ctx: PhaseContext): Promise<{
  decision: BrainDecision;
  skillRouting: SkillRoutingDecision | null;
}> {
  const { session, abortSignal, requirementState } = ctx;
  const budgetCheck = checkBudget("main_brain", session.budget, session.config.budget);

  if (!budgetCheck.allowed) {
    return {
      decision: { action: "complete", messageToUser: "Budget limit reached." },
      skillRouting: null,
    };
  }

  const { model } = getModelForRole("main_brain", session.config);
  const messages = await store.getMessages(session.id);
  const _nodes = await store.getNodes(session.id);
  const _artifacts = await store.getArtifacts(session.id);

  // Build skill catalog for the prompt
  const skillCatalog = defaultSkillRegistry.describeForLLM();

  // Build requirement context
  const requirementContext = requirementState
    ? `\n## Requirements\n- Goal: ${requirementState.currentApprovedGoal}\n- Active: ${requirementState.requirements.filter(r => r.status === "active").map(r => r.text).join("; ")}`
    : "";

  const recentMessages = messages.slice(-5).map(m =>
    `[${m.role}]: ${m.content.slice(0, 300)}`
  ).join("\n");

  const prompt = `You are the Main Brain planning a research workflow.

## User's Research Goal
${session.title}
${requirementContext}

## Recent Messages
${recentMessages}

${skillCatalog}

## Task Types
Analyze the user's goal and classify it as one or more of:
- literature_heavy: Needs extensive paper search and synthesis
- benchmark_comparison: Needs benchmark/leaderboard data gathering
- experiment_planning: Needs experiment design and resource planning
- cluster_execution: Needs actual job submission and monitoring
- data_acquisition: Needs dataset downloading/preprocessing
- result_analysis: Needs experiment result comparison and analysis
- report_generation: Needs final report or summary

## Instructions
1. Classify the task type(s)
2. Select the appropriate skills from the catalog above
3. Create concrete worker node specs for each selected skill
4. Set reasonable parameters (max papers, focus areas, etc.)

Respond with JSON:
{
  "taskTypes": ["literature_heavy", ...],
  "skillRouting": {
    "selectedSkills": ["arxiv_search", "semantic_scholar_search", "literature_synthesis", ...],
    "reasoning": "Why these skills were chosen",
    "nodeSpecs": [
      {
        "nodeType": "retrieve",
        "label": "Search arXiv for [specific topic]",
        "assignedRole": "worker",
        "input": { "query": "...", "maxPapers": 10, "skill": "arxiv_search" },
        "phase": "evidence_collection"
      }
    ]
  },
  "decision": {
    "action": "advance_phase",
    "nextPhase": "evidence_collection",
    "messageToUser": "Planning complete. Will search for papers using [N] workers.",
    "reasoning": "..."
  }
}

Choose skills dynamically. A literature task needs many retrieval + synthesis skills.
An experiment task needs fewer retrieval but more execution + data skills.
Max ${session.config.maxWorkerFanOut} worker nodes per fan-out.`;

  try {
    const result = await generateText({
      model,
      system: "You are the Main Brain orchestrator. Plan the research workflow by selecting skills dynamically. Respond ONLY with valid JSON.",
      messages: [{ role: "user", content: prompt }],
      abortSignal,
    });

    const budget = trackUsage(session.budget, "main_brain", "skill_routing", result.usage?.totalTokens ?? 0);
    await store.updateSession(session.id, { budget });

    const parsed = extractJson(result.text);
    const decision: BrainDecision = (parsed.decision as BrainDecision) ?? {
      action: "advance_phase",
      nextPhase: "evidence_collection",
    };
    const skillRouting: SkillRoutingDecision | null = (parsed.skillRouting as SkillRoutingDecision) ?? null;

    return { decision, skillRouting };
  } catch (error) {
    console.warn("[planning] Skill routing failed, falling back to classic planning:", error);
    const decision = await callMainBrain(session, abortSignal, requirementState);
    return { decision, skillRouting: null };
  }
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function countNodesByType(specs: NodeCreationSpec[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const spec of specs) {
    counts[spec.nodeType] = (counts[spec.nodeType] ?? 0) + 1;
  }
  return counts;
}

function extractJson(text: string): Record<string, unknown> {
  // Try JSON fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* fall through */ }
  }

  // Try finding JSON object
  const firstBrace = text.indexOf("{");
  if (firstBrace >= 0) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.slice(firstBrace, i + 1)); } catch { break; }
        }
      }
    }
  }

  try { return JSON.parse(text.trim()); } catch { return {}; }
}
