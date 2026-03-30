import type {
  ActorExecutionContext,
  ActorExecutionResult,
  DeepResearchNode,
  ModelRole,
} from "../types";
import { buildStructuredRoleReply, getStructuredRoleDefinition } from "../role-registry";

function interfaceOnlyMessage(): string {
  return "Meta-workers are preserved as interface placeholders in this branch; execution is disabled.";
}

export interface MetaWorkerContract {
  supports(node: DeepResearchNode): boolean;
  execute(
    node: DeepResearchNode,
    ctx: ActorExecutionContext,
    abortSignal?: AbortSignal,
  ): Promise<ActorExecutionResult>;
}

class InterfaceOnlyMetaWorker implements MetaWorkerContract {
  supports(): boolean {
    return true;
  }

  async execute(node: DeepResearchNode): Promise<ActorExecutionResult> {
    const roleId = typeof node.input?.roleId === "string"
      ? node.input.roleId as ModelRole
      : node.assignedRole;
    const role = getStructuredRoleDefinition(roleId);
    return {
      output: {
        interface: "meta-workers",
        nodeId: node.id,
        status: "reserved",
        message: role
          ? buildStructuredRoleReply(role, `Execute the ${role.roleName} contract for this session.`)
          : interfaceOnlyMessage(),
      },
      artifacts: [],
      tokensUsed: 0,
    };
  }
}

export class WorkerRegistry {
  private static readonly worker: MetaWorkerContract = new InterfaceOnlyMetaWorker();

  static resolve(node: DeepResearchNode): MetaWorkerContract {
    void node;
    return this.worker;
  }
}

export const metaWorkersInterface: MetaWorkerContract = new InterfaceOnlyMetaWorker();
