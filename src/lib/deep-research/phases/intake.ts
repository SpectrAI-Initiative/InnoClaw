// Phase: Intake
import * as store from "../event-store";
import { executeNode } from "../node-executor";
import type { PhaseContext } from "../types";
import type { PhaseHandlerResult } from "./types";

export async function handleIntake(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, messages, abortSignal } = ctx;

  const userQuery = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");

  const node = await store.createNode(session.id, {
    nodeType: "intake",
    label: "Analyze research question",
    assignedRole: "main_brain",
    input: { userQuery },
    phase: "intake",
  });

  const nodeCtx = await buildNodeContext(session.id);
  await executeNode(node, nodeCtx, abortSignal);

  return { completedNode: node, suggestedNextPhase: "planning" };
}

async function buildNodeContext(sessionId: string) {
  const session = (await store.getSession(sessionId))!;
  const messages = await store.getMessages(sessionId);
  const allNodes = await store.getNodes(sessionId);
  const allArtifacts = await store.getArtifacts(sessionId);
  return { session, messages, allNodes, allArtifacts };
}
