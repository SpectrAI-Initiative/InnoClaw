import type {
  ResearchExecRoleConfig,
  ResearchExecRoleId,
  WorkflowStage,
} from "./types";

// =============================================================
// Agent Role Configurations
// =============================================================

export const RESEARCH_EXEC_ROLES: Record<ResearchExecRoleId, ResearchExecRoleConfig> = {
  repo_agent: {
    roleId: "repo_agent",
    displayName: "Repo Agent",
    icon: "FolderSearch",
    color: "#3b82f6", // blue
  },
  patch_agent: {
    roleId: "patch_agent",
    displayName: "Patch Agent",
    icon: "FileDiff",
    color: "#8b5cf6", // violet
  },
  remote_agent: {
    roleId: "remote_agent",
    displayName: "Remote Agent",
    icon: "Server",
    color: "#f59e0b", // amber
  },
  result_analyst: {
    roleId: "result_analyst",
    displayName: "Result Analyst",
    icon: "BarChart3",
    color: "#10b981", // emerald
  },
  research_planner: {
    roleId: "research_planner",
    displayName: "Research Planner",
    icon: "Compass",
    color: "#ec4899", // pink
  },
};

// =============================================================
// Workflow Stages
// =============================================================

export const WORKFLOW_STAGES: WorkflowStage[] = [
  { id: "inspect", roleId: "repo_agent", labelKey: "stageInspect", requiresApproval: false },
  { id: "propose_patch", roleId: "patch_agent", labelKey: "stageProposePatch", requiresApproval: false },
  { id: "approve_patch", roleId: "patch_agent", labelKey: "stageApprovePatch", requiresApproval: true },
  { id: "apply_patch", roleId: "patch_agent", labelKey: "stageApplyPatch", requiresApproval: false },
  { id: "preview_sync", roleId: "remote_agent", labelKey: "stagePreviewSync", requiresApproval: false },
  { id: "execute_sync", roleId: "remote_agent", labelKey: "stageExecuteSync", requiresApproval: true },
  { id: "prepare_job", roleId: "remote_agent", labelKey: "stagePrepareJob", requiresApproval: false },
  { id: "submit_job", roleId: "remote_agent", labelKey: "stageSubmitJob", requiresApproval: true },
  { id: "monitor_job", roleId: "remote_agent", labelKey: "stageMonitorJob", requiresApproval: false },
  { id: "approve_collect", roleId: "remote_agent", labelKey: "stageApproveCollect", requiresApproval: true },
  { id: "collect_results", roleId: "remote_agent", labelKey: "stageCollectResults", requiresApproval: false },
  { id: "analyze_results", roleId: "result_analyst", labelKey: "stageAnalyzeResults", requiresApproval: false },
  { id: "recommend_next", roleId: "research_planner", labelKey: "stageRecommendNext", requiresApproval: false },
];
