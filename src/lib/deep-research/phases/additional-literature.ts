// Phase: Additional Literature (reviewer-requested, bounded by round budget)
import * as store from "../event-store";
import type { PhaseContext, ReviewerBattleResult } from "../types";
import type { PhaseHandlerResult } from "./types";
import { callMainBrain, createNodesFromSpecs, executeReadyWorkers } from "./shared";

export async function handleAdditionalLiterature(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  if (session.literatureRound >= session.config.literature.maxLiteratureRounds) {
    console.warn("[deep-research] Max literature rounds reached, advancing");
    const fallbackNode = (await store.getNodes(session.id)).slice(-1)[0];
    return { completedNode: fallbackNode, suggestedNextPhase: "validation_planning" };
  }

  const battleArtifacts = await store.getArtifacts(session.id, { type: "reviewer_battle_result" });
  const latestBattle = battleArtifacts[battleArtifacts.length - 1];
  const battleContent = latestBattle?.content as unknown as ReviewerBattleResult | undefined;

  const decision = await callMainBrain(session, abortSignal, ctx.requirementState);

  if (decision.nodesToCreate?.length) {
    // Fix tiny caps on additional literature nodes too
    const fixedSpecs = decision.nodesToCreate.map(spec => {
      if (spec.nodeType === "evidence_gather" && spec.input) {
        const input = { ...spec.input };
        const maxPapers = input.maxPapers as number | undefined;
        if (!maxPapers || maxPapers < 5) {
          input.maxPapers = Math.min(
            session.config.literature.maxPapersPerRound,
            Math.max(5, session.config.literature.maxPapersPerRound / Math.max(1, decision.nodesToCreate!.length))
          );
        }
        return { ...spec, input };
      }
      return spec;
    });
    await createNodesFromSpecs(session.id, fixedSpecs, "additional_literature");
  } else if (battleContent?.literatureGaps?.length) {
    // Create nodes from reviewer-identified gaps with adaptive per-node budget
    const gaps = battleContent.literatureGaps.slice(0, session.config.maxWorkerFanOut);
    const perNodeBudget = Math.max(5, Math.floor(session.config.literature.maxPapersPerRound / Math.max(1, gaps.length)));
    for (const gap of gaps) {
      await store.createNode(session.id, {
        nodeType: "evidence_gather",
        label: `Gap search: ${gap.slice(0, 80)}`,
        assignedRole: "worker",
        input: {
          query: gap,
          maxPapers: perNodeBudget,
        },
        phase: "additional_literature",
      });
    }
  }

  if (decision.messageToUser) {
    await store.addMessage(session.id, "main_brain", decision.messageToUser);
  }

  await store.updateSession(session.id, { literatureRound: session.literatureRound + 1 });
  await executeReadyWorkers(session, abortSignal);

  const lastNode = (await store.getNodes(session.id))
    .filter(n => n.phase === "additional_literature")
    .pop() ?? (await store.getNodes(session.id)).slice(-1)[0];

  return { completedNode: lastNode, suggestedNextPhase: "literature_synthesis" };
}
