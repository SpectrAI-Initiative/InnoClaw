import type { DiscussionRole, DiscussionPhase, DiscussionRoleId } from "./types";

export const DISCUSSION_ROLES: Record<DiscussionRoleId, DiscussionRole> = {
  moderator: {
    id: "moderator",
    nameKey: "paperDiscussion.roleModerator",
    icon: "Gavel",
    color: "text-blue-600",
  },
  librarian: {
    id: "librarian",
    nameKey: "paperDiscussion.roleLibrarian",
    icon: "BookOpen",
    color: "text-green-600",
  },
  skeptic: {
    id: "skeptic",
    nameKey: "paperDiscussion.roleSkeptic",
    icon: "ShieldAlert",
    color: "text-red-600",
  },
  reproducer: {
    id: "reproducer",
    nameKey: "paperDiscussion.roleReproducer",
    icon: "FlaskConical",
    color: "text-orange-600",
  },
  scribe: {
    id: "scribe",
    nameKey: "paperDiscussion.roleScribe",
    icon: "PenTool",
    color: "text-purple-600",
  },
};

export const DISCUSSION_PHASES: DiscussionPhase[] = [
  { id: "A", roleId: "moderator", labelKey: "paperDiscussion.phaseA" },
  { id: "B", roleId: "librarian", labelKey: "paperDiscussion.phaseB" },
  { id: "C", roleId: "skeptic", labelKey: "paperDiscussion.phaseC" },
  { id: "D", roleId: "reproducer", labelKey: "paperDiscussion.phaseD" },
  { id: "E", roleId: "moderator", labelKey: "paperDiscussion.phaseE" },
  { id: "F", roleId: "scribe", labelKey: "paperDiscussion.phaseF" },
];
