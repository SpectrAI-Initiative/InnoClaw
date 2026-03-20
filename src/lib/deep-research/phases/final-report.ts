// Phase: Final Report
// INVARIANT A: Only generate if no active required nodes remain pending
import * as store from "../event-store";
import { executeNode } from "../node-executor";
import type { PhaseContext } from "../types";
import { PHASE_STAGE_NUMBER } from "../types";
import type { PhaseHandlerResult } from "./types";
import { buildNodeContext } from "./shared";

export async function handleFinalReport(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  // Double-check invariant A: no pending required nodes on active branch
  const nodes = await store.getNodes(session.id);
  const activePending = nodes.filter(n =>
    n.status !== "superseded" &&
    n.status !== "skipped" &&
    n.status !== "completed" &&
    n.status !== "failed" &&
    n.nodeType !== "final_report" &&
    PHASE_STAGE_NUMBER[n.phase] < PHASE_STAGE_NUMBER["final_report"]
  );

  if (activePending.length > 0) {
    // Create a warning node instead of a report
    const warningNode = await store.createNode(session.id, {
      nodeType: "deliberate",
      label: "Final report blocked — pending work remains",
      assignedRole: "main_brain",
      phase: "final_report",
    });
    await store.updateNode(warningNode.id, {
      status: "completed",
      output: {
        blocked: true,
        reason: `${activePending.length} required node(s) still pending`,
        pendingNodes: activePending.map(n => ({ id: n.id, label: n.label, status: n.status, phase: n.phase })),
      },
      completedAt: new Date().toISOString(),
    });
    await store.addMessage(session.id, "main_brain",
      `Cannot generate final report yet: ${activePending.length} required task(s) are still pending. ` +
      `Pending: ${activePending.map(n => `"${n.label}"`).join(", ")}.`
    );
    // Suggest going back to the earliest pending phase
    const earliestPhase = activePending
      .map(n => n.phase)
      .sort((a, b) => (PHASE_STAGE_NUMBER[a] ?? 99) - (PHASE_STAGE_NUMBER[b] ?? 99))[0];

    return { completedNode: warningNode, suggestedNextPhase: earliestPhase ?? "evidence_collection" };
  }

  // Check evidence quality — add note to final report context if evidence was weak
  const evidenceNodes = nodes.filter(n => n.nodeType === "evidence_gather");
  const evidenceArtifacts = (await store.getArtifacts(session.id)).filter(a => a.artifactType === "evidence_card");
  let evidenceNote = "";
  const emptyEvidence = evidenceNodes.filter(n => {
    const art = evidenceArtifacts.find(a => a.nodeId === n.id);
    if (!art) return true;
    const sources = (art.content.sources as unknown[]) ?? [];
    return sources.length === 0;
  });
  if (emptyEvidence.length > 0) {
    evidenceNote = `\n\nNOTE: ${emptyEvidence.length} of ${evidenceNodes.length} evidence streams returned empty. ` +
      `Clearly distinguish between retrieved evidence and background knowledge/assumptions in the report.`;
  }

  const reportNode = await store.createNode(session.id, {
    nodeType: "final_report",
    label: "Generate final research + validation report",
    assignedRole: "main_brain",
    input: { evidenceNote },
    phase: "final_report",
  });

  const nodeCtx = await buildNodeContext(session.id);
  await executeNode(reportNode, nodeCtx, abortSignal);

  return { completedNode: reportNode, suggestedNextPhase: "final_report", isFinalStep: true };
}
