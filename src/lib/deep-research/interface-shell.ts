import {
  addMessage,
  createArtifact,
  createNode,
  getArtifacts,
  getMessages,
  getNodes,
  updateNode,
  updateSession,
} from "./event-store";
import { buildNodeTranscriptMetadata } from "./node-transcript";
import {
  buildResearcherSessionWelcome,
  buildRoleBootstrapMessage,
  buildStructuredProtocolArtifactContent,
  buildStructuredRoleArtifactContent,
  buildStructuredRoleReply,
  getCommunicationProtocolsForRole,
  getStructuredRoleDefinition,
  listMetaWorkerRoleDefinitions,
  listStructuredRoleDefinitions,
  RESEARCHER_ROLE_ID,
  roleArtifactTypeFor,
} from "./role-registry";
import type { DeepResearchNode, DeepResearchSession, ModelRole, StructuredRoleDefinition } from "./types";

const LEGACY_MAIN_BRAIN_LABEL = "Main Brain Interface";
const LEGACY_META_WORKERS_LABEL = "Meta-Workers Interface";

type InterfaceShellNodes = {
  researcherNode: DeepResearchNode;
  metaWorkerNodes: DeepResearchNode[];
};

function getNodeRoleId(node: DeepResearchNode): ModelRole | null {
  const roleId = node.input?.roleId;
  return typeof roleId === "string" ? (roleId as ModelRole) : null;
}

function getRoleNode(
  nodes: DeepResearchNode[],
  role: StructuredRoleDefinition,
): DeepResearchNode | null {
  return nodes.find((node) =>
    getNodeRoleId(node) === role.roleId
    || node.assignedRole === role.roleId
    || node.label === role.roleName,
  ) ?? null;
}

async function markLegacyShellNodes(nodes: DeepResearchNode[]): Promise<void> {
  const legacyNodes = nodes.filter((node) =>
    node.label === LEGACY_MAIN_BRAIN_LABEL || node.label === LEGACY_META_WORKERS_LABEL,
  );

  await Promise.all(
    legacyNodes
      .filter((node) => node.status !== "superseded")
      .map((node) => updateNode(node.id, {
        status: "superseded",
        output: {
          ...(node.output ?? {}),
          migratedToStructuredRoles: true,
          note: "Superseded by the Researcher + six-worker structured role system.",
        },
        completedAt: node.completedAt ?? new Date().toISOString(),
      })),
  );
}

async function ensureRoleNode(
  sessionId: string,
  role: StructuredRoleDefinition,
  dependsOn: string[],
): Promise<DeepResearchNode> {
  const node = await createNode(sessionId, {
    nodeType: role.defaultNodeType,
    label: role.roleName,
    assignedRole: role.roleId,
    contextTag: role.defaultContextTag,
    dependsOn,
    input: {
      roleId: role.roleId,
      roleName: role.roleName,
      roleCategory: role.category,
      workflowSegment: role.workflowSegment,
      mode: "interface-only",
      communicationProtocols: getCommunicationProtocolsForRole(role.roleId),
    },
  });

  const now = new Date().toISOString();
  const output = {
    roleId: role.roleId,
    roleName: role.roleName,
    status: "structured-interface-ready",
    workflowSegment: role.workflowSegment,
    collaborationPartners: role.collaborations.map((item) => item.partnerRoleId),
    promptCount: role.prompts.length,
    skillCount: role.skills.length,
    note: "Live execution is disabled; this node exposes the role contract, prompts, skills, and collaboration schema.",
  };

  await updateNode(node.id, {
    status: "completed",
    output,
    startedAt: now,
    completedAt: now,
  });

  await addMessage(
    sessionId,
    "system",
    buildRoleBootstrapMessage(role),
    buildNodeTranscriptMetadata(node, "status", {
      source: "structured_role_bootstrap",
      interfaceOnly: true,
      roleId: role.roleId,
    }),
    node.id,
  );

  const artifact = await createArtifact(
    sessionId,
    node.id,
    roleArtifactTypeFor(role.roleId),
    `${role.roleName} Role Specification`,
    buildStructuredRoleArtifactContent(role),
  );

  await addMessage(
    sessionId,
    role.roleId === RESEARCHER_ROLE_ID ? "main_brain" : "system",
    buildStructuredRoleReply(role, "Bootstrap the structured role contract for this session."),
    buildNodeTranscriptMetadata(node, "output", {
      source: "structured_role_bootstrap",
      interfaceOnly: true,
      roleId: role.roleId,
    }),
    node.id,
    [artifact.id],
  );

  return {
    ...node,
    status: "completed",
    output,
    startedAt: now,
    completedAt: now,
  };
}

async function ensureProtocolArtifact(
  sessionId: string,
): Promise<string | null> {
  const artifacts = await getArtifacts(sessionId);
  const existing = artifacts.find((artifact) =>
    artifact.nodeId === null
    && artifact.artifactType === "task_graph"
    && artifact.title === "Deep Research Role Collaboration Protocol",
  );

  if (existing) {
    return existing.id;
  }

  const artifact = await createArtifact(
    sessionId,
    null,
    "task_graph",
    "Deep Research Role Collaboration Protocol",
    buildStructuredProtocolArtifactContent(),
  );

  return artifact.id;
}

export function isInterfaceOnlySession(session: DeepResearchSession): boolean {
  return session.config.interfaceOnly === true;
}

export function buildInterfaceOnlyReply(
  content: string,
  node?: Pick<DeepResearchNode, "label" | "input" | "assignedRole"> | null,
): string {
  const roleIdFromNode = node
    ? (typeof node.input?.roleId === "string" ? (node.input.roleId as ModelRole) : node.assignedRole)
    : RESEARCHER_ROLE_ID;
  const role = getStructuredRoleDefinition(roleIdFromNode);

  if (!role) {
    return "The request was recorded, but this session is configured as an interface-only shell and no structured role contract was found for the selected node.";
  }

  return buildStructuredRoleReply(role, content);
}

export async function ensureInterfaceShell(
  session: DeepResearchSession,
): Promise<InterfaceShellNodes> {
  const existingNodes = await getNodes(session.id);
  await markLegacyShellNodes(existingNodes);

  const roleDefinitions = listStructuredRoleDefinitions();
  const researcherRole = roleDefinitions.find((role) => role.roleId === RESEARCHER_ROLE_ID);
  if (!researcherRole) {
    throw new Error("Structured role registry is missing the Researcher definition.");
  }

  let researcherNode = getRoleNode(existingNodes, researcherRole);
  if (!researcherNode) {
    researcherNode = await ensureRoleNode(session.id, researcherRole, []);
  }

  const workerNodes: DeepResearchNode[] = [];
  let previousNodeId = researcherNode.id;
  for (const role of listMetaWorkerRoleDefinitions()) {
    let workerNode = getRoleNode(existingNodes, role);
    if (!workerNode) {
      workerNode = await ensureRoleNode(session.id, role, [previousNodeId]);
    }
    workerNodes.push(workerNode);
    previousNodeId = workerNode.id;
  }

  const protocolArtifactId = await ensureProtocolArtifact(session.id);

  await updateSession(session.id, {
    contextTag: "planning",
    status: "paused",
    error: null,
  });

  const artifacts = await getArtifacts(session.id);
  const hasWelcomeArtifact = artifacts.some((artifact) =>
    artifact.nodeId === null
    && artifact.title === "Deep Research Role Collaboration Protocol",
  );

  if (hasWelcomeArtifact) {
    const sessionMessages = await getMessages(session.id);
    const welcomeAlreadyExists = sessionMessages.some((message) =>
      message.metadata?.source === "structured_role_welcome",
    );
    if (!welcomeAlreadyExists) {
      await addMessage(
        session.id,
        "main_brain",
        buildResearcherSessionWelcome(),
        {
          source: "structured_role_welcome",
          interfaceOnly: true,
        },
        researcherNode.id,
        protocolArtifactId ? [protocolArtifactId] : undefined,
      );
    }
  }

  return {
    researcherNode,
    metaWorkerNodes: workerNodes,
  };
}
