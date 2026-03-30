import {
  buildStructuredRoleReply,
  getCommunicationProtocolsForRole,
  getStructuredRoleDefinition,
  getStructuredRoleDisplayName,
  listMetaWorkerRoleDefinitions,
  RESEARCHER_ROLE_ID,
} from "./role-registry";
import type {
  DeepResearchNode,
  ModelRole,
  StructuredHandoffPacket,
  StructuredTaskBoard,
} from "./types";

function normalizeObjective(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : "Coordinate the current research session.";
}

export function buildResearchTaskBoard(objective: string): StructuredTaskBoard {
  const normalizedObjective = normalizeObjective(objective);
  const workerRoles = listMetaWorkerRoleDefinitions();

  return {
    objective: normalizedObjective,
    coordinatorRoleId: RESEARCHER_ROLE_ID,
    assignments: workerRoles.map((role, index) => ({
      roleId: role.roleId,
      roleName: role.roleName,
      workflowSegment: role.workflowSegment,
      objective: `${role.roleName} should address the ${role.workflowSegment.toLowerCase()} segment for: ${normalizedObjective}`,
      deliverables: [
        role.coreResponsibilities[0] ?? `Structured output for ${role.roleName}`,
        role.performanceStandards[0] ?? `Quality-checked output for ${role.roleName}`,
      ],
      dependencies: index === 0 ? [RESEARCHER_ROLE_ID] : [workerRoles[index - 1].roleId],
      status: "planned",
    })),
    milestones: [
      "Ground the objective with relevant evidence and baselines.",
      "Translate the objective into an implementation-ready experiment design.",
      "Implement, execute, analyze, and package the validated outputs.",
    ],
    completionCriteria: [
      "All six worker segments have explicit deliverables and dependency order.",
      "The Researcher can trace every assignment to the current objective.",
      "Outputs remain reproducible and suitable for later reuse.",
    ],
  };
}

export function buildHandoffPacket(
  targetRoleId: ModelRole,
  content: string,
): StructuredHandoffPacket | null {
  const role = getStructuredRoleDefinition(targetRoleId);
  if (!role) {
    return null;
  }

  const protocol = getCommunicationProtocolsForRole(targetRoleId).find((item) => item.toRoleId === targetRoleId)
    ?? getCommunicationProtocolsForRole(targetRoleId)[0];

  return {
    type: protocol?.toRoleId === targetRoleId ? "handoff" : "progress_update",
    fromRoleId: protocol?.fromRoleId ?? RESEARCHER_ROLE_ID,
    toRoleId: targetRoleId,
    goal: protocol?.goal ?? `Coordinate work for ${role.roleName}.`,
    payload: [
      `User request: ${normalizeObjective(content)}`,
      ...(protocol?.requiredPayload ?? role.prompts[0]?.requiredSections ?? []),
    ],
    expectedResponse: protocol?.responseContract ?? role.collaborations[0]?.expectedResponse ?? [
      `${role.roleName} structured response`,
    ],
    status: "shared",
  };
}

export function buildTaskBoardMessage(objective: string): string {
  const board = buildResearchTaskBoard(objective);
  const taskLines = board.assignments
    .map((assignment) => `- ${assignment.roleName}: ${assignment.workflowSegment}`)
    .join("\n");

  return [
    `Researcher created a structured task board for: ${board.objective}`,
    "Assigned worker sequence:",
    taskLines,
    "This task board is stored as a structured artifact for downstream handoffs.",
  ].join("\n");
}

export function buildHandoffMessage(
  node: DeepResearchNode,
  content: string,
): string {
  const roleId = typeof node.input?.roleId === "string"
    ? node.input.roleId as ModelRole
    : node.assignedRole;
  const role = getStructuredRoleDefinition(roleId);
  const handoff = buildHandoffPacket(roleId, content);

  if (!role || !handoff) {
    return "The message was recorded, but no structured handoff contract could be generated for the selected node.";
  }

  return [
    `${getStructuredRoleDisplayName(handoff.fromRoleId)} routed a structured ${handoff.type} packet to ${role.roleName}.`,
    `Goal: ${handoff.goal}`,
    `Expected response: ${handoff.expectedResponse.join("; ")}`,
    buildStructuredRoleReply(role, content),
  ].join("\n");
}
