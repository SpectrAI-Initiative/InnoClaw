import type {
  ActorExecutionContext,
  ActorExecutionResult,
  BrainDecision,
  DeepResearchNode,
  DeepResearchSession,
  ModelRole,
  RequirementState,
} from "../types";
import { buildStructuredRoleReply, getStructuredRoleDefinition, RESEARCHER_ROLE_ID } from "../role-registry";

function interfaceOnlyMessage(): string {
  return "Researcher is preserved as the main-brain interface placeholder in this branch; execution is disabled.";
}

export interface MainBrainContract {
  replyToNodeMessage(
    session: DeepResearchSession,
    node: DeepResearchNode,
    userMessage: string,
    options?: {
      abortSignal?: AbortSignal;
      contextNote?: string;
    },
  ): Promise<{ message: string; tokensUsed: number }>;
  decide(
    session: DeepResearchSession,
    options?: {
      abortSignal?: AbortSignal;
      requirementState?: RequirementState | null;
      languageHint?: string;
    },
  ): Promise<BrainDecision>;
  executeNode(
    node: DeepResearchNode,
    ctx: ActorExecutionContext,
    abortSignal?: AbortSignal,
  ): Promise<ActorExecutionResult>;
}

export class MainBrain implements MainBrainContract {
  async replyToNodeMessage(
    _session: DeepResearchSession,
    node: DeepResearchNode,
    userMessage: string,
  ): Promise<{ message: string; tokensUsed: number }> {
    const roleId = typeof node.input?.roleId === "string"
      ? node.input.roleId as ModelRole
      : RESEARCHER_ROLE_ID;
    const role = getStructuredRoleDefinition(roleId);
    return {
      message: role ? buildStructuredRoleReply(role, userMessage) : interfaceOnlyMessage(),
      tokensUsed: 0,
    };
  }

  async decide(session: DeepResearchSession): Promise<BrainDecision> {
    const role = getStructuredRoleDefinition(RESEARCHER_ROLE_ID);
    return {
      action: "respond_to_user",
      messageToUser: role
        ? buildStructuredRoleReply(role, `Coordinate the active research session "${session.title}".`)
        : `${interfaceOnlyMessage()} Session: ${session.title}`,
    };
  }

  async executeNode(node: DeepResearchNode): Promise<ActorExecutionResult> {
    return {
      output: {
        interface: "main-brain",
        nodeId: node.id,
        status: "reserved",
        message: interfaceOnlyMessage(),
      },
      artifacts: [],
      tokensUsed: 0,
    };
  }
}

export const mainBrainInterface: MainBrainContract = new MainBrain();
