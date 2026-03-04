export type ReportStatus = "pending" | "running" | "completed" | "error";

export interface ReportSource {
  id: string;
  title: string;
  url?: string;
  snippet: string;
  fileName?: string;
}

export interface ReportProcessStep {
  id: string;
  order: number;
  label: string;
  toolName?: string;
  status: "pending" | "running" | "completed" | "error";
  detail?: string;
}

export interface ReportData {
  id: string;
  workspaceId: string;
  title: string;
  status: ReportStatus;
  markdownContent: string;
  sources: ReportSource[];
  processSteps: ReportProcessStep[];
  createdAt: string;
  updatedAt: string;
}
