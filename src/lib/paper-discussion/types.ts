export type DiscussionRoleId =
  | "moderator"
  | "librarian"
  | "skeptic"
  | "reproducer"
  | "scribe";

export type DiscussionPhaseId = "A" | "B" | "C" | "D" | "E" | "F";

export interface DiscussionRole {
  id: DiscussionRoleId;
  nameKey: string;
  icon: string;
  color: string;
}

export interface DiscussionPhase {
  id: DiscussionPhaseId;
  roleId: DiscussionRoleId;
  labelKey: string;
}

export interface DiscussionMessage {
  phaseId: DiscussionPhaseId;
  roleId: DiscussionRoleId;
  content: string;
}

export interface DiscussionResult {
  article: { id: string; title: string; source: string };
  messages: DiscussionMessage[];
  report: string;
  createdAt: string;
  mode: "quick" | "full";
}
